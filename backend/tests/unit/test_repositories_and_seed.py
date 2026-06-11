import pytest

from app.mock_data.seed import MOCK_DATA_DIR, seed_legal_requests
from app.models.enums import AuditAction
from app.models.legal_request import LegalRequest
from app.models.workflow_state import WorkflowState
from app.repositories.local_audit_repository import LocalAuditRepository
from app.repositories.local_legal_request_repository import LocalLegalRequestRepository
from app.repositories.local_response_record_repository import LocalResponseRecordRepository
from app.repositories.local_storage_repository import LocalStorageRepository
from app.services.audit_service import AuditService


def test_seed_is_idempotent():
    repo = LocalLegalRequestRepository()
    audit_repo = LocalAuditRepository()
    service = AuditService(audit_repo)
    assert seed_legal_requests(repo, service) == 14
    assert seed_legal_requests(repo, service) == 0
    assert len(repo.list_all()) == 14
    ingested = [e for e in audit_repo.list_all() if e.action == AuditAction.REQUEST_INGESTED]
    assert len(ingested) == 14
    assert all(r.workflow_state == WorkflowState.REQUEST_RECEIVED for r in repo.list_all())


def test_legal_request_repository_returns_copies():
    repo = LocalLegalRequestRepository()
    repo.save(LegalRequest(legal_request_id="LER-TEST-1"))
    fetched = repo.get("LER-TEST-1")
    fetched.workflow_state = WorkflowState.ANALYST_APPROVED
    assert repo.get("LER-TEST-1").workflow_state == WorkflowState.REQUEST_RECEIVED


def test_response_record_repository_reads_mock_records():
    repo = LocalResponseRecordRepository(MOCK_DATA_DIR / "response_records")
    scenario_a = repo.records_for_request("LER-2026-004812")
    assert len(scenario_a) == 8
    assert all(record.data_confidence == "synthetic_mock" for record in scenario_a)
    assert repo.records_for_request("LER-2026-004863") == []
    assert repo.records_for_request("LER-UNKNOWN") == []


def test_local_storage_repository_round_trip(tmp_path):
    repo = LocalStorageRepository(tmp_path)
    repo.save_text("local://notes/example.txt", "synthetic")
    assert repo.load_text("local://notes/example.txt") == "synthetic"
    assert repo.load_text("local://missing.txt") is None
    with pytest.raises(ValueError):
        repo.load_text("gs://bucket/object")
    with pytest.raises(ValueError):
        repo.load_text("local://../escape.txt")
