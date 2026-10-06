from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from ..db import get_session
from ..models import ActionItem, Meeting, Participant, utcnow
from ..schemas import ActionItemCreate, ActionItemOut, ActionItemUpdate
from ..services.serializers import action_item_out

router = APIRouter(prefix="/api", tags=["action items"])


def _check_assignee(session: Session, assignee_id: Optional[int]) -> None:
    if assignee_id is not None and not session.get(Participant, assignee_id):
        raise HTTPException(422, "Assignee not found")


def _get_or_404(session: Session, item_id: int) -> ActionItem:
    item = session.get(ActionItem, item_id)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Action item not found")
    return item


@router.get("/action-items", response_model=list[ActionItemOut])
def list_action_items(
    completed: Optional[bool] = None,
    assignee_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    """Cross-meeting task list (Home > Tasks tab)."""
    stmt = (
        select(ActionItem)
        .join(Meeting)
        .options(selectinload(ActionItem.meeting), selectinload(ActionItem.assignee))
        .order_by(col(Meeting.date).desc(), ActionItem.id)
    )
    if completed is not None:
        stmt = stmt.where(ActionItem.is_completed == completed)
    if assignee_id is not None:
        stmt = stmt.where(ActionItem.assignee_id == assignee_id)
    return [action_item_out(a, with_meeting_title=True) for a in session.exec(stmt).all()]


@router.post(
    "/meetings/{meeting_id}/action-items",
    response_model=ActionItemOut,
    status_code=status.HTTP_201_CREATED,
)
def create_action_item(meeting_id: int, body: ActionItemCreate, session: Session = Depends(get_session)):
    if not session.get(Meeting, meeting_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    _check_assignee(session, body.assignee_id)
    item = ActionItem(meeting_id=meeting_id, **body.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)
    return action_item_out(item)


@router.patch("/action-items/{item_id}", response_model=ActionItemOut)
def update_action_item(item_id: int, body: ActionItemUpdate, session: Session = Depends(get_session)):
    item = _get_or_404(session, item_id)
    if body.text is not None:
        item.text = body.text.strip()
    if body.details is not None:
        item.details = body.details
    if body.is_completed is not None:
        item.is_completed = body.is_completed
    if body.clear_assignee:
        item.assignee_id = None
    elif body.assignee_id is not None:
        _check_assignee(session, body.assignee_id)
        item.assignee_id = body.assignee_id
    item.updated_at = utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    return action_item_out(item)


@router.delete("/action-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action_item(item_id: int, session: Session = Depends(get_session)):
    session.delete(_get_or_404(session, item_id))
    session.commit()
