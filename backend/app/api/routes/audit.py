from fastapi import APIRouter, Depends

from app.api.deps import Container, get_container
from app.errors import NotFoundError
from app.models.audit_event import AuditEvent
from app.models.enums import ActorType, AuditAction

router = APIRouter(tags=["audit"])


@router.get("/api/legal-requests/{legal_request_id}/audit")
def request_audit_timeline(
    legal_request_id: str, container: Container = Depends(get_container)
) -> list[AuditEvent]:
    if container.legal_request_repository.get(legal_request_id) is None:
        raise NotFoundError("legal_request", legal_request_id)
    return container.audit_service.timeline(legal_request_id)


@router.get("/api/audit/events")
def audit_events(
    legal_request_id: str | None = None,
    action: AuditAction | None = None,
    actor_type: ActorType | None = None,
    actor_id: str | None = None,
    container: Container = Depends(get_container),
) -> list[AuditEvent]:
    events = container.audit_repository.list_all()
    if legal_request_id is not None:
        events = [e for e in events if e.legal_request_id == legal_request_id]
    if action is not None:
        events = [e for e in events if e.action == action]
    if actor_type is not None:
        events = [e for e in events if e.actor_type == actor_type]
    if actor_id is not None:
        events = [e for e in events if e.actor_id == actor_id]
    return sorted(events, key=lambda e: e.timestamp)
