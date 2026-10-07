"""Database schema.

    users ──< meetings ──< transcript_segments >── participants
                 │  ├──1 summaries
                 │  ├──< note_sections ──< note_bullets
                 │  ├──< action_items >── participants (assignee, nullable)
                 └──< meeting_participants >── participants      (M:N)

All children of a meeting are removed with it (ON DELETE CASCADE).
Deleting a participant nulls speaker/assignee references (ON DELETE SET NULL).
Analytics (talktime, WPM, sentiment %) are DERIVED from transcript_segments,
not stored, so they can never drift out of sync with the transcript.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Column, Index
from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """All datetimes are stored timezone-aware in UTC; naive input is treated as UTC."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True)
    avatar_color: str = "#F97316"

    meetings: list["Meeting"] = Relationship(back_populates="owner")


class Participant(SQLModel, table=True):
    """A person who appears in meetings (a 'contact' in Fireflies terms)."""

    __tablename__ = "participants"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    email: Optional[str] = Field(default=None, unique=True)
    avatar_color: str = "#7C3AED"

    meeting_links: list["MeetingParticipant"] = Relationship(back_populates="participant")


class MeetingParticipant(SQLModel, table=True):
    """Join table: which participants attended which meeting."""

    __tablename__ = "meeting_participants"

    meeting_id: int = Field(foreign_key="meetings.id", primary_key=True, ondelete="CASCADE")
    participant_id: int = Field(
        foreign_key="participants.id", primary_key=True, ondelete="CASCADE", index=True
    )
    is_host: bool = False

    meeting: "Meeting" = Relationship(back_populates="participant_links")
    participant: Participant = Relationship(back_populates="meeting_links")


class Meeting(SQLModel, table=True):
    __tablename__ = "meetings"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    title: str = Field(index=True)
    date: datetime = Field(index=True)  # when the meeting happened (sort key)
    duration_sec: int = 0
    language: str = "English (Global)"
    source: str = "seed"  # seed | upload | paste | form
    platform: str = "google_meet"  # google_meet | zoom | teams | upload
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    owner: User = Relationship(back_populates="meetings")
    participant_links: list[MeetingParticipant] = Relationship(
        back_populates="meeting", cascade_delete=True
    )
    segments: list["TranscriptSegment"] = Relationship(
        back_populates="meeting",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "TranscriptSegment.seq"},
    )
    summary: Optional["Summary"] = Relationship(
        back_populates="meeting",
        cascade_delete=True,
        sa_relationship_kwargs={"uselist": False},
    )
    note_sections: list["NoteSection"] = Relationship(
        back_populates="meeting",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "NoteSection.seq"},
    )
    action_items: list["ActionItem"] = Relationship(
        back_populates="meeting",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "ActionItem.id"},
    )


class TranscriptSegment(SQLModel, table=True):
    """One utterance: a speaker talking from start_sec to end_sec."""

    __tablename__ = "transcript_segments"
    __table_args__ = (Index("ix_segments_meeting_seq", "meeting_id", "seq"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: int = Field(foreign_key="meetings.id", ondelete="CASCADE")
    speaker_id: Optional[int] = Field(
        default=None, foreign_key="participants.id", ondelete="SET NULL"
    )
    seq: int  # order within the meeting
    start_sec: float
    end_sec: float
    text: str
    sentiment: str = "neutral"  # positive | neutral | negative
    category: Optional[str] = None  # question | task | metric | date | pricing

    meeting: Meeting = Relationship(back_populates="segments")
    speaker: Optional[Participant] = Relationship()


class Summary(SQLModel, table=True):
    """AI summary (seeded or heuristic). 1:1 with meeting."""

    __tablename__ = "summaries"

    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: int = Field(foreign_key="meetings.id", unique=True, ondelete="CASCADE")
    # [{"emoji": "📊", "title": "Dashboard Overview", "text": "..."}]
    overview: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    keywords: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    generated_by: str = "seed"  # seed | heuristic | ai

    meeting: Meeting = Relationship(back_populates="summary")


class NoteSection(SQLModel, table=True):
    """'Notes' outline: a titled chapter with a short paragraph + bullets."""

    __tablename__ = "note_sections"

    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: int = Field(foreign_key="meetings.id", ondelete="CASCADE", index=True)
    seq: int
    title: str
    summary: str
    start_sec: float

    meeting: Meeting = Relationship(back_populates="note_sections")
    bullets: list["NoteBullet"] = Relationship(
        back_populates="section",
        cascade_delete=True,
        sa_relationship_kwargs={"order_by": "NoteBullet.seq"},
    )


class NoteBullet(SQLModel, table=True):
    __tablename__ = "note_bullets"

    id: Optional[int] = Field(default=None, primary_key=True)
    section_id: int = Field(foreign_key="note_sections.id", ondelete="CASCADE", index=True)
    seq: int
    text: str
    start_sec: float

    section: NoteSection = Relationship(back_populates="bullets")


class ActionItem(SQLModel, table=True):
    __tablename__ = "action_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    meeting_id: int = Field(foreign_key="meetings.id", ondelete="CASCADE", index=True)
    assignee_id: Optional[int] = Field(
        default=None, foreign_key="participants.id", ondelete="SET NULL"
    )
    text: str
    details: list[str] = Field(default_factory=list, sa_column=Column(JSON))  # sub-bullets
    start_sec: Optional[float] = None  # timestamp link into the transcript
    is_completed: bool = False
    # Who owns the item: seed | heuristic | ai (auto-generated) or user (added/edited by a person).
    # "Regenerate with AI" only replaces auto-generated items nobody has touched.
    source: str = "user"
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    meeting: Meeting = Relationship(back_populates="action_items")
    assignee: Optional[Participant] = Relationship()
