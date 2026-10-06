from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from ..db import get_session
from ..models import Meeting, MeetingParticipant, TranscriptSegment, as_utc, utcnow
from ..schemas import (
    AnalyticsOut,
    MeetingCreate,
    MeetingDetail,
    MeetingList,
    MeetingUpdate,
    SegmentOut,
)
from ..services import serializers
from ..services.analytics import compute_analytics
from ..services.meetings import create_meeting, set_participants
from ..services.transcript_parser import TranscriptParseError, parse_transcript

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2 MB is plenty for text transcripts
ALLOWED_EXT = (".txt", ".vtt", ".json", ".srt")

# eager-load everything the list/detail serializers touch (avoids N+1 queries)
_LIST_LOAD = (
    selectinload(Meeting.participant_links).selectinload(MeetingParticipant.participant),
    selectinload(Meeting.action_items),
    selectinload(Meeting.summary),
)


def _get_meeting_or_404(session: Session, meeting_id: int, *options) -> Meeting:
    m = session.exec(select(Meeting).where(Meeting.id == meeting_id).options(*options)).first()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    return m


@router.get("", response_model=MeetingList)
def list_meetings(
    q: Optional[str] = Query(None, description="Search text"),
    scope: Literal["title", "all"] = Query("title", description="'all' also searches transcripts"),
    participant_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort: Literal["newest", "oldest", "longest"] = "newest",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
):
    stmt = select(Meeting)
    if q:
        like = f"%{q.strip()}%"
        title_match = col(Meeting.title).ilike(like)
        if scope == "all":
            in_transcript = (
                select(TranscriptSegment.id)
                .where(TranscriptSegment.meeting_id == Meeting.id, col(TranscriptSegment.text).ilike(like))
                .exists()
            )
            stmt = stmt.where(title_match | in_transcript)
        else:
            stmt = stmt.where(title_match)
    if participant_id:
        stmt = stmt.where(
            select(MeetingParticipant.meeting_id)
            .where(
                MeetingParticipant.meeting_id == Meeting.id,
                MeetingParticipant.participant_id == participant_id,
            )
            .exists()
        )
    if date_from:
        stmt = stmt.where(Meeting.date >= as_utc(date_from))
    if date_to:
        stmt = stmt.where(Meeting.date <= as_utc(date_to))

    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    order = {
        "newest": col(Meeting.date).desc(),
        "oldest": col(Meeting.date).asc(),
        "longest": col(Meeting.duration_sec).desc(),
    }[sort]
    rows = session.exec(stmt.order_by(order).offset(offset).limit(limit).options(*_LIST_LOAD)).all()
    return MeetingList(items=[serializers.meeting_list_item(m) for m in rows], total=total)


@router.post("", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
def create(body: MeetingCreate, session: Session = Depends(get_session)):
    """Create via form (metadata only) or with a pasted transcript."""
    segments = []
    if body.transcript_text and body.transcript_text.strip():
        try:
            segments = parse_transcript(body.transcript_text)
        except TranscriptParseError as e:
            raise HTTPException(422, str(e))
    m = create_meeting(
        session,
        title=body.title,
        date=body.date,
        participants=body.participants,
        segments=segments,
        duration_sec=body.duration_sec,
        language=body.language,
        source="form" if not segments else "paste",
    )
    return serializers.meeting_detail(m)


@router.post("/upload", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
async def upload(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    date: Optional[datetime] = Form(None),
    language: str = Form("English (Global)"),
    session: Session = Depends(get_session),
):
    """Upload a .txt / .vtt / .json transcript file."""
    name = file.filename or "transcript.txt"
    if not name.lower().endswith(ALLOWED_EXT):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"Use one of: {', '.join(ALLOWED_EXT)}")
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Transcript file too large (max 2 MB)")
    try:
        segments = parse_transcript(raw.decode("utf-8", errors="replace"), name)
    except TranscriptParseError as e:
        raise HTTPException(422, str(e))
    m = create_meeting(
        session,
        title=title or name.rsplit(".", 1)[0],
        date=date,
        participants=[],
        segments=segments,
        duration_sec=None,
        language=language,
        source="upload",
    )
    return serializers.meeting_detail(m)


@router.get("/{meeting_id}", response_model=MeetingDetail)
def get_meeting(meeting_id: int, session: Session = Depends(get_session)):
    m = _get_meeting_or_404(session, meeting_id, *_LIST_LOAD)
    return serializers.meeting_detail(m)


@router.patch("/{meeting_id}", response_model=MeetingDetail)
def update_meeting(meeting_id: int, body: MeetingUpdate, session: Session = Depends(get_session)):
    m = _get_meeting_or_404(session, meeting_id)
    if body.title is not None:
        m.title = body.title.strip()
    if body.date is not None:
        m.date = as_utc(body.date)
    if body.participants is not None:
        host = next((l.participant.name for l in m.participant_links if l.is_host), None)
        set_participants(session, m, body.participants, host_name=host)
    m.updated_at = utcnow()
    session.add(m)
    session.commit()
    session.refresh(m)
    return serializers.meeting_detail(m)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting_id: int, session: Session = Depends(get_session)):
    m = _get_meeting_or_404(session, meeting_id)
    session.delete(m)  # children removed via ON DELETE CASCADE + ORM cascade
    session.commit()


@router.get("/{meeting_id}/transcript", response_model=list[SegmentOut])
def get_transcript(meeting_id: int, session: Session = Depends(get_session)):
    _get_meeting_or_404(session, meeting_id)
    segs = session.exec(
        select(TranscriptSegment)
        .where(TranscriptSegment.meeting_id == meeting_id)
        .order_by(TranscriptSegment.seq)
        .options(selectinload(TranscriptSegment.speaker))
    ).all()
    return [serializers.segment_out(s) for s in segs]


@router.get("/{meeting_id}/analytics", response_model=AnalyticsOut)
def get_analytics(meeting_id: int, session: Session = Depends(get_session)):
    _get_meeting_or_404(session, meeting_id)
    segs = session.exec(
        select(TranscriptSegment)
        .where(TranscriptSegment.meeting_id == meeting_id)
        .options(selectinload(TranscriptSegment.speaker))
    ).all()
    return compute_analytics(list(segs))
