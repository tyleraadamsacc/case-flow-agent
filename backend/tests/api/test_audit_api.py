def test_request_timeline_is_chronological(client, advance_to_review):
    advance_to_review("LER-2026-004812")
    response = client.get("/api/legal-requests/LER-2026-004812/audit")
    assert response.status_code == 200
    events = response.json()
    assert [e["action"] for e in events] == [
        "request_ingested",
        "request_extracted",
        "special_handling_checked",
    ]
    timestamps = [e["timestamp"] for e in events]
    assert timestamps == sorted(timestamps)


def test_timeline_404_for_unknown_request(client):
    assert client.get("/api/legal-requests/LER-NOPE/audit").status_code == 404


def test_global_events_filter_by_action_and_request(client, advance_to_review):
    advance_to_review("LER-2026-004812")
    response = client.get("/api/audit/events", params={"action": "request_extracted"})
    assert response.status_code == 200
    events = response.json()
    assert events and all(e["action"] == "request_extracted" for e in events)

    scoped = client.get(
        "/api/audit/events", params={"legal_request_id": "LER-2026-004821"}
    ).json()
    assert {e["legal_request_id"] for e in scoped} == {"LER-2026-004821"}


def test_global_events_filter_by_actor_type(client, advance_to_review):
    advance_to_review("LER-2026-004850")
    client.post(
        "/api/legal-requests/LER-2026-004850/review",
        json={"action": "approve"},
    )
    human_events = client.get("/api/audit/events", params={"actor_type": "human"}).json()
    assert human_events
    assert all(e["actor_type"] == "human" for e in human_events)
    assert any(e["action"] == "analyst_reviewed" for e in human_events)
