"""Parse an uploaded/pasted transcript into speaker segments.

Supported formats (auto-detected):
  1. JSON   [{"speaker": "Alice", "start": 12.5, "end": 15, "text": "..."}, ...]
  2. WebVTT 00:00:01.000 --> 00:00:04.000  then  "<v Alice>text" or "Alice: text"
  3. Text   "[00:01:23] Alice: text"  /  "01:23 Alice: text"  /  "(1:23) Alice: text"
  4. Text without timestamps "Alice: text" -> times estimated at ~150 words/min
"""
import json
import re
from dataclasses import dataclass

WORDS_PER_SEC = 2.5  # ~150 wpm, used when a transcript has no timestamps


@dataclass
class ParsedSegment:
    speaker: str
    start: float
    end: float
    text: str


class TranscriptParseError(ValueError):
    pass


def to_seconds(ts: str) -> float:
    """'1:02:03.5' | '02:03' | '02:03,500' -> seconds"""
    parts = ts.replace(",", ".").split(":")
    secs = 0.0
    for p in parts:
        secs = secs * 60 + float(p)
    return secs


def _speech_secs(text: str) -> float:
    return max(1.5, len(text.split()) / WORDS_PER_SEC)


def _fill_end_times(segs: list[ParsedSegment]) -> list[ParsedSegment]:
    """Segments without an explicit end run until the next segment starts."""
    for i, s in enumerate(segs):
        if s.end <= s.start:
            nxt = segs[i + 1].start if i + 1 < len(segs) else None
            s.end = nxt if nxt and nxt > s.start else s.start + _speech_secs(s.text)
    return segs


# ---------- JSON ----------
def _parse_json(raw: str) -> list[ParsedSegment]:
    data = json.loads(raw)
    if isinstance(data, dict):  # allow {"segments": [...]}
        data = data.get("segments") or data.get("transcript") or []
    segs = []
    for item in data:
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        start = item.get("start", item.get("start_sec", 0)) or 0
        start = to_seconds(start) if isinstance(start, str) else float(start)
        end = item.get("end", item.get("end_sec", 0)) or 0
        end = to_seconds(end) if isinstance(end, str) else float(end)
        segs.append(ParsedSegment(str(item.get("speaker") or "Speaker 1"), start, end, text))
    return segs


# ---------- VTT ----------
VTT_CUE = re.compile(r"(\d{1,2}:?\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:?\d{2}:\d{2}[.,]\d{3})")
VTT_VOICE = re.compile(r"^<v\s+([^>]+)>(.*?)(?:</v>)?$")
SPEAKER_PREFIX = re.compile(r"^([A-Z][\w .'\-|]{0,60}?):\s+(.+)$")


def _parse_vtt(raw: str) -> list[ParsedSegment]:
    segs: list[ParsedSegment] = []
    blocks = re.split(r"\n\s*\n", raw.strip())
    for block in blocks:
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        cue_idx = next((i for i, l in enumerate(lines) if VTT_CUE.search(l)), None)
        if cue_idx is None:
            continue
        m = VTT_CUE.search(lines[cue_idx])
        start, end = to_seconds(m.group(1)), to_seconds(m.group(2))
        body = " ".join(lines[cue_idx + 1 :])
        speaker = "Speaker 1"
        if vm := VTT_VOICE.match(body):
            speaker, body = vm.group(1).strip(), vm.group(2).strip()
        elif sm := SPEAKER_PREFIX.match(body):
            speaker, body = sm.group(1).strip(), sm.group(2).strip()
        body = re.sub(r"<[^>]+>", "", body).strip()
        if not body:
            continue
        # merge consecutive cues from the same speaker into one utterance
        if segs and segs[-1].speaker == speaker and start - segs[-1].end < 2:
            segs[-1].text += " " + body
            segs[-1].end = end
        else:
            segs.append(ParsedSegment(speaker, start, end, body))
    return segs


# ---------- plain text ----------
TEXT_LINE = re.compile(
    r"^[\[(]?(?P<ts>\d{1,2}:\d{2}(?::\d{2})?)[\])]?\s*[-–]?\s*"
    r"(?P<speaker>[^:]{1,60}):\s*(?P<text>.+)$"
)


def _parse_text(raw: str) -> list[ParsedSegment]:
    lines = [l.strip() for l in raw.splitlines() if l.strip()]
    if not any(TEXT_LINE.match(l) or SPEAKER_PREFIX.match(l) for l in lines):
        raise TranscriptParseError(
            'No speaker lines found. Use "Speaker: text" or "[00:01:23] Speaker: text" per line.'
        )
    segs: list[ParsedSegment] = []
    clock = 0.0
    for line in lines:
        if m := TEXT_LINE.match(line):
            start = to_seconds(m.group("ts"))
            segs.append(ParsedSegment(m.group("speaker").strip(), start, 0, m.group("text").strip()))
            clock = start + _speech_secs(m.group("text"))
        elif m := SPEAKER_PREFIX.match(line):
            text = m.group(2).strip()
            segs.append(ParsedSegment(m.group(1).strip(), clock, clock + _speech_secs(text), text))
            clock += _speech_secs(text)
        elif segs:  # continuation of the previous speaker's line
            segs[-1].text += " " + line
            if segs[-1].end:
                segs[-1].end += _speech_secs(line)
                clock = segs[-1].end
        else:
            segs.append(ParsedSegment("Speaker 1", clock, clock + _speech_secs(line), line))
            clock += _speech_secs(line)
    return segs


def parse_transcript(raw: str, filename: str = "") -> list[ParsedSegment]:
    raw = raw.lstrip("﻿").strip()
    if not raw:
        raise TranscriptParseError("Transcript is empty")

    name = filename.lower()
    # "[00:01:23] Alice: hi" also starts with "[", so only treat it as JSON if it parses
    looks_json = name.endswith(".json")
    if not looks_json and raw[:1] in "[{":
        try:
            json.loads(raw)
            looks_json = True
        except json.JSONDecodeError:
            pass
    try:
        if looks_json:
            segs = _parse_json(raw)
        elif name.endswith(".vtt") or raw.startswith("WEBVTT") or VTT_CUE.search(raw):
            segs = _parse_vtt(raw)
        else:
            segs = _parse_text(raw)
    except TranscriptParseError:
        raise
    except (json.JSONDecodeError, AttributeError, TypeError, ValueError) as e:
        raise TranscriptParseError(f"Could not parse transcript: {e}") from e

    if not segs:
        raise TranscriptParseError("No transcript lines found")
    segs.sort(key=lambda s: s.start)
    return _fill_end_times(segs)
