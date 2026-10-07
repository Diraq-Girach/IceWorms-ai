"""Business logic for creating/updating meetings (routers stay thin)."""
import hashlib
import logging
import math
from datetime import datetime

from sqlalchemy import func
from sqlmodel import Session, delete, select

from ..models import (
    ActionItem,
    Meeting,
    MeetingParticipant,
    NoteBullet,
    NoteSection,
    Participant,
    Summary,
    TranscriptSegment,
    User,
    as_utc,
    utcnow,
)
from ..schemas import ParticipantIn
from . import ai, classifier
from .llm import LLMError, llm_enabled
from .summarizer import Line, SummaryResult, summarize
from .transcript_parser import ParsedSegment

log = logging.getLogger("iceworms.meetings")

AVATAR_COLORS = [
    "#F97316", "#7C3AED", "#10B981", "#EC4899", "#3B82F6",
    "#EAB308", "#14B8A6", "#EF4444", "#8B5CF6", "#06B6D4",
]


def color_for(name: str) -> str:
    """Stable avatar colour per name (same person -> same colour everywhere)."""
    idx = int(hashlib.md5(name.lower().encode()).hexdigest(), 16) % len(AVATAR_COLORS)
    return AVATAR_COLORS[idx]


def get_default_user(session: Session) -> User:
    """Auth is out of scope: everything belongs to the single seeded user."""
    user = session.exec(select(User).order_by(User.id)).first()
    if not user:
        raise RuntimeError("No default user; database not seeded")
    return user


def get_or_create_participant(session: Session, name: str, email: str | None = None) -> Participant:
    """Find or create a person. Email is the identity when given; names match case-insensitively.

    - email matches an existing person                -> that person
    - name matches someone who has no email yet       -> that person, and the email is attached
    - name matches, but that person has another email -> a different person (new row)
    - no email given                                  -> first person with that name, else new
    """
    name = name.strip()
    email = (email or "").strip().lower() or None

    if email:
        by_email = session.exec(select(Participant).where(Participant.email == email)).first()
        if by_email:
            return by_email

    same_name = session.exec(
        select(Participant).where(func.lower(Participant.name) == name.lower()).order_by(Participant.id)
    ).all()
    if email:
        unclaimed = next((p for p in same_name if p.email is None), None)
        if unclaimed:
            unclaimed.email = email  # e.g. a transcript speaker getting their email via "Edit meeting"
            session.add(unclaimed)
            return unclaimed
    elif same_name:
        return same_name[0]

    p = Participant(name=name, email=email, avatar_color=color_for(name))
    session.add(p)
    session.flush()  # assign id
    return p


def set_participants(
    session: Session, meeting: Meeting, people: list[ParticipantIn], host_name: str | None = None
) -> list[Participant]:
    """Replace the meeting's participant list (keeps speakers referenced by segments).
    Returns the participants in order, de-duplicated."""
    session.exec(delete(MeetingParticipant).where(MeetingParticipant.meeting_id == meeting.id))
    session.expire(meeting, ["participant_links"])  # drop the stale loaded collection
    seen: set[int] = set()
    result: list[Participant] = []
    for i, person in enumerate(people):
        p = get_or_create_participant(session, person.name, person.email)
        if p.id in seen:
            continue
        seen.add(p.id)
        result.append(p)
        is_host = person.name.strip().lower() == host_name.strip().lower() if host_name else i == 0
        session.add(MeetingParticipant(meeting_id=meeting.id, participant_id=p.id, is_host=is_host))
    return result


