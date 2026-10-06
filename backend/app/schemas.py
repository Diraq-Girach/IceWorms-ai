"""API request/response shapes. Kept separate from table models so the DB
schema can change without breaking the API contract (mirrored in
frontend/src/lib/types.ts)."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Sentiment = Literal["positive", "neutral", "negative"]
Category = Literal["question", "task", "metric", "date", "pricing"]


# ---------- shared ----------
class UserOut(BaseModel):
    id: int
    name: str
    email: str
    avatar_color: str


class ParticipantOut(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    avatar_color: str
    is_host: bool = False


class ParticipantIn(BaseModel):
    """Identify a participant by email (preferred) or by name."""

    name: str = Field(min_length=1, max_length=120)
    email: Optional[str] = None


# ---------- meetings ----------
class MeetingListItem(BaseModel):
    id: int
    title: str
    date: datetime
    duration_sec: int
    source: str
    platform: str
    host: Optional[ParticipantOut] = None
    participants: list[ParticipantOut]
    action_items_total: int
    action_items_open: int
    overview_preview: list[dict]  # first few summary bullets for the Home feed


class MeetingList(BaseModel):
    items: list[MeetingListItem]
    total: int


class OverviewBullet(BaseModel):
    emoji: str = "•"
    title: str
    text: str


class SummaryOut(BaseModel):
    overview: list[OverviewBullet]
    keywords: list[str]
    generated_by: str


class NoteBulletOut(BaseModel):
    id: int
    text: str
    start_sec: float


class NoteSectionOut(BaseModel):
    id: int
    title: str
    summary: str
    start_sec: float
    bullets: list[NoteBulletOut]


class ActionItemOut(BaseModel):
    id: int
    meeting_id: int
    meeting_title: Optional[str] = None  # filled on the cross-meeting Tasks list
    text: str
    details: list[str]
    start_sec: Optional[float] = None
    is_completed: bool
    assignee: Optional[ParticipantOut] = None
    created_at: datetime


class MeetingDetail(BaseModel):
    id: int
    title: str
    date: datetime
    duration_sec: int
    language: str
    source: str
    platform: str
    host: Optional[ParticipantOut] = None
    participants: list[ParticipantOut]
    summary: Optional[SummaryOut] = None
    notes: list[NoteSectionOut]
    action_items: list[ActionItemOut]


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: Optional[datetime] = None  # defaults to now
    participants: list[ParticipantIn] = []
    transcript_text: Optional[str] = None  # pasted transcript (txt / vtt / json)
    duration_sec: Optional[int] = None  # inferred from transcript if omitted
    language: str = "English (Global)"


class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    date: Optional[datetime] = None
    participants: Optional[list[ParticipantIn]] = None  # replaces the full list


# ---------- transcript ----------
class SegmentOut(BaseModel):
    id: int
    seq: int
    start_sec: float
    end_sec: float
    text: str
    sentiment: Sentiment
    category: Optional[Category] = None
    speaker: Optional[ParticipantOut] = None


# ---------- analytics (derived, never stored) ----------
class SpeakerStat(BaseModel):
    speaker: ParticipantOut
    talk_sec: float
    talktime_pct: float
    words: int
    wpm: int


class AnalyticsOut(BaseModel):
    speakers: list[SpeakerStat]
    sentiments: dict[str, float]  # {"positive": 34.0, "neutral": 61.0, "negative": 5.0}
    categories: dict[str, int]  # {"question": 5, "task": 3, ...}


# ---------- action items ----------
class ActionItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    assignee_id: Optional[int] = None
    start_sec: Optional[float] = None
    details: list[str] = []


class ActionItemUpdate(BaseModel):
    text: Optional[str] = Field(default=None, min_length=1, max_length=500)
    assignee_id: Optional[int] = None
    is_completed: Optional[bool] = None
    details: Optional[list[str]] = None
    clear_assignee: bool = False  # explicit unassign (since assignee_id=None means "unchanged")


# ---------- home ----------
class StatsOut(BaseModel):
    meetings: int
    contacts: int
    open_tasks: int
    new_tasks_7d: int
