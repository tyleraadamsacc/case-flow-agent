import json

import pytest
from pydantic import ValidationError

from app.mock_data.seed import MOCK_DATA_DIR
from app.models import (
    ApprovalDecision,
    ApprovalDecisionType,
    AuditAction,
    AuditEvent,
    ActorType,
    Certification,
    LegalProcessType,
    LegalRequest,
    ResponsiveRecord,
    ReviewTargetType,
    TextDraft,
    WorkflowState,
)


def _scenario_fixture(name: str) -> dict:
    return json.loads((MOCK_DATA_DIR / "legal_requests" / name).read_text())


def test_legal_request_loads_from_scenario_fixture():
    fixture = _scenario_fixture("scenario_a_gps_happy_path.json")
    request = LegalRequest.model_validate(
        {"legal_request_id": fixture["legal_request_id"], **fixture["extracted_fields"]}
    )
    assert request.legal_process.type == LegalProcessType.SEARCH_WARRANT
    assert len(request.subject_identifiers) == 3
    assert request.product_domains == ["Maps / Location"]
    assert request.workflow_state == WorkflowState.REQUEST_RECEIVED
    # JSON round-trip
    restored = LegalRequest.model_validate_json(request.model_dump_json())
    assert restored == request


def test_audit_event_serializes_and_round_trips():
    event = AuditEvent(
        legal_request_id="LER-TEST-1",
        actor_type=ActorType.SERVICE,
        actor_id="request_extraction_service",
        action=AuditAction.REQUEST_EXTRACTED,
        before_state=WorkflowState.REQUEST_RECEIVED,
        after_state=WorkflowState.REQUEST_EXTRACTED,
        summary="test",
        evidence_ids=["EV-1"],
    )
    payload = json.loads(event.model_dump_json())
    assert payload["action"] == "request_extracted"
    assert payload["audit_event_id"].startswith("audit_")
    assert AuditEvent.model_validate(payload) == event


def test_approval_decision_serializes():
    decision = ApprovalDecision(
        legal_request_id="LER-TEST-1",
        target_type=ReviewTargetType.ROUTE,
        decision=ApprovalDecisionType.APPROVED,
        decided_by="analyst.local",
    )
    payload = json.loads(decision.model_dump_json())
    assert payload["decision"] == "approved"
    assert payload["approval_id"].startswith("appr_")


def test_responsive_record_data_confidence_is_locked_to_synthetic():
    record = ResponsiveRecord(record_id="GPS-0001")
    assert record.data_confidence == "synthetic_mock"
    with pytest.raises(ValidationError):
        ResponsiveRecord(record_id="GPS-0002", data_confidence="real")


def test_draft_statuses_cannot_be_final():
    with pytest.raises(ValidationError):
        TextDraft(draft_type="production_package", status="final")
    with pytest.raises(ValidationError):
        Certification(status="final")


def test_unknown_fields_are_rejected():
    with pytest.raises(ValidationError):
        LegalRequest(legal_request_id="LER-TEST-1", unexpected_field=True)
