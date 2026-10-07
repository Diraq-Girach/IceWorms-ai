"""AI features against a fake OpenAI-compatible provider (no network, no API key needed)."""
import json

import httpx
import pytest

from app.services import llm


class FakeLLM:
    """Stands in for the provider. `reply` is the assistant message content to return
    (a dict is JSON-encoded); `status` simulates HTTP errors. Records every request."""

    def __init__(self, reply="{}", status=200, reject_json_mode=False):
        self.reply, self.status, self.reject_json_mode = reply, status, reject_json_mode
        self.reject_field: str | None = None  # simulate a provider that 400s on this request field
        self.json_validate_fail = False  # simulate Groq rejecting cut-off JSON output
        self.queue: list[tuple[str, str]] = []  # (content, finish_reason) served first, in order
        self.requests: list[dict] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.requests.append(body)
        if self.reject_json_mode and "response_format" in body:
            return httpx.Response(400, json={"error": "response_format not supported"})
        if self.json_validate_fail and "response_format" in body:
            return httpx.Response(400, json={"error": {
                "message": "Failed to generate JSON. Please adjust your prompt.",
                "type": "invalid_request_error", "code": "json_validate_failed",
                "failed_generation": '{"overview": [{"emoji": "x", "title": "cut off mid'}})
        if self.reject_field and self.reject_field in body:
            return httpx.Response(400, json={"error": f"{self.reject_field} not supported"})
        if self.status != 200:
            return httpx.Response(self.status, json={"error": "nope"})
        if self.queue:
            content, finish = self.queue.pop(0)
        else:
            content, finish = (self.reply if isinstance(self.reply, str) else json.dumps(self.reply)), "stop"
        message = {"role": "assistant", "content": content, "reasoning": "thinking..."}
        return httpx.Response(200, json={
            "choices": [{"message": message, "finish_reason": finish}],
            "usage": {"completion_tokens": 123},
        })


@pytest.fixture
def fake_llm(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "fake-model")
    monkeypatch.setenv("LLM_BASE_URL", "https://fake.example/v1")
    monkeypatch.setattr(llm, "_transport", httpx.MockTransport(fake.handler))
    return fake


NOTES = {
    "overview": [
        {"emoji": "🎯", "title": "Budget agreed", "text": "The team agreed the Q4 budget."},
        {"emoji": "⚠️", "title": "Risk", "text": "Vendor delay could slip launch."},
    ],
    "keywords": ["Budget", "Launch"],
    "sections": [
        {
            "title": "Budget",
            "summary": "Budget discussion.",
            "start": "00:05",
            "bullets": [{"text": "Zoe wants it final by Friday", "start": "[00:06]"}],
        }
    ],
    "action_items": [
        {"text": "Send the budget numbers", "assignee": "alex", "start": "00:21", "details": ["Include Q3 actuals"]},
        {"text": "Book vendor call", "assignee": "Someone Else", "start": "99:99"},
        {"text": "Send the budget numbers", "assignee": "Alex Carter", "start": "00:21"},  # duplicate
    ],
}

TRANSCRIPT = "[00:00:05] Zoe Park: We need to finalize the budget by Friday.\n[00:00:20] Alex Carter: I'll send the numbers tomorrow."


def test_status_reports_disabled_without_key(client):
    assert client.get("/api/ai/status").json() == {"enabled": False, "model": None}


def test_status_enabled(client, fake_llm):
    assert client.get("/api/ai/status").json() == {"enabled": True, "model": "fake-model"}


def test_create_uses_ai_notes_validated_and_mapped(client, fake_llm):
    fake_llm.reply = NOTES
    m = client.post("/api/meetings", json={"title": "Budget", "transcript_text": TRANSCRIPT}).json()

    assert m["summary"]["generated_by"] == "ai"
    assert [b["title"] for b in m["summary"]["overview"]] == ["Budget agreed", "Risk"]
    assert m["notes"][0]["bullets"][0]["start_sec"] == 5.0  # "[00:06]" snapped to the real line at 0:05

    items = m["action_items"]
    assert len(items) == 2  # duplicate dropped
    send = next(a for a in items if a["text"] == "Send the budget numbers")
    assert send["assignee"]["name"] == "Alex Carter"  # "alex" -> unique first-name match
    assert send["source"] == "ai" and send["details"] == ["Include Q3 actuals"]
    book = next(a for a in items if a["text"] == "Book vendor call")
    assert book["assignee"] is None  # not a participant -> unassigned, never invented

    sent = fake_llm.requests[0]
    assert sent["model"] == "fake-model" and sent["response_format"] == {"type": "json_object"}
    prompt = sent["messages"][1]["content"]
    assert "<transcript>" in prompt and "[00:05] Zoe Park: We need to finalize" in prompt


