"""Agent-run visibility endpoints.

Every response here is served from the agent-run repository — never from
ADK session state. ``POST .../agents/run`` (the full six-agent rail)
arrives with the execution bridge.
"""

from fastapi import APIRouter, Depends

from app.api.deps import Container, get_container
from app.errors import NotFoundError
from app.models.agent_run import AgentRun

router = APIRouter(prefix="/api/legal-requests", tags=["agent-runs"])


@router.get("/{legal_request_id}/agent-runs")
def list_agent_runs(
    legal_request_id: str, container: Container = Depends(get_container)
) -> list[AgentRun]:
    if container.legal_request_repository.get(legal_request_id) is None:
        raise NotFoundError("legal_request", legal_request_id)
    return container.agent_run_repository.list_for_request(legal_request_id)
