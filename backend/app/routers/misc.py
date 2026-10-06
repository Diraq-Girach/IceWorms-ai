from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import Session, select

from ..db import get_session
from ..models import ActionItem, Meeting, Participant, utcnow
from ..schemas import ParticipantOut, StatsOut, UserOut
from ..services.meetings import get_default_user
from ..services.serializers import participant_out

router = APIRouter(prefix="/api", tags=["misc"])


@router.get("/me", response_model=UserOut)
def me(session: Session = Depends(get_session)):
    """Placeholder auth: always the single seeded user."""
    u = get_default_user(session)
    return UserOut(id=u.id, name=u.name, email=u.email, avatar_color=u.avatar_color)


@router.get("/participants", response_model=list[ParticipantOut])
def list_participants(session: Session = Depends(get_session)):
    """Contacts — used for the participant filter and assignee pickers."""
    return [participant_out(p) for p in session.exec(select(Participant).order_by(Participant.name)).all()]


@router.get("/stats", response_model=StatsOut)
def stats(session: Session = Depends(get_session)):
    """Home page stat cards."""
    count = lambda stmt: session.exec(stmt).one()  # noqa: E731
    week_ago = utcnow() - timedelta(days=7)
    return StatsOut(
        meetings=count(select(func.count()).select_from(Meeting)),
        contacts=count(select(func.count()).select_from(Participant)),
        open_tasks=count(select(func.count()).select_from(ActionItem).where(ActionItem.is_completed == False)),  # noqa: E712
        new_tasks_7d=count(select(func.count()).select_from(ActionItem).where(ActionItem.created_at >= week_ago)),
    )
