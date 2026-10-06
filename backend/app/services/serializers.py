"""ORM model -> API schema conversion, kept in one place."""
from ..models import ActionItem, Meeting, Participant, TranscriptSegment
from ..schemas import (
    ActionItemOut,
    MeetingDetail,
    MeetingListItem,
    NoteBulletOut,
    NoteSectionOut,
    OverviewBullet,
    ParticipantOut,
    SegmentOut,
    SummaryOut,
)


def participant_out(p: Participant, is_host: bool = False) -> ParticipantOut:
    return ParticipantOut(
        id=p.id, name=p.name, email=p.email, avatar_color=p.avatar_color, is_host=is_host
    )


def _participants(m: Meeting) -> tuple[ParticipantOut | None, list[ParticipantOut]]:
    people = [participant_out(l.participant, l.is_host) for l in m.participant_links]
    people.sort(key=lambda p: (not p.is_host, p.name))
    host = next((p for p in people if p.is_host), people[0] if people else None)
    return host, people


def action_item_out(a: ActionItem, with_meeting_title: bool = False) -> ActionItemOut:
    return ActionItemOut(
        id=a.id,
        meeting_id=a.meeting_id,
        meeting_title=a.meeting.title if with_meeting_title else None,
        text=a.text,
        details=a.details or [],
        start_sec=a.start_sec,
        is_completed=a.is_completed,
        assignee=participant_out(a.assignee) if a.assignee else None,
        created_at=a.created_at,
    )


def meeting_list_item(m: Meeting) -> MeetingListItem:
    host, people = _participants(m)
    return MeetingListItem(
        id=m.id,
        title=m.title,
        date=m.date,
        duration_sec=m.duration_sec,
        source=m.source,
        platform=m.platform,
        host=host,
        participants=people,
        action_items_total=len(m.action_items),
        action_items_open=sum(not a.is_completed for a in m.action_items),
        overview_preview=(m.summary.overview[:4] if m.summary else []),
    )


def meeting_detail(m: Meeting) -> MeetingDetail:
    host, people = _participants(m)
    summary = None
    if m.summary:
        summary = SummaryOut(
            overview=[OverviewBullet(**b) for b in m.summary.overview],
            keywords=m.summary.keywords,
            generated_by=m.summary.generated_by,
        )
    return MeetingDetail(
        id=m.id,
        title=m.title,
        date=m.date,
        duration_sec=m.duration_sec,
        language=m.language,
        source=m.source,
        platform=m.platform,
        host=host,
        participants=people,
        summary=summary,
        notes=[
            NoteSectionOut(
                id=s.id,
                title=s.title,
                summary=s.summary,
                start_sec=s.start_sec,
                bullets=[NoteBulletOut(id=b.id, text=b.text, start_sec=b.start_sec) for b in s.bullets],
            )
            for s in m.note_sections
        ],
        action_items=[action_item_out(a) for a in m.action_items],
    )


def segment_out(s: TranscriptSegment) -> SegmentOut:
    return SegmentOut(
        id=s.id,
        seq=s.seq,
        start_sec=s.start_sec,
        end_sec=s.end_sec,
        text=s.text,
        sentiment=s.sentiment,
        category=s.category,
        speaker=participant_out(s.speaker) if s.speaker else None,
    )
