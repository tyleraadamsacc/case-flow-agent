EXPECTED_METRIC_IDS = {
    "total_requests",
    "open_requests",
    "requests_with_deficiencies",
    "requests_requiring_human_review",
    "special_handling_requests",
    "escalated_requests",
    "audit_events",
}


def test_summary_returns_labeled_synthetic_metrics(client):
    response = client.get("/api/governance/summary")
    assert response.status_code == 200
    metrics = {m["metric_id"]: m for m in response.json()["metrics"]}
    assert set(metrics) == EXPECTED_METRIC_IDS
    assert metrics["total_requests"]["value"] == 6
    assert metrics["total_requests"]["data_confidence"] == "synthetic_mock"
    assert metrics["audit_events"]["data_confidence"] == "fully_tracked"
    assert metrics["audit_events"]["value"] == 6  # one request_ingested per seeded scenario


def test_summary_reflects_workflow_activity(client, advance_to_review):
    advance_to_review("LER-2026-004821")
    client.post(
        "/api/legal-requests/LER-2026-004821/escalate",
        json={"reason": "Deficient and sensitive.", "target": "SME Review"},
    )
    metrics = {m["metric_id"]: m for m in client.get("/api/governance/summary").json()["metrics"]}
    assert metrics["requests_with_deficiencies"]["value"] >= 1
    assert metrics["escalated_requests"]["value"] == 1
    assert metrics["requests_requiring_human_review"]["value"] >= 1
    assert metrics["open_requests"]["value"] == 6
