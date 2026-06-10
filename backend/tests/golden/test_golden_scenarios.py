"""The twelve golden scenarios (plan §17), end-to-end through the API and
the six-agent ADK rail against seeded synthetic data, deterministic mode,
zero credentials.

1. GPS happy path                7. regulator / sensitive sender
2. missing date range            8. low-confidence classification
3. pen register/TT non-disclosure 9. SOP conflict
4. overbroad all-Google-data     10. missing audit event blocks finalization
5. simple subscriber info        11. human route override
6. no responsive records         12. response package edited by analyst
"""

from app.adk_agents.registry import RAIL_ORDER
from app.models.workflow_state import WorkflowState

SCENARIO_A = "LER-2026-004812"
SCENARIO_B = "LER-2026-004821"
SCENARIO_C = "LER-2026-004835"
SCENARIO_D = "LER-2026-004842"
SCENARIO_E = "LER-2026-004850"
SCENARIO_F = "LER-2026-004863"
SCENARIO_G = "LER-2026-004871"
SCENARIO_H = "LER-2026-004888"


def run_rail(client, advance_to_review, legal_request_id) -> dict:
    advance_to_review(legal_request_id)
    response = client.post(f"/api/legal-requests/{legal_request_id}/agents/run")
    assert response.status_code == 200, response.text
    return {run["agent_id"]: run for run in response.json()["agent_runs"]}


def timeline_actions(client, legal_request_id: str) -> list[str]:
    return [
        event["action"]
        for event in client.get(f"/api/legal-requests/{legal_request_id}/audit").json()
    ]


def test_golden_1_gps_happy_path_end_to_end(client, advance_to_review):
    runs = run_rail(client, advance_to_review, SCENARIO_A)
    assert list(runs) == list(RAIL_ORDER)
    assert all(run["status"] == "complete" for run in runs.values())
    assert runs["etl_agent"]["output"]["etl_output"]["total_responsive_records"] == 8

    review = client.post(
        f"/api/legal-requests/{SCENARIO_A}/review", json={"action": "approve"}
    )
    assert review.status_code == 200
    approve = client.post(f"/api/legal-requests/{SCENARIO_A}/approve", json={})
    assert approve.status_code == 200
    assert approve.json()["finalized"] is True
    assert approve.json()["legal_request"]["workflow_state"] == "audit_complete"

    actions = timeline_actions(client, SCENARIO_A)
    assert actions == [
        "request_ingested",
        "request_extracted",
        "special_handling_checked",
        "request_indexed",
        "request_classified",
        "etl_simulated",
        "note_drafted",
        "production_package_drafted",
        "workflow_action_prepared",
        "analyst_reviewed",
        "route_approved",
        "audit_completed",
    ]


def test_golden_2_missing_date_range_blocks_etl_and_approval(client, advance_to_review):
    runs = run_rail(client, advance_to_review, SCENARIO_B)
    assert runs["etl_agent"]["status"] == "blocked"
    assert "missing_date_range" in runs["etl_agent"]["blocked_reason"]
    assert runs["text_content_agent"]["output"]["text_draft"]["draft_type"] == (
        "deficiency_response"
    )
    note = runs["note_taking_and_data_entry_agent"]["output"]["note_draft"]
    assert note["note_type"] == "deficiency_note"
    assert "date range" in note["body"] or "missing_date_range" in note["body"]

    approve = client.post(f"/api/legal-requests/{SCENARIO_B}/approve", json={})
    assert approve.status_code == 409
    assert "missing_date_range" in approve.json()["reasons"]


