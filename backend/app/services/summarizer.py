"""Heuristic "AI" summary for uploaded meetings (no LLM, per assignment scope).

Seeded meetings ship hand-written summaries; this only runs for meetings
created via upload/paste so they don't show an empty Notes panel.
Swap `summarize()` for an LLM call later without touching the routers.
"""
import re
from collections import Counter
from dataclasses import dataclass, field

from .classifier import is_action_sentence

STOPWORDS = set(
    """a about above after again against all am an and any are as at be because been before
    being below between both but by can could did do does doing down during each few for from
    further had has have having he her here hers herself him himself his how i if in into is it
    its itself just me more most my myself no nor not now of off on once only or other our ours
    ourselves out over own same she should so some such than that the their theirs them
    themselves then there these they this those through to too under until up very was we were
    what when where which while who whom why will with you your yours yourself yourselves yeah
    okay ok yes um uh like know think going get got really right well also one would want
    thing things kind sort lot let's i'm it's that's we're you're don't i'll we'll can't gonna
    maybe sure actually just mean said say see go make made need good great thanks thank""".split()
)


@dataclass
class Line:
    speaker_id: int | None
    speaker_name: str
    start: float
    text: str


@dataclass
class SummaryResult:
    overview: list[dict] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    sections: list[dict] = field(default_factory=list)  # {title, summary, start_sec, bullets:[{text,start_sec}]}
    # {text, start_sec, details?} + either assignee_id (heuristic) or assignee_name (AI, resolved on save)
    action_items: list[dict] = field(default_factory=list)


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.split()) >= 4]


def _top_words(texts: list[str], n: int) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z\-]{3,}", " ".join(texts).lower())
    return [w for w, _ in Counter(w for w in words if w not in STOPWORDS).most_common(n)]


def _clip(s: str, n: int = 160) -> str:
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "…"


def summarize(lines: list[Line], n_sections: int = 3) -> SummaryResult:
    if not lines:
        return SummaryResult()
    res = SummaryResult()
    res.keywords = [w.title() for w in _top_words([l.text for l in lines], 6)]

    # Split the meeting into roughly equal chunks -> "Notes" chapters
    n_sections = max(1, min(n_sections, len(lines) // 3 or 1))
    size = -(-len(lines) // n_sections)  # ceil division
    for i in range(0, len(lines), size):
        chunk = lines[i : i + size]
        topic = " & ".join(w.title() for w in _top_words([l.text for l in chunk], 2)) or "Discussion"
        sents = [(l, s) for l in chunk for s in _sentences(l.text)]
        longest = sorted(sents, key=lambda ls: len(ls[1]), reverse=True)[:3]
        longest.sort(key=lambda ls: ls[0].start)
        res.sections.append(
            {
                "title": topic,
                "summary": _clip(sents[0][1]) if sents else _clip(chunk[0].text),
                "start_sec": chunk[0].start,
                "bullets": [
                    {"text": f"{l.speaker_name} noted: {_clip(s)}", "start_sec": l.start}
                    for l, s in longest
                ],
            }
        )

    # Overview = one bullet per chapter
    emojis = ["📌", "💡", "✅", "📈", "🗓️"]
    res.overview = [
        {"emoji": emojis[i % len(emojis)], "title": s["title"], "text": s["summary"]}
        for i, s in enumerate(res.sections)
    ]

    # Action items = "I'll / we need to / can you ..." sentences
    for l in lines:
        for s in _sentences(l.text):
            if is_action_sentence(s) and len(res.action_items) < 8:
                res.action_items.append(
                    {"text": _clip(s, 200), "assignee_id": l.speaker_id, "start_sec": l.start}
                )
    return res