def test_create_falls_back_to_rules_when_ai_fails(client, fake_llm):
    fake_llm.status = 500
    m = client.post("/api/meetings", json={"title": "x", "transcript_text": TRANSCRIPT}).json()
    assert m["summary"]["generated_by"] == "heuristic"
    assert m["action_items"] and all(a["source"] == "heuristic" for a in m["action_items"])


def test_create_falls_back_on_invalid_json(client, fake_llm):
    fake_llm.reply = "Sorry, I can't help with that."
    m = client.post("/api/meetings", json={"title": "x", "transcript_text": TRANSCRIPT}).json()
    assert m["summary"]["generated_by"] == "heuristic"


def test_json_wrapped_in_code_fence_is_accepted(client, fake_llm):
    fake_llm.reply = "Here are the notes:\n```json\n" + json.dumps(NOTES) + "\n```"
    m = client.post("/api/meetings", json={"title": "x", "transcript_text": TRANSCRIPT}).json()
    assert m["summary"]["generated_by"] == "ai"


def test_retries_without_json_mode_if_provider_rejects_it(client, fake_llm):
    fake_llm.reply, fake_llm.reject_json_mode = NOTES, True
    m = client.post("/api/meetings", json={"title": "x", "transcript_text": TRANSCRIPT}).json()
    assert m["summary"]["generated_by"] == "ai"
    assert "response_format" in fake_llm.requests[0] and "response_format" not in fake_llm.requests[1]


def test_regenerate_keeps_items_people_own(client, fake_llm):
    before = client.get("/api/meetings/1").json()["action_items"]
    assert all(a["source"] == "seed" for a in before)
    completed, edited, untouched = before[0], before[1], before[2]
    client.patch(f"/api/action-items/{completed['id']}", json={"is_completed": True})
    client.patch(f"/api/action-items/{edited['id']}", json={"text": "My edited task"})
    mine = client.post("/api/meetings/1/action-items", json={"text": "My own task"}).json()

    fake_llm.reply = NOTES
    m = client.post("/api/meetings/1/summary/regenerate").json()

    ids = {a["id"] for a in m["action_items"]}
    assert {completed["id"], edited["id"], mine["id"]} <= ids  # kept
    assert untouched["id"] not in ids  # replaced
    assert m["summary"]["generated_by"] == "ai" and m["notes"][0]["title"] == "Budget"
    assert sum(a["source"] == "ai" for a in m["action_items"]) == 2


def test_regenerate_failure_changes_nothing(client, fake_llm):
    before = client.get("/api/meetings/1").json()
    fake_llm.status = 429
    r = client.post("/api/meetings/1/summary/regenerate")
    assert r.status_code == 502 and "rate limit" in r.json()["detail"]
    assert client.get("/api/meetings/1").json() == before


def test_regenerate_requires_configuration(client):
    assert client.post("/api/meetings/1/summary/regenerate").status_code == 503


def test_ask_returns_answer_with_citations(client, fake_llm):
    fake_llm.reply = "They chose onboarding first [02:04], with Postgres only [03:06]. Bogus [99:00]."
    r = client.post(
        "/api/meetings/1/ask",
        json={"question": "What did they prioritise?", "history": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "Hello"}]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["citations"] == [124.0, 186.0]  # out-of-range timestamp dropped
    msgs = fake_llm.requests[0]["messages"]
    assert msgs[0]["role"] == "system" and "<transcript>" in msgs[0]["content"]
    assert [m["role"] for m in msgs[1:]] == ["user", "assistant", "user"]
    assert "response_format" not in fake_llm.requests[0]


