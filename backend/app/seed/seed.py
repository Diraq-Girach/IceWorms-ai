"""Seed the database from seed_data.json.

Run manually:   python -m app.seed.seed            (only if empty)
                python -m app.seed.seed --reset    (wipe + reseed)
Also runs automatically on startup when SEED_ON_STARTUP=true and the DB is empty.

Meeting dates are stored as `days_ago`, so the demo always looks recent.
"""
import hashlib
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlmodel import Session, SQLModel, select

from ..db import create_db_and_tables, engine
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
    utcnow,
)
from ..services import classifier
from ..services.meetings import AVATAR_COLORS

DATA_FILE = Path(__file__).with_name("seed_data.json")


def _speaking_rate(name: str) -> float:
    """Words/second per speaker (2.6–3.5 ≈ 156–210 WPM) so talktime/WPM vary realistically."""
    return 2.6 + (int(hashlib.md5(name.encode()).hexdigest(), 16) % 10) / 10


def seed(session: Session) -> None:
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    u = data["user"]
    user = User(name=u["name"], email=u["email"], avatar_color=u["avatar_color"])
    session.add(user)

    # key -> Participant (the default user is also a participant so they can speak / own tasks)
    people: dict[str, Participant] = {
        u["key"]: Participant(name=u["name"], email=u["email"], avatar_color=u["avatar_color"])
    }
    session.add(people[u["key"]])

    now = utcnow()
    for m in data["meetings"]:
        for p in m["participants"]:
            if p["key"] not in people:
                # distinct colours in seed order (hash-based colours can collide)
                color = AVATAR_COLORS[len(people) % len(AVATAR_COLORS)]
                people[p["key"]] = Participant(name=p["name"], email=p.get("email"), avatar_color=color)
                session.add(people[p["key"]])
        session.flush()

        hh, mm = map(int, m["time"].split(":"))
        date = (now - timedelta(days=m["days_ago"])).replace(hour=hh, minute=mm, second=0, microsecond=0)
        duration = m["duration_min"] * 60
        if date + timedelta(seconds=duration) > now:  # don't seed meetings "in the future"
            date = now - timedelta(seconds=duration + 600)

        meeting = Meeting(
            owner_id=1, title=m["title"], date=date, duration_sec=duration,
            platform=m.get("platform", "google_meet"), source="seed",
            created_at=date, updated_at=date,
        )
        session.add(meeting)
        session.flush()

        for p in m["participants"]:
            session.add(MeetingParticipant(
                meeting_id=meeting.id, participant_id=people[p["key"]].id, is_host=p.get("host", False)
            ))

        segs = m["segments"]
        for i, seg in enumerate(segs):
            start, key, text = seg[0], seg[1], seg[2]
            speaker = people[key]
            next_start = segs[i + 1][0] if i + 1 < len(segs) else duration
            end = min(start + len(text.split()) / _speaking_rate(speaker.name), next_start - 0.5)
            session.add(TranscriptSegment(
                meeting_id=meeting.id, speaker_id=speaker.id, seq=i,
                start_sec=float(start), end_sec=round(max(end, start + 1), 2), text=text,
                sentiment=seg[3] if len(seg) > 3 else classifier.sentiment(text),
                category=classifier.category(text),
            ))

        s = m["summary"]
        session.add(Summary(meeting_id=meeting.id, overview=s["overview"], keywords=s["keywords"], generated_by="seed"))

        for i, n in enumerate(m["notes"]):
            sec = NoteSection(meeting_id=meeting.id, seq=i, title=n["title"], summary=n["summary"], start_sec=n["start"])
            session.add(sec)
            session.flush()
            for j, (text, t) in enumerate(n["bullets"]):
                session.add(NoteBullet(section_id=sec.id, seq=j, text=text, start_sec=t))

        for a in m["action_items"]:
            session.add(ActionItem(
                meeting_id=meeting.id, assignee_id=people[a["assignee"]].id, text=a["text"],
                details=a.get("details", []), start_sec=a.get("start"), is_completed=a.get("done", False),
                created_at=date, updated_at=date,
            ))

    session.commit()


def seed_if_empty() -> bool:
    with Session(engine) as session:
        if session.exec(select(User)).first():
            return False
        seed(session)
        return True


def reset_and_seed() -> None:
    SQLModel.metadata.drop_all(engine)
    create_db_and_tables()
    with Session(engine) as session:
        seed(session)


if __name__ == "__main__":
    create_db_and_tables()
    if "--reset" in sys.argv:
        reset_and_seed()
        print("Database reset and seeded.")
    else:
        print("Seeded." if seed_if_empty() else "Database already has data; use --reset to reseed.")
