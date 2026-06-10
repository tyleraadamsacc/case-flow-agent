from fastapi import APIRouter, Depends, HTTPException

from app.adk_agents.registry import OFFICIAL_AGENT_NAMES
from app.api.deps import Container, get_container
from app.errors import NotFoundError
from app.models.audit_event import AuditEvent
from app.models.enums import ActorType, AuditAction

router = APIRouter(tags=["audit"])

# ?agent= accepts the snake_case agent id or the exact official RFP name.
_AGENT_BY_OFFICIAL_NAME = {name: agent_id for agent_id, name in OFFICIAL_AGENT_NAMES.items()}


def resolve_agent_id(agent: str) -> str:
    if agent in OFFICIAL_AGENT_NAMES:
        return agent
    if agent in _AGENT_BY_OFFICIAL_NAME:
        return _AGENT_BY_OFFICIAL_NAME[agent]
    raise HTTPException(
        status_code=422,
        detail=(
            f"Unknown agent '{agent}'. Use one of: "
            + ", ".join(f"{i} / {n}" for i, n in OFFICIAL_AGENT_NAMES.items())
        ),
    )


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
    agent: str | None = None,
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
    if agent is not None:
        agent_id = resolve_agent_id(agent)
        events = [
            e for e in events if e.actor_type == ActorType.AGENT and e.actor_id == agent_id
        ]
    return sorted(events, key=lambda e: e.timestamp)
