"""Agent-run execution and visibility endpoints.

``POST .../agents/run`` runs the full six-agent rail through
``CaseFlowRootAgent`` via the execution bridge; every response here is
served from the agent-run repository — never from ADK session state.
``.../agents/{agent_id}/rerun`` re-runs a single agent (theme C), and
``.../accept`` records a human's acceptance of one agent's output. No
agent endpoint can approve, finalize, release, or send anything.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.adk_agents.automation_agent import create_automation_agent
from app.adk_agents.etl_agent import create_etl_agent
from app.adk_agents.indexing_agent import create_indexing_agent
from app.adk_agents.note_taking_and_data_entry_agent import (
    create_note_taking_and_data_entry_agent,
)
from app.adk_agents.registry import OFFICIAL_AGENT_NAMES, RAIL_ORDER
from app.adk_agents.text_content_agent import create_text_content_agent
from app.adk_agents.triaging_agent import create_triaging_agent
from app.api.deps import Container, CurrentActor, get_container, get_current_actor
from app.api.schemas import (
    AgentAcceptBody,
    AgentRerunBody,
    AgentRunReviewResponse,
    RailRunResponse,
)
from app.errors import NotFoundError
from app.models.agent_run import AgentRun
from app.models.agent_run_review import AgentRunReview
from app.models.enums import ActorType, AgentRunDecision, AuditAction

router = APIRouter(prefix="/api/legal-requests", tags=["agent-runs"])


def _build_agent(container: Container, agent_id: str):
    """Construct one rail agent with the same wiring the root agent uses."""
    mock_dir = container.settings.mock_data_dir
    assist = container.agent_execution_service.llm_assist
    builders = {
        RAIL_ORDER[0]: lambda: create_indexing_agent(mock_dir),
        RAIL_ORDER[1]: lambda: create_triaging_agent(mock_dir, assist),
        RAIL_ORDER[2]: lambda: create_etl_agent(),
        RAIL_ORDER[3]: lambda: create_note_taking_and_data_entry_agent(assist),
        RAIL_ORDER[4]: lambda: create_text_content_agent(mock_dir, assist),
        RAIL_ORDER[5]: lambda: create_automation_agent(),
    }
    builder = builders.get(agent_id)
    if builder is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown agent '{agent_id}'. Valid agents: {', '.join(RAIL_ORDER)}.",
        )
    return builder()


def _latest_run(container: Container, legal_request_id: str, agent_id: str) -> AgentRun | None:
    latest: AgentRun | None = None
    for run in container.agent_run_repository.list_for_request(legal_request_id):
        if run.agent_id == agent_id:
            latest = run
    return latest


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


@router.post("/{legal_request_id}/agents/{agent_id}/rerun")
def rerun_agent(
    legal_request_id: str,
    agent_id: str,
    body: AgentRerunBody,
    container: Container = Depends(get_container),
    actor: CurrentActor = Depends(get_current_actor),
) -> AgentRunReviewResponse:
    """Send one agent's output back and re-run just that agent (theme C).

    The agent regenerates its output from current inputs — including any
    human field corrections (theme A) — so the human can fix a field and
    re-run the affected agent without re-running the whole rail. The
    instruction is recorded for the audit trail.
    """
    if container.legal_request_repository.get(legal_request_id) is None:
        raise NotFoundError("legal_request", legal_request_id)
    agent = _build_agent(container, agent_id)
    instruction = (body.instruction or "").strip() or None
    sent_back_event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.HUMAN,
        actor_id=actor.actor_id,
        action=AuditAction.AGENT_RUN_SENT_BACK,
        summary=(
            f"{OFFICIAL_AGENT_NAMES[agent_id]} re-run requested by human"
            + (f": {instruction}" if instruction else ".")
        ),
    )
    review = AgentRunReview(
        legal_request_id=legal_request_id,
        agent_id=agent_id,
        decision=AgentRunDecision.SENT_BACK,
        instruction=instruction,
        reviewed_by=actor.actor_id,
        role=actor.role,
        audit_event_id=sent_back_event.audit_event_id,
    )
    new_run = container.agent_execution_service.run_single(
        legal_request_id, agent, human_instruction=instruction
    )
    request = container.legal_request_repository.get(legal_request_id)
    review.agent_run_id = new_run.agent_run_id
    request.agent_run_reviews.append(review)
    container.legal_request_repository.save(request)
    return AgentRunReviewResponse(
        legal_request=request,
        agent_run=new_run,
        agent_run_review=review,
        audit_event=sent_back_event,
    )


@router.post("/{legal_request_id}/agents/{agent_id}/accept")
def accept_agent_run(
    legal_request_id: str,
    agent_id: str,
    body: AgentAcceptBody,
    container: Container = Depends(get_container),
    actor: CurrentActor = Depends(get_current_actor),
) -> AgentRunReviewResponse:
    """Record a human's acceptance of one agent's output (theme C). The
    acceptance is audited and shown on the rail; it never finalizes,
    releases, or sends anything."""
    request = container.legal_request_repository.get(legal_request_id)
    if request is None:
        raise NotFoundError("legal_request", legal_request_id)
    if agent_id not in RAIL_ORDER:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown agent '{agent_id}'. Valid agents: {', '.join(RAIL_ORDER)}.",
        )
    latest = _latest_run(container, legal_request_id, agent_id)
    if latest is None:
        raise HTTPException(
            status_code=409,
            detail=f"{OFFICIAL_AGENT_NAMES[agent_id]} has no run to accept yet.",
        )
    event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.HUMAN,
        actor_id=actor.actor_id,
        action=AuditAction.AGENT_RUN_ACCEPTED,
        summary=(
            f"{OFFICIAL_AGENT_NAMES[agent_id]} output accepted by human"
            + (f": {body.comments}" if body.comments else ".")
        ),
    )
    review = AgentRunReview(
        legal_request_id=legal_request_id,
        agent_id=agent_id,
        agent_run_id=latest.agent_run_id,
        decision=AgentRunDecision.ACCEPTED,
        instruction=body.comments,
        reviewed_by=actor.actor_id,
        role=actor.role,
        audit_event_id=event.audit_event_id,
    )
    request.agent_run_reviews.append(review)
    container.legal_request_repository.save(request)
    return AgentRunReviewResponse(
        legal_request=request,
        agent_run=latest,
        agent_run_review=review,
        audit_event=event,
    )
