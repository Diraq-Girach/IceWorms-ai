"""AI endpoints. Every one degrades gracefully: 503 when no model is configured,
502 with a readable message when the provider fails (existing data is never touched)."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..db import get_session
from ..models import Meeting, MeetingParticipant, TranscriptSegment
from ..schemas import AIStatus, AskIn, AskOut, MeetingDetail
from ..services import ai, serializers
from ..services.llm import LLMError, llm_enabled, model_name
from ..services.meetings import meeting_context, regenerate_notes

router = APIRouter(prefix="/api", tags=["ai"])
log = logging.getLogger("iceworms.ai")


def _require_ai() -> None:
    if not llm_enabled():
        raise HTTPException(503, "AI is not configured on the server (set LLM_API_KEY and LLM_MODEL).")


def _load(session: Session, meeting_id: int) -> Meeting:
    m = session.exec(
        select(Meeting)
        .where(Meeting.id == meeting_id)
        .options(
            selectinload(Meeting.participant_links).selectinload(MeetingParticipant.participant),
            selectinload(Meeting.segments).selectinload(TranscriptSegment.speaker),
            selectinload(Meeting.action_items),
            selectinload(Meeting.note_sections),
            selectinload(Meeting.summary),
        )
    ).first()
    if not m:
        raise HTTPException(404, "Meeting not found")
    if not m.segments:
        raise HTTPException(422, "This meeting has no transcript.")
    return m


@router.get("/ai/status", response_model=AIStatus)
def status():
    """Lets the UI show or hide AI buttons."""
    return AIStatus(enabled=llm_enabled(), model=model_name() if llm_enabled() else None)


@router.post("/meetings/{meeting_id}/summary/regenerate", response_model=MeetingDetail)
def regenerate(meeting_id: int, session: Session = Depends(get_session)):
    """Rewrite summary, notes and auto-generated action items with the LLM.
    Action items a person added, edited or completed are kept."""
    _require_ai()
    meeting = _load(session, meeting_id)
    try:
        meeting = regenerate_notes(session, meeting)
    except LLMError as e:
        log.warning("Regenerate failed for meeting %s: %s", meeting_id, e)
        raise HTTPException(502, e.user_message)
    return serializers.meeting_detail(meeting)


@router.post("/meetings/{meeting_id}/ask", response_model=AskOut)
def ask(meeting_id: int, body: AskIn, session: Session = Depends(get_session)):
    """Answer a question about one meeting from its transcript, citing [mm:ss] timestamps.
    Stateless: the client sends earlier turns in `history` for follow-up questions."""
    _require_ai()
    ctx = meeting_context(_load(session, meeting_id))
    session.close()  # done with the DB; don't hold a connection during the model call
    try:
        answer, citations = ai.answer_question(ctx, body.question.strip(), [t.model_dump() for t in body.history])
    except LLMError as e:
        log.warning("Ask failed for meeting %s: %s", meeting_id, e)
        raise HTTPException(502, e.user_message)
    return AskOut(answer=answer, citations=citations)
