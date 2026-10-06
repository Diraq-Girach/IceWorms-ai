"""Derived meeting analytics: speaker talktime/WPM, sentiment mix, AI-filter counts.
Computed on read from transcript segments (cheap at this scale; would be cached
or materialised if transcripts got large)."""
from collections import Counter, defaultdict

from ..models import TranscriptSegment
from ..schemas import AnalyticsOut, SpeakerStat
from .serializers import participant_out


def compute_analytics(segments: list[TranscriptSegment]) -> AnalyticsOut:
    talk: dict[int, float] = defaultdict(float)
    words: dict[int, int] = defaultdict(int)
    speakers = {}
    for s in segments:
        if s.speaker is None:
            continue
        speakers[s.speaker.id] = s.speaker
        talk[s.speaker.id] += max(0.0, s.end_sec - s.start_sec)
        words[s.speaker.id] += len(s.text.split())

    total_talk = sum(talk.values()) or 1.0
    stats = [
        SpeakerStat(
            speaker=participant_out(speakers[pid]),
            talk_sec=round(talk[pid], 1),
            talktime_pct=round(100 * talk[pid] / total_talk, 1),
            words=words[pid],
            wpm=round(words[pid] / (talk[pid] / 60)) if talk[pid] else 0,
        )
        for pid in speakers
    ]
    stats.sort(key=lambda s: s.talk_sec, reverse=True)

    n = len(segments) or 1
    sent = Counter(s.sentiment for s in segments)
    sentiments = {k: round(100 * sent.get(k, 0) / n, 1) for k in ("neutral", "positive", "negative")}
    cats = Counter(s.category for s in segments if s.category)
    categories = {k: cats.get(k, 0) for k in ("date", "metric", "question", "task", "pricing")}

    return AnalyticsOut(speakers=stats, sentiments=sentiments, categories=categories)