def test_golden_3_pen_register_nondisclosure_escalation_path(client, advance_to_review):
    runs = run_rail(client, advance_to_review, SCENARIO_C)
    indexing = runs["indexing_agent"]["output"]["indexing_output"]
    assert indexing["priority_rank"] == 1
    classification = runs["triaging_agent"]["output"]["classification"]
    assert classification["sensitivity"] == "high"
    assert classification["recommended_queue"] == "SME Review"
    assert classification["human_review_required"] is True
    assert {"pen_register_requested", "trap_and_trace_requested",
            "non_disclosure_requested", "sealed_order_requested"} <= set(
        classification["review_reasons"]
    )
    assert runs["etl_agent"]["status"] == "blocked"
    automation = runs["automation_agent"]["output"]["automation_output"]
    assert automation["action_type"] == "prepare_sme_escalation"
    assert automation["status"] == "prepared_pending_human"

    escalate = client.post(
        f"/api/legal-requests/{SCENARIO_C}/escalate",
        json={"reason": "Pen register and non-disclosure requested.", "target": "SME Review"},
    )
    assert escalate.status_code == 200
    assert escalate.json()["legal_request"]["workflow_state"] == "escalated"


def test_golden_4_overbroad_request_held_for_sme_scope_review(client, advance_to_review):
    runs = run_rail(client, advance_to_review, SCENARIO_D)
    indexing = runs["indexing_agent"]["output"]["indexing_output"]
    assert len(indexing["product_domains"]) == 9
    classification = runs["triaging_agent"]["output"]["classification"]
    assert "overbroad_scope" in classification["review_reasons"]
    assert runs["etl_agent"]["blocked_reason"] == "overbroad_scope_pending_review"
    assert runs["text_content_agent"]["output"]["text_draft"]["draft_type"] == (
        "deficiency_response"
    )
    automation = runs["automation_agent"]["output"]["automation_output"]
    assert automation["action_type"] == "prepare_sme_assignment"
    assert automation["target"] == "SME Review"


def test_golden_5_simple_subscriber_request_routes_with_minimal_friction(
    client, advance_to_review
):
    runs = run_rail(client, advance_to_review, SCENARIO_E)
    assert all(run["status"] == "complete" for run in runs.values())
    classification = runs["triaging_agent"]["output"]["classification"]
    assert classification["request_category"] == "Subscriber Information Production"
    assert classification["recommended_queue"] == "Subscriber Records Review"
    assert classification["human_review_required"] is False  # no policy trigger
    automation = runs["automation_agent"]["output"]["automation_output"]
    assert automation["action_type"] == "prepare_queue_assignment"
    # Approval is still structurally required to finalize.
    routing = runs["triaging_agent"]["output"]["routing_recommendation"]
    assert routing["requires_approval"] is True

    client.post(f"/api/legal-requests/{SCENARIO_E}/review", json={"action": "approve"})
    approve = client.post(f"/api/legal-requests/{SCENARIO_E}/approve", json={})
    assert approve.json()["finalized"] is True


def test_golden_6_no_responsive_records_package_variant(client, advance_to_review):
    runs = run_rail(client, advance_to_review, SCENARIO_F)
    etl_output = runs["etl_agent"]["output"]["etl_output"]
    assert runs["etl_agent"]["status"] == "complete"  # zero-result is a completed run
    assert etl_output["total_responsive_records"] == 0
    assert etl_output["data_confidence"] == "synthetic_mock"
    draft = runs["text_content_agent"]["output"]["text_draft"]
    assert draft["draft_type"] == "no_responsive_records"
    package = runs["text_content_agent"]["output"]["production_package"]
    assert package["records"] == []
    assert "no records responsive" in (
        package["production_summary"]["ordinary_course_statement"]
    )
    assert package["status"] == "draft_pending_analyst_review"


def test_golden_7_regulator_sensitive_sender_forces_sme_review(
    client, advance_to_review
):
    runs = run_rail(client, advance_to_review, SCENARIO_G)
    classification = runs["triaging_agent"]["output"]["classification"]
    assert "sensitive_party" in classification["review_reasons"]
    assert classification["recommended_queue"] == "SME Review"
    assert classification["human_review_required"] is True
    assert "sensitive_party" in runs["triaging_agent"]["risk_flags"]
    automation = runs["automation_agent"]["output"]["automation_output"]
    assert automation["action_type"] == "prepare_sme_escalation"
    assert "Sensitive-party registry match" in automation["reason"]


