"""How people in forms and transcripts map to participants."""


def people(meeting):
    return {p["name"]: p["email"] for p in meeting["participants"]}


def test_transcript_speaker_links_to_form_participant_case_insensitively(client):
    r = client.post(
        "/api/meetings",
        json={
            "title": "Budget sync",
            "participants": [{"name": "Zoe Park", "email": "Zoe@Acme.com"}],
            "transcript_text": "[00:00:05] zoe park: We need to finalize the budget.\n[00:00:20] Alex Carter: I'll send the numbers.",
        },
    )
    assert r.status_code == 201
    m = r.json()
    assert people(m) == {"Alex Carter": "alex@northwind.io", "Zoe Park": "zoe@acme.com"}  # one Zoe, email lower-cased

    segs = client.get(f"/api/meetings/{m['id']}/transcript").json()
    assert segs[0]["speaker"]["email"] == "zoe@acme.com"  # her transcript line points at that participant


def test_email_can_be_added_later_to_a_transcript_speaker(client):
    m = client.post(
        "/api/meetings",
        json={"title": "Upload-like", "transcript_text": "Sam Torres: Hello there team.\nAlex Carter: Hi Sam, welcome."},
    ).json()
    assert people(m)["Sam Torres"] is None
    sam_id = next(p["id"] for p in m["participants"] if p["name"] == "Sam Torres")

    updated = client.patch(
        f"/api/meetings/{m['id']}",
        json={"participants": [{"name": "Alex Carter", "email": "alex@northwind.io"}, {"name": "Sam Torres", "email": "sam@x.io"}]},
    ).json()
    sam = next(p for p in updated["participants"] if p["name"] == "Sam Torres")
    assert sam["email"] == "sam@x.io"
    assert sam["id"] == sam_id  # same person, not a duplicate


def test_same_name_different_email_is_a_different_person(client):
    a = client.post("/api/meetings", json={"title": "A", "participants": [{"name": "Chris Lee", "email": "chris@a.com"}]}).json()
    b = client.post("/api/meetings", json={"title": "B", "participants": [{"name": "Chris Lee", "email": "chris@b.com"}]}).json()
    id_a = next(p["id"] for p in a["participants"] if p["name"] == "Chris Lee")
    id_b = next(p["id"] for p in b["participants"] if p["name"] == "Chris Lee")
    assert id_a != id_b


def test_email_is_the_identity(client):
    a = client.post("/api/meetings", json={"title": "A", "participants": [{"name": "Priya", "email": "priya@northwind.io"}]}).json()
    priya = next(p for p in a["participants"] if p["email"] == "priya@northwind.io")
    assert priya["name"] == "Priya Sharma"  # matched the seeded person by email, kept her full name
