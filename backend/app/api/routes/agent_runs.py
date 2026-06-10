"""Agent-run execution and visibility endpoints.

``POST .../agents/run`` runs the full six-agent rail through
``CaseFlowRootAgent`` via the execution bridge; every response here is
served from the agent-run repository — never from ADK session state.
No agent endpoint can approve, finalize, release, or send anything.
"""

from fastapi import APIRouter, Depends

from app.api.deps import Container, get_container
from app.api.schemas import RailRunResponse
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


@router.post("/{legal_request_id}/agents/run")
def run_agent_rail(
    legal_request_id: str, container: Container = Depends(get_container)
) -> RailRunResponse:
    runs = container.agent_execution_service.run_rail(legal_request_id)
    return RailRunResponse(
        legal_request=container.legal_request_repository.get(legal_request_id),
        agent_runs=runs,
    )