def test_ask_validation_and_errors(client, fake_llm):
    assert client.post("/api/meetings/1/ask", json={"question": ""}).status_code == 422
    assert client.post("/api/meetings/999/ask", json={"question": "hi"}).status_code == 404
    fake_llm.status = 401
    r = client.post("/api/meetings/1/ask", json={"question": "hi"})
    assert r.status_code == 502 and "API key" in r.json()["detail"]


def test_missing_column_is_added_to_old_databases(tmp_path, monkeypatch):
    import sqlite3

    from sqlalchemy import create_engine

    from app import db

    path = tmp_path / "old.db"
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE action_items (id INTEGER PRIMARY KEY, text VARCHAR)")
    con.execute("INSERT INTO action_items (text) VALUES ('legacy')")
    con.commit()
    con.close()

    monkeypatch.setattr(db, "engine", create_engine(f"sqlite:///{path}"))
    db._add_missing_columns()
    con = sqlite3.connect(path)
    assert con.execute("SELECT source FROM action_items").fetchone() == ("user",)


def test_empty_answer_is_retried_once(client, fake_llm):
    fake_llm.reply = NOTES
    fake_llm.queue = [("", "stop")]  # first reply empty, second is the real notes
    r = client.post("/api/meetings/1/summary/regenerate")
    assert r.status_code == 200 and r.json()["summary"]["generated_by"] == "ai"
    assert len(fake_llm.requests) == 2


def test_out_of_room_fails_fast_with_actionable_message(client, fake_llm, caplog):
    fake_llm.queue = [("", "length")]  # hit the output limit while still reasoning
    r = client.post("/api/meetings/1/summary/regenerate")
    assert r.status_code == 502 and "LLM_MAX_TOKENS" in r.json()["detail"]
    assert len(fake_llm.requests) == 1  # an identical retry would hit the same limit
    assert "finish_reason=length" in caplog.text and "had_reasoning=True" in caplog.text


def test_null_content_is_treated_as_empty(client, fake_llm):
    fake_llm.reply = NOTES
    fake_llm.queue = [(None, "stop")]
    assert client.post("/api/meetings/1/summary/regenerate").status_code == 200


def test_reasoning_effort_is_sent_when_configured(client, fake_llm, monkeypatch):
    monkeypatch.setenv("LLM_REASONING_EFFORT", "Low")
    fake_llm.reply = NOTES
    client.post("/api/meetings/1/summary/regenerate")
    assert fake_llm.requests[0]["reasoning_effort"] == "low"


def test_provider_that_rejects_reasoning_effort_still_works(client, fake_llm, monkeypatch):
    monkeypatch.setenv("LLM_REASONING_EFFORT", "low")
    monkeypatch.setenv("LLM_MAX_TOKENS", "4096")
    fake_llm.reply, fake_llm.reject_field = NOTES, "reasoning_effort"
    r = client.post("/api/meetings/1/summary/regenerate")
    assert r.status_code == 200
    retry = fake_llm.requests[1]
    assert "reasoning_effort" in fake_llm.requests[0] and "reasoning_effort" not in retry
    # only the rejected field is dropped; the output budget and JSON mode are kept
    assert retry["max_completion_tokens"] == 4096 and "response_format" in retry


def test_max_tokens_sent_when_configured(client, fake_llm, monkeypatch):
    monkeypatch.setenv("LLM_MAX_TOKENS", "4096")
    fake_llm.reply = NOTES
    client.post("/api/meetings/1/summary/regenerate")
    assert fake_llm.requests[0]["max_completion_tokens"] == 4096


def test_groq_json_validate_failed_like_the_real_incident(client, fake_llm, monkeypatch, caplog):
    """Replays the 10:46 failure: Groq 400 json_validate_failed after the output was cut off.
    Previously this was retried without JSON mode (and came back empty); now it fails once, clearly."""
    monkeypatch.setenv("LLM_REASONING_EFFORT", "low")
    monkeypatch.setenv("LLM_MAX_TOKENS", "4096")
    before = client.get("/api/meetings/2").json()
    fake_llm.json_validate_fail = True
    r = client.post("/api/meetings/2/summary/regenerate")
    assert r.status_code == 502 and "didn't finish writing valid notes" in r.json()["detail"]
    assert len(fake_llm.requests) == 1  # no quota-burning retry
    assert "json_validate_failed" in caplog.text  # the provider's error is in the server log
    assert client.get("/api/meetings/2").json() == before  # notes untouched
