"""Response-package and deficiency drafting flows.

Everything drafted is structurally non-final; the record index is always
copied from the ETL output; and drafting endpoints cannot bypass policy —
a blocking deficiency yields the deficiency variant, and a missing ETL
run yields a visible blocked run, never an invented package.
"""

SCENARIO_A = "LER-2026-004812"
SCENARIO_B = "LER-2026-004821"
SCENARIO_C = "LER-2026-004835"
SCENARIO_F = "LER-2026-004863"


def run_rail(client, advance_to_review, legal_request_id):
    advance_to_review(legal_request_id)
    response = client.post(f"/api/legal-requests/{legal_request_id}/agents/run")
    assert response.status_code == 200, response.text
    return response.json()


def test_scenario_a_drafts_full_package_with_eight_gps_records(
    client, advance_to_review
):
    run_rail(client, advance_to_review, SCENARIO_A)
    response = client.post(f"/api/legal-requests/{SCENARIO_A}/production-package/draft")
    assert response.status_code == 200
    body = response.json()
    assert body["requires_human_approval"] is True
    package = body["production_package"]
    # Production ID format per Template LERS Response: PROD-2026-004812-01.
    assert package["production_id"] == "PROD-2026-004812-01"
    assert package["status"] == "draft_pending_analyst_review"
    assert package["production_summary"]["total_responsive_records"] == 8
    assert len(package["records"]) == 8
    assert all(r["data_confidence"] == "synthetic_mock" for r in package["records"])
    assert package["certification"]["status"] == "draft_pending_approval"
    assert package["chain_of_custody"]["review_status"] == "draft_pending_review"
    assert package["section_provenance"]["record_index"] == "ETL Agent"
    assert body["text_draft"]["status"] == "draft_not_final"

    stored = client.get(f"/api/legal-requests/{SCENARIO_A}/production-package")
    assert stored.status_code == 200
    assert stored.json()["production_id"] == package["production_id"]


def test_record_index_is_copied_from_etl_output_not_invented(
    client, container, advance_to_review
):
    run_rail(client, advance_to_review, SCENARIO_A)
    body = client.post(
        f"/api/legal-requests/{SCENARIO_A}/production-package/draft"
    ).json()
    etl_run = next(
        run
        for run in container.agent_run_repository.list_for_request(SCENARIO_A)
        if run.agent_id == "etl_agent"
    )
    etl_record_ids = [record["record_id"] for record in etl_run.output["records"]]
    package_record_ids = [r["record_id"] for r in body["production_package"]["records"]]
    assert package_record_ids == etl_record_ids


def test_package_draft_without_upstream_runs_is_visibly_blocked(
    client, advance_to_review
):
    advance_to_review(SCENARIO_A)  # no rail run: no persisted upstream outputs
    response = client.post(f"/api/legal-requests/{SCENARIO_A}/production-package/draft")
    assert response.status_code == 200
    body = response.json()
    assert body["agent_run"]["status"] == "blocked"
    assert body["agent_run"]["blocked_reason"] == "awaiting_triage"
    assert body["production_package"] is None


def test_scenario_b_drafts_deficiency_response_with_resolution(
    client, advance_to_review
):
    run_rail(client, advance_to_review, SCENARIO_B)
    response = client.post(
        f"/api/legal-requests/{SCENARIO_B}/deficiency-response/draft"
    )
    assert response.status_code == 200
    body = response.json()
    draft = body["text_draft"]
    assert draft["draft_type"] == "deficiency_response"
    assert draft["status"] == "draft_not_final"
    sections = draft["sections"].values()
    assert any("missing_date_range" in section for section in sections)
    assert any("clarification" in section.lower() for section in sections)


def test_package_endpoint_cannot_bypass_policy_for_deficient_request(
    client, advance_to_review
):
    """On a request with a blocking deficiency, the package endpoint yields
    the policy-mandated deficiency variant, not a production package."""
    run_rail(client, advance_to_review, SCENARIO_B)
    body = client.post(
        f"/api/legal-requests/{SCENARIO_B}/production-package/draft"
    ).json()
    assert body["production_package"] is None
    assert body["text_draft"]["draft_type"] == "deficiency_response"


def test_scenario_c_rail_drafts_sme_notification(client, container, advance_to_review):
    run_rail(client, advance_to_review, SCENARIO_C)
    request = container.legal_request_repository.get(SCENARIO_C)
    drafts = {draft.draft_type.value for draft in request.text_drafts}
    assert "sme_notification" in drafts
    sme_draft = next(
        d for d in request.text_drafts if d.draft_type.value == "sme_notification"
    )
    assert sme_draft.status == "draft_not_final"
    assert "pen_register_requested" in sme_draft.sections["review_reasons"]


def test_scenario_f_drafts_no_responsive_records_package(client, advance_to_review):
    run_rail(client, advance_to_review, SCENARIO_F)
    body = client.post(
        f"/api/legal-requests/{SCENARIO_F}/production-package/draft"
    ).json()
    assert body["text_draft"]["draft_type"] == "no_responsive_records"
    package = body["production_package"]
    assert package["production_summary"]["total_responsive_records"] == 0
    assert package["records"] == []
    assert "no records responsive" in (
        package["production_summary"]["ordinary_course_statement"]
    )
    assert package["status"] == "draft_pending_analyst_review"


def test_responsive_records_endpoint_serves_synthetic_mock_records(client):
    records = client.get(f"/api/legal-requests/{SCENARIO_A}/responsive-records").json()
    assert len(records) == 8
    assert all(record["data_confidence"] == "synthetic_mock" for record in records)
    assert client.get("/api/legal-requests/LER-NOPE/responsive-records").status_code == 404


def test_every_drafted_artifact_carries_a_pending_review_status(
    client, container, advance_to_review
):
    """No release/send/final status is reachable: every drafted artifact
    sits in an explicit draft/pending-review status."""
    run_rail(client, advance_to_review, SCENARIO_A)
    client.post(f"/api/legal-requests/{SCENARIO_A}/production-package/draft")
    request = container.legal_request_repository.get(SCENARIO_A)
    assert request.production_package.status.value == "draft_pending_analyst_review"
    assert request.production_package.certification.status == "draft_pending_approval"
    assert request.production_package.chain_of_custody.review_status == (
        "draft_pending_review"
    )
    assert all(draft.status == "draft_not_final" for draft in request.text_drafts)
    assert all(note.requires_human_approval for note in request.note_drafts)
    assert request.routing_recommendation.status == "recommended_pending_human"
