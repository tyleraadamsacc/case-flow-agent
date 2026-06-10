import pytest

from app.errors import AuditWriteError
from app.models.audit_event import AuditEvent
from app.models.enums import ActorType, AuditAction
from app.repositories.audit_repository import AuditRepository
from app.repositories.local_audit_repository import LocalAuditRepository
from app.services.audit_service import AuditService


class FailingAuditRepository(AuditRepository):
    def append(self, event: AuditEvent) -> None:
        raise RuntimeError("disk on fire")

    def list_for_request(self, legal_request_id: str) -> list[AuditEvent]:
        return []

    def list_all(self) -> list[AuditEvent]:
        return []

    def count(self) -> int:
        return 0


def _record(service: AuditService, action: AuditAction = AuditAction.REQUEST_INGESTED):
    return service.record(
        legal_request_id="LER-TEST-1",
        actor_type=ActorType.SYSTEM,
        actor_id="test",
        action=action,
    )


def test_record_persists_and_returns_event():
    repo = LocalAuditRepository()
    service = AuditService(repo)
    event = _record(service)
    assert event.audit_event_id.startswith("audit_")
    assert repo.count() == 1


def test_audit_repository_is_append_only():
    repo = LocalAuditRepository()
    assert not hasattr(repo, "delete")
    assert not hasattr(repo, "update")
    service = AuditService(repo)
    _record(service, AuditAction.REQUEST_INGESTED)
    _record(service, AuditAction.REQUEST_EXTRACTED)
    actions = [event.action for event in repo.list_all()]
    assert actions == [AuditAction.REQUEST_INGESTED, AuditAction.REQUEST_EXTRACTED]
    # Mutating a returned copy must not touch the stored event.
    leaked = repo.list_all()[0]
    leaked.summary = "tampered"
    assert repo.list_all()[0].summary != "tampered"


def test_audit_write_failure_raises_typed_error():
    service = AuditService(FailingAuditRepository())
    with pytest.raises(AuditWriteError):
        _record(service)


def test_timeline_is_chronological_and_scoped():
    repo = LocalAuditRepository()
    service = AuditService(repo)
    _record(service, AuditAction.REQUEST_INGESTED)
    _record(service, AuditAction.REQUEST_EXTRACTED)
    service.record(
        legal_request_id="LER-OTHER",
        actor_type=ActorType.SYSTEM,
        actor_id="test",
        action=AuditAction.REQUEST_INGESTED,
    )
    timeline = service.timeline("LER-TEST-1")
    assert [e.action for e in timeline] == [
        AuditAction.REQUEST_INGESTED,
        AuditAction.REQUEST_EXTRACTED,
    ]
    timestamps = [e.timestamp for e in timeline]
    assert timestamps == sorted(timestamps)


def test_missing_actions_reports_gaps():
    service = AuditService(LocalAuditRepository())
    _record(service, AuditAction.REQUEST_INGESTED)
    required = {AuditAction.REQUEST_INGESTED, AuditAction.ROUTE_APPROVED}
    assert service.missing_actions("LER-TEST-1", required) == ["route_approved"]
    assert not service.has_actions("LER-TEST-1", required)