def test_golden_8_low_confidence_classification_forces_review(client, advance_to_review):
    runs = run_rail(client, advance_to_review, SCENARIO_H)
    triaging = runs["triaging_agent"]
    assert triaging["status"] == "needs_review"
    assert triaging["confidence"] == 0.55
    assert "low_classification_confidence" in triaging["review_reasons"]
    classification = triaging["output"]["classification"]
    assert classification["human_review_required"] is True
    assert classification["legal_process_type"] == "unknown"


def test_golden_9_sop_conflict_between_registry_and_routing_rules(
    client, advance_to_review
):
    """Scenario G: the sensitive-party registry forces SME Review while the
    domain routing rule says Subscriber Records Review — a visible SOP
    conflict requiring human review."""
    runs = run_rail(client, advance_to_review, SCENARIO_G)
    classification = runs["triaging_agent"]["output"]["classification"]
    assert "sop_conflict" in classification["review_reasons"]
    assert classification["recommended_queue"] == "SME Review"
    # Both conflicting rules are visible as evidence.
    assert "ROUTE-SENSITIVE-PARTY" in classification["evidence_ids"]
    assert "ROUTE-SUBSCRIBER" in classification["evidence_ids"]


def test_golden_10_missing_audit_event_blocks_finalization(client, container):
    request = container.legal_request_repository.get(SCENARIO_E)
    request.workflow_state = WorkflowState.ANALYST_REVIEW_PENDING
    container.legal_request_repository.save(request)

    response = client.post(f"/api/legal-requests/{SCENARIO_E}/approve", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["finalized"] is False
    assert body["legal_request"]["workflow_state"] == "analyst_approved"
    blocked = [e for e in body["audit_events"] if e["action"] == "finalization_blocked"]
    assert blocked and "request_extracted" in blocked[0]["summary"]
    assert "audit_complete" != body["legal_request"]["workflow_state"]


def test_golden_11_human_route_override_is_captured(client, advance_to_review):
    runs = run_rail(client, advance_to_review, SCENARIO_E)
    recommended = runs["triaging_agent"]["output"]["routing_recommendation"]
    assert recommended["target_queue"] == "Subscriber Records Review"

    review = client.post(
        f"/api/legal-requests/{SCENARIO_E}/review",
        json={
            "action": "approve",
            "target_type": "route",
            "comments": "Overriding the recommended queue.",
            "edits": {"recommended_queue": "General Intake Review"},
        },
    )
    assert review.status_code == 200
    body = review.json()
    assert body["review"]["edits"] == {"recommended_queue": "General Intake Review"}
    assert "with edits" in body["audit_event"]["summary"]
    detail = client.get(f"/api/legal-requests/{SCENARIO_E}").json()
    assert detail["reviews"][-1]["edits"]["recommended_queue"] == "General Intake Review"


def test_golden_12_response_package_edited_by_analyst_stays_draft(
    client, container, advance_to_review
):
    run_rail(client, advance_to_review, SCENARIO_A)
    review = client.post(
        f"/api/legal-requests/{SCENARIO_A}/review",
        json={
            "action": "approve",
            "target_type": "production_package",
            "comments": "Tightened the production summary wording.",
            "edits": {"production_summary": "Edited summary text (analyst)."},
        },
    )
    assert review.status_code == 200
    assert review.json()["review"]["target_type"] == "production_package"
    assert review.json()["review"]["edits"]

    # The analyst edit never flips the package out of draft by itself.
    request = container.legal_request_repository.get(SCENARIO_A)
    assert request.production_package.status.value == "draft_pending_analyst_review"
    assert request.production_package.certification.status == "draft_pending_approval"
