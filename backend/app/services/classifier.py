"""Tiny rule-based tagger standing in for Fireflies' "AI Filters" and
sentiment. Deterministic, no ML dependency. Seed data can override it."""
import re

POSITIVE = {
    "great", "good", "love", "awesome", "excellent", "perfect", "happy", "excited",
    "nice", "amazing", "thanks", "thank", "glad", "agree", "works", "helpful",
    "fantastic", "impressive", "smooth", "win", "solid", "congrats",
}
NEGATIVE = {
    "problem", "issue", "bug", "blocked", "blocker", "concern", "worried", "bad",
    "broken", "fail", "failed", "delay", "delayed", "risk", "difficult", "frustrated",
    "expensive", "slow", "outage", "unfortunately", "churn", "complaint", "wrong",
}

TASK = re.compile(
    r"\b(i'll|i will|we'll|we will|let's|need to|needs to|should|follow up|action item|"
    r"can you|could you|please|take care of|own this|send (over|you|the))\b",
    re.I,
)
PRICING = re.compile(r"(\$\s?\d|\b(price|pricing|cost|budget|discount|per seat|license|invoice|contract)\b)", re.I)
METRIC = re.compile(
    r"(\d[\d,]*(\.\d+)?\s?(%|percent|k\b|x\b|ms\b|milliseconds|seconds|minutes|hours|"
    r"(engineer-)?weeks|gigabytes|gb\b|rows|users|customers|signups|demos|accounts|tickets|points))",
    re.I,
)
DATE = re.compile(
    r"\b(monday|tuesday|wednesday|thursday|friday|tomorrow|next week|end of (the )?(week|month|quarter)|"
    r"eod|q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|"
    r"\d{1,2}(st|nd|rd|th))\b",
    re.I,
)


def sentiment(text: str) -> str:
    words = re.findall(r"[a-z']+", text.lower())
    score = sum(w in POSITIVE for w in words) - sum(w in NEGATIVE for w in words)
    return "positive" if score > 0 else "negative" if score < 0 else "neutral"


def category(text: str) -> str | None:
    """Most specific first: pricing > metric > question > task > date."""
    if PRICING.search(text):
        return "pricing"
    if METRIC.search(text):
        return "metric"
    if text.rstrip().endswith("?"):
        return "question"
    if TASK.search(text):
        return "task"
    if DATE.search(text):
        return "date"
    return None


def is_action_sentence(text: str) -> bool:
    return bool(TASK.search(text)) and not text.rstrip().endswith("?")
