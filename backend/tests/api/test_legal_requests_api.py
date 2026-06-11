SCENARIO_IDS = {
    "LER-2026-004812",
    "LER-2026-004821",
    "LER-2026-004835",
    "LER-2026-004842",
    "LER-2026-004850",
    "LER-2026-004863",
    "LER-2026-004871",
    "LER-2026-004888",
    "LER-2026-004901",
    "LER-2026-004912",
    "LER-2026-004923",
    "LER-2026-004934",
    "LER-2026-004945",
    "LER-2026-004956",
}


def test_list_returns_seeded_requests(client):
    response = client.get("/api/legal-requests")
    assert response.status_code == 200
    assert {item["legal_request_id"] for item in response.json()} == SCENARIO_IDS


def test_detail_returns_request_and_404_for_unknown(client):
    response = client.get("/api/legal-requests/LER-2026-004812")
    assert response.status_code == 200
    assert response.json()["workflow_state"] == "request_received"
    assert "completeness_score" not in response.json()
    assert client.get("/api/legal-requests/LER-NOPE").status_code == 404


def test_completeness_score_endpoint_returns_stable_component_breakdown(client):
    client.post("/api/legal-requests/LER-2026-004812/extract")
    response = client.get("/api/legal-requests/LER-2026-004812/completeness-score")

    assert response.status_code == 200
    score = response.json()["score"]
    assert score["legal_request_id"] == "LER-2026-004812"
    assert score["status"] == "partial"
    assert score["total_score"] == 57
    assert [component["component"] for component in score["components"]] == [
        "placeholders",
        "identifiers",
        "date_range",
        "authority_coverage",
        "special_handling_review",
        "package_validation",
        "attestations",
    ]
    components = {component["component"]: component for component in score["components"]}
    assert components["identifiers"]["status"] == "complete"
    assert components["special_handling_review"]["status"] == "incomplete"
    assert components["package_validation"]["status"] == "incomplete"
    assert components["attestations"]["status"] == "incomplete"


def test_create_ingests_request_and_writes_audit_event(client):
    response = client.post(
        "/api/legal-requests",
        json={"raw_source_text": "Synthetic ad-hoc request"},
    )
    assert response.status_code == 201
    body = response.json()
    legal_request_id = body["legal_request"]["legal_request_id"]
    assert body["audit_event"]["action"] == "request_ingested"
    assert client.get(f"/api/legal-requests/{legal_request_id}").status_code == 200


def test_extract_updates_state_and_writes_audit_event(client):
    response = client.post("/api/legal-requests/LER-2026-004812/extract")
    assert response.status_code == 200
    body = response.json()
    request = body["legal_request"]
    assert request["workflow_state"] == "request_extracted"
    assert len(request["subject_identifiers"]) == 3
    assert request["source_sections"]
    assert request["source_sections"][0]["section_id"]
    assert "SEARCH WARRANT" in request["source_sections"][0]["text"]
    assert request["scope_authority_checks"]
    assert request["scope_authority_checks"][0]["status"] == "covered"
    matched_citations = request["scope_authority_checks"][0]["matched_citations"]
    assert "18 U.S.C. §2703" in matched_citations
    assert {
        "search_warrant",
        "court_order",
        "location_tracking",
    } <= set(request["legal_process"]["components"])
    assert body["audit_event"]["action"] == "request_extracted"
    assert body["audit_event"]["before_state"] == "request_received"
    assert body["audit_event"]["after_state"] == "request_extracted"


def test_extract_strips_placeholder_text(client):
    response = client.post("/api/legal-requests/LER-2026-004821/extract")
    assert response.status_code == 200
    extracted = response.json()["legal_request"]
    assert extracted["requesting_agency"]["officer"] is None


def test_validate_creates_findings_and_writes_audit_event(client):
    client.post("/api/legal-requests/LER-2026-004821/extract")
    response = client.post("/api/legal-requests/LER-2026-004821/validate")
    assert response.status_code == 200
    body = response.json()
    assert body["legal_request"]["workflow_state"] == "analyst_review_pending"
    codes = {finding["code"] for finding in body["deficiency_findings"]}
    assert "missing_date_range" in codes
    assert body["approval_policy"]["human_review_required"] is True
    assert body["audit_event"]["action"] == "special_handling_checked"


def test_validate_scenario_c_surfaces_special_handling(client):
    client.post("/api/legal-requests/LER-2026-004835/extract")
    response = client.post("/api/legal-requests/LER-2026-004835/validate")
    body = response.json()
    assert {
        "pen_register_requested",
        "trap_and_trace_requested",
        "non_disclosure_to_subscriber",
        "ongoing_access_requested",
    } <= set(body["special_handling"]["active_flags"])
    assert "pen_register_requested" in body["approval_policy"]["review_reasons"]
    assert "ongoing_collection_requested" in body["approval_policy"]["review_reasons"]
    assert body["legal_request"]["special_handling"]["ongoing_duration_days"] == 60
    assert (
        body["legal_request"]["special_handling"]["ongoing_update_interval_minutes"]
        == 15
    )


def test_validate_missing_authority_flags_scope_review(client):
    client.post("/api/legal-requests/LER-2026-004835/extract")
    response = client.post("/api/legal-requests/LER-2026-004835/validate")
    body = response.json()

    findings = {finding["code"]: finding for finding in body["deficiency_findings"]}
    assert findings["scope_authority_mismatch"]["severity"] == "warning"
    assert "scope_authority_mismatch" in body["approval_policy"]["review_reasons"]
    assert any(
        check["status"] == "missing_authority"
        for check in body["legal_request"]["scope_authority_checks"]
    )


def test_validate_scenario_d_flags_overbroad_scope(client):
    client.post("/api/legal-requests/LER-2026-004842/extract")
    response = client.post("/api/legal-requests/LER-2026-004842/validate")
    body = response.json()
    codes = {finding["code"] for finding in body["deficiency_findings"]}
    assert "overbroad_scope" in codes
    assert "overbroad_scope" in body["approval_policy"]["review_reasons"]


def test_validate_before_extract_is_an_invalid_transition(client):
    response = client.post("/api/legal-requests/LER-2026-004812/validate")
    assert response.status_code == 409
    assert response.json()["from_state"] == "request_received"


def test_extract_twice_is_an_invalid_transition(client):
    assert client.post("/api/legal-requests/LER-2026-004812/extract").status_code == 200
    assert client.post("/api/legal-requests/LER-2026-004812/extract").status_code == 409
