"""Core API behaviour: listing/search/filters, CRUD, cascades, uploads, analytics."""
from pathlib import Path

SAMPLES = Path(__file__).resolve().parent.parent / "sample_transcripts"


def test_list_is_seeded_and_sorted_newest_first(client):
    items = client.get("/api/meetings").json()["items"]
    assert len(items) == 6
    dates = [m["date"] for m in items]
    assert dates == sorted(dates, reverse=True)


def test_search_titles_vs_transcripts(client):
    assert client.get("/api/meetings", params={"q": "snowflake"}).json()["total"] == 0  # not in any title
    hits = client.get("/api/meetings", params={"q": "snowflake", "scope": "all"}).json()["items"]
    assert [m["title"] for m in hits] == ["Sales Demo – Acme Corp <> Northwind"]


def test_filter_by_participant(client):
    lena = next(p for p in client.get("/api/participants").json() if p["name"] == "Lena Fischer")
    assert client.get("/api/meetings", params={"participant_id": lena["id"]}).json()["total"] == 2


def test_action_item_crud(client):
    created = client.post("/api/meetings/1/action-items", json={"text": "Write tests", "assignee_id": 2}).json()
    assert created["assignee"]["id"] == 2

    done = client.patch(f"/api/action-items/{created['id']}", json={"is_completed": True, "text": "Write more tests"}).json()
    assert done["is_completed"] and done["text"] == "Write more tests"

    unassigned = client.patch(f"/api/action-items/{created['id']}", json={"clear_assignee": True}).json()
    assert unassigned["assignee"] is None

    assert client.delete(f"/api/action-items/{created['id']}").status_code == 204
    assert client.patch(f"/api/action-items/{created['id']}", json={"is_completed": False}).status_code == 404


def test_delete_meeting_cascades(client):
    assert client.delete("/api/meetings/2").status_code == 204
    assert client.get("/api/meetings/2").status_code == 404
    assert client.get("/api/meetings/2/transcript").status_code == 404
    tasks = client.get("/api/action-items").json()
    assert all(t["meeting_id"] != 2 for t in tasks)


def test_upload_each_format_generates_notes(client):
    for name in ("design_review.txt", "customer_call.vtt", "quick_sync.json"):
        with open(SAMPLES / name, "rb") as f:
            r = client.post("/api/meetings/upload", files={"file": (name, f)})
        assert r.status_code == 201, (name, r.text)
        m = r.json()
        assert m["summary"]["generated_by"] == "heuristic"
        assert len(client.get(f"/api/meetings/{m['id']}/transcript").json()) >= 3


def test_upload_rejects_bad_files(client):
    assert client.post("/api/meetings/upload", files={"file": ("x.pdf", b"%PDF")}).status_code == 415
    assert client.post("/api/meetings/upload", files={"file": ("x.txt", b"just some text")}).status_code == 422


def test_analytics_percentages_add_up(client):
    a = client.get("/api/meetings/1/analytics").json()
    assert abs(sum(s["talktime_pct"] for s in a["speakers"]) - 100) < 0.5
    assert abs(sum(a["sentiments"].values()) - 100) < 0.5
    assert all(s["wpm"] > 0 for s in a["speakers"])
