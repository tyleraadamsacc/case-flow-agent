from app.models.workflow_state import WorkflowState
from tests.unit.test_audit_service import FailingAuditRepository


def timeline_actions(client, legal_request_id: str) -> list[str]:
    return [
        event["action"]
        for event in client.get(f"/api/legal-requests/{legal_request_id}/audit").json()
    ]


def test_full_happy_path_finalizes_with_complete_audit_trail(client, advance_to_review):
    advance_to_review("LER-2026-004850")

    review = client.post(
        "/api/legal-requests/LER-2026-004850/review",
        json={"action": "approve", "comments": "Looks complete."},
    )
    assert review.status_code == 200
    assert review.json()["audit_event"]["action"] == "analyst_reviewed"

    approve = client.post("/api/legal-requests/LER-2026-004850/approve", json={})
    assert approve.status_code == 200
    body = approve.json()
    assert body["finalized"] is True
    assert body["legal_request"]["workflow_state"] == "audit_complete"
    assert body["approval_decision"]["decided_by"] == "analyst.local"
    assert body["approval_decision"]["decision"] == "approved"
    assert timeline_actions(client, "LER-2026-004850") == [
        "request_ingested",
        "request_extracted",
        "special_handling_checked",
        "analyst_reviewed",
        "route_approved",
        "audit_completed",
    ]


def test_blocking_deficiency_prevents_approval(client, advance_to_review):
    advance_to_review("LER-2026-004821")
    response = client.post("/api/legal-requests/LER-2026-004821/approve", json={})
    assert response.status_code == 409
    body = response.json()
    assert body["blocked"] is True
    assert "missing_date_range" in body["reasons"]
    # State unchanged; the refusal itself is audited.
    detail = client.get("/api/legal-requests/LER-2026-004821").json()
    assert detail["workflow_state"] == "analyst_review_pending"
    assert "finalization_blocked" in timeline_actions(client, "LER-2026-004821")


def test_escalation_writes_event_and_state(client, advance_to_review):
    advance_to_review("LER-2026-004835")
    response = client.post(
        "/api/legal-requests/LER-2026-004835/escalate",
        json={"reason": "Pen register and non-disclosure requested.", "target": "SME Review"},
    )
    assert response.status_code == 200
    assert response.json()["legal_request"]["workflow_state"] == "escalated"
    assert response.json()["audit_event"]["action"] == "request_escalated"


def test_send_to_qa_is_internal_only_and_audited(client, advance_to_review):
    advance_to_review("LER-2026-004812")
    response = client.post(
        "/api/legal-requests/LER-2026-004812/send-to-qa", json={"reason": "Sampling."}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["legal_request"]["workflow_state"] == "sent_to_qa"
    assert "Internal QA handoff only" in body["audit_event"]["summary"]


def test_request_changes_moves_state(client, advance_to_review):
    advance_to_review("LER-2026-004842")
    response = client.post(
        "/api/legal-requests/LER-2026-004842/review",
        json={"action": "request_changes", "comments": "Narrow the scope."},
    )
    assert response.status_code == 200
    assert response.json()["legal_request"]["workflow_state"] == "changes_requested"


def test_approve_from_intake_is_invalid_transition(client):
    response = client.post("/api/legal-requests/LER-2026-004812/approve", json={})
    assert response.status_code == 409


def test_missing_audit_events_block_finalization(client, container):
    """A request staged into review without the required upstream audit
    events must not reach audit_complete."""
    request = container.legal_request_repository.get("LER-2026-004850")
    request.workflow_state = WorkflowState.ANALYST_REVIEW_PENDING
    container.legal_request_repository.save(request)

    response = client.post("/api/legal-requests/LER-2026-004850/approve", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["finalized"] is False
    assert body["legal_request"]["workflow_state"] == "analyst_approved"
    blocked = [e for e in body["audit_events"] if e["action"] == "finalization_blocked"]
    assert blocked and "request_extracted" in blocked[0]["summary"]


def test_audit_write_failure_blocks_the_transition(client, container):
    container.audit_service.repository = FailingAuditRepository()
    response = client.post("/api/legal-requests/LER-2026-004812/extract")
    assert response.status_code == 503
    # The transition was abandoned: state unchanged.
    detail = client.get("/api/legal-requests/LER-2026-004812").json()
    assert detail["workflow_state"] == "request_received"