def create_meeting(
    session: Session,
    *,
    title: str,
    date: datetime | None,
    participants: list[ParticipantIn],
    segments: list[ParsedSegment],
    duration_sec: int | None,
    language: str,
    source: str,
) -> Meeting:
    user = get_default_user(session)
    key = lambda n: n.strip().lower()  # noqa: E731  (names compare case-insensitively)

    # Participants = explicitly given ones + every speaker found in the transcript.
    # The default user hosts meetings they create.
    names = {key(p.name) for p in participants}
    people = [ParticipantIn(name=user.name, email=user.email)] + [
        p for p in participants if key(p.name) != key(user.name)
    ]
    for s in segments:
        if key(s.speaker) not in names and key(s.speaker) != key(user.name):
            names.add(key(s.speaker))
            people.append(ParticipantIn(name=s.speaker))

    duration = duration_sec or (math.ceil(segments[-1].end) if segments else 0)
    when = as_utc(date) if date else utcnow()

    # AI notes are generated BEFORE any write, so a slow model call never holds
    # SQLite's write lock. Any failure falls back to the rule-based summarizer below.
    ai_notes: SummaryResult | None = None
    if segments and llm_enabled():
        display = {}
        for p in people:
            display.setdefault(key(p.name), p.name.strip())
        ctx = ai.MeetingContext(
            title=title.strip(),
            date_label=when.strftime("%a %d %b %Y"),
            duration_sec=duration,
            participants=list(display.values()),
            lines=[ai.TranscriptLine(s.start, display.get(key(s.speaker), s.speaker), s.text) for s in segments],
        )
        try:
            ai_notes = ai.generate_notes(ctx)
        except LLMError as e:
            log.warning("AI notes failed, using rule-based summary instead: %s", e)

    meeting = Meeting(
        owner_id=user.id,
        title=title.strip(),
        date=when,
        duration_sec=duration,
        language=language,
        source=source,
        platform="upload" if source == "upload" else "google_meet",
    )
    session.add(meeting)
    session.flush()

    attendees = set_participants(session, meeting, people, host_name=user.name)

    # Speakers resolve to THIS meeting's attendees first (so "zoe park" in the transcript
    # links to the "Zoe Park <zoe@acme.com>" added in the form, even if another Zoe exists)
    by_name = {}
    for p in attendees:
        by_name.setdefault(key(p.name), p)

    lines: list[Line] = []
    for i, s in enumerate(segments):
        speaker = by_name.get(key(s.speaker)) or get_or_create_participant(session, s.speaker)
        session.add(
            TranscriptSegment(
                meeting_id=meeting.id,
                speaker_id=speaker.id,
                seq=i,
                start_sec=round(s.start, 2),
                end_sec=round(s.end, 2),
                text=s.text,
                sentiment=classifier.sentiment(s.text),
                category=classifier.category(s.text),
            )
        )
        lines.append(Line(speaker.id, speaker.name, s.start, s.text))

    if ai_notes:
        attach_summary(session, meeting, ai_notes, "ai", by_name)
    elif lines:
        attach_summary(session, meeting, summarize(lines), "heuristic", by_name)
    session.commit()
    session.refresh(meeting)
    return meeting


def attach_summary(
    session: Session,
    meeting: Meeting,
    result: SummaryResult,
    generated_by: str,
    people_by_name: dict[str, Participant],
    skip_texts: set[str] = frozenset(),
) -> None:
    """Save a summary, its note sections and its action items for `meeting`.
    Action items whose text is in `skip_texts` (already present) are not duplicated."""
    session.add(
        Summary(
            meeting_id=meeting.id,
            overview=result.overview,
            keywords=result.keywords,
            generated_by=generated_by,
        )
    )
    for i, sec in enumerate(result.sections):
        ns = NoteSection(
            meeting_id=meeting.id, seq=i, title=sec["title"], summary=sec["summary"], start_sec=sec["start_sec"]
        )
        session.add(ns)
        session.flush()
        for j, b in enumerate(sec["bullets"]):
            session.add(NoteBullet(section_id=ns.id, seq=j, text=b["text"], start_sec=b["start_sec"]))
    for a in result.action_items:
        if a["text"].strip().lower() in skip_texts:
            continue
        assignee_id = a.get("assignee_id")
        if assignee_id is None and a.get("assignee_name"):
            person = people_by_name.get(a["assignee_name"].strip().lower())
            assignee_id = person.id if person else None
        session.add(
            ActionItem(
                meeting_id=meeting.id,
                text=a["text"],
                assignee_id=assignee_id,
                start_sec=a.get("start_sec"),
                details=a.get("details", []),
                source=generated_by,
            )
        )


# ---------------------------------------------------------------- AI ------------


def meeting_context(meeting: Meeting) -> ai.MeetingContext:
    """Everything the model needs about a saved meeting (read-only)."""
    return ai.MeetingContext(
        title=meeting.title,
        date_label=meeting.date.strftime("%a %d %b %Y"),
        duration_sec=meeting.duration_sec,
        participants=[link.participant.name for link in meeting.participant_links],
        lines=[
            ai.TranscriptLine(s.start_sec, s.speaker.name if s.speaker else "Unknown", s.text)
            for s in meeting.segments
        ],
    )


def regenerate_notes(session: Session, meeting: Meeting) -> Meeting:
    """Replace a meeting's summary + notes with fresh AI notes.

    Action items people own are kept: anything added or edited by a user (source="user")
    and anything already completed. Only untouched auto-generated items are replaced.
    Raises LLMError (before changing anything) if the model call fails.
    """
    result = ai.generate_notes(meeting_context(meeting))  # slow part: no writes yet

    if meeting.summary:
        session.delete(meeting.summary)
    for section in meeting.note_sections:
        session.delete(section)  # bullets go with it (cascade)
    kept = []
    for item in meeting.action_items:
        if item.source == "user" or item.is_completed:
            kept.append(item)
        else:
            session.delete(item)
    session.flush()  # deletes must land before inserts (summaries.meeting_id is unique)
    session.expire(meeting, ["summary", "note_sections", "action_items"])  # drop references to deleted rows

    by_name = {link.participant.name.strip().lower(): link.participant for link in meeting.participant_links}
    attach_summary(session, meeting, result, "ai", by_name, skip_texts={k.text.strip().lower() for k in kept})
    meeting.updated_at = utcnow()
    session.add(meeting)
    session.commit()
    session.refresh(meeting)
    return meeting
