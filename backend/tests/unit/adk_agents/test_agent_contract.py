"""Six-agent contract tests over the real ADK execution path.

Parametrized over all six agents: execution yields a valid persisted
AgentRun with the exact official RFP name, exactly one audit event per
run (blocked runs included), and the repository — not ADK session state —
as the source of truth. No ADK path reaches an approved/final state.
"""

import pytest

from app.adk_agents.registry import ETL_AGENT, OFFICIAL_AGENT_NAMES, RAIL_ORDER
from app.models.agent_run import AgentRun
from app.models.enums import ActorType, AgentRunStatus

SCENARIO_A = "LER-2026-004812"
SCENARIO_B = "LER-2026-004821"


@pytest.fixture()
def rail_runs(client, container, advance_to_review):
    advance_to_review(SCENARIO_A)
    response = client.post(f"/api/legal-requests/{SCENARIO_A}/agents/run")
    assert response.status_code == 200, response.text
    return container.agent_run_repository.list_for_request(SCENARIO_A)


@pytest.mark.parametrize("agent_id", RAIL_ORDER)
def test_each_agent_produces_a_valid_persisted_run(rail_runs, agent_id):
    run = next(r for r in rail_runs if r.agent_id == agent_id)
    assert isinstance(run, AgentRun)
    assert run.agent_name == OFFICIAL_AGENT_NAMES[agent_id]  # exact RFP spelling
    assert run.legal_request_id == SCENARIO_A
    assert run.status == AgentRunStatus.COMPLETE
    assert run.output_summary
    assert run.output  # structured payload, validated on round-trip
    assert run.audit_event_id is not None
    assert run.started_at is not None and run.completed_at is not None
    assert run.latency_ms is not None and run.latency_ms >= 0
    assert run.model_id is None  # deterministic mode — no model involved
    if run.confidence is not None:
        assert 0.0 <= run.confidence <= 1.0


@pytest.mark.parametrize("agent_id", RAIL_ORDER)
def test_exactly_one_audit_event_per_run(rail_runs, container, agent_id):
    events = [
        event
        for event in container.audit_repository.list_for_request(SCENARIO_A)
        if event.actor_id == agent_id
    ]
    assert len(events) == 1
    assert events[0].actor_type == ActorType.AGENT
    run = next(r for r in rail_runs if r.agent_id == agent_id)
    assert run.audit_event_id == events[0].audit_event_id
    assert OFFICIAL_AGENT_NAMES[agent_id] in events[0].summary


def test_blocked_run_is_audited_and_visible(client, container, advance_to_review):
    advance_to_review(SCENARIO_B)
    client.post(f"/api/legal-requests/{SCENARIO_B}/agents/run")
    runs = container.agent_run_repository.list_for_request(SCENARIO_B)
    etl = next(r for r in runs if r.agent_id == ETL_AGENT)
    assert etl.status == AgentRunStatus.BLOCKED
    assert "missing_date_range" in (etl.blocked_reason or "")
    events = [
        e
        for e in container.audit_repository.list_for_request(SCENARIO_B)
        if e.actor_id == ETL_AGENT
    ]
    assert len(events) == 1  # blocked runs are audited, not skipped
    assert "Blocked" in events[0].summary


def test_no_agent_run_uses_a_generic_name(rail_runs):
    for run in rail_runs:
        assert "ai_agent" not in run.agent_id
        assert run.agent_name in set(OFFICIAL_AGENT_NAMES.values())


def test_adk_path_cannot_reach_an_approved_or_final_state(rail_runs, client, container):
    detail = client.get(f"/api/legal-requests/{SCENARIO_A}").json()
    # Workflow state untouched by agent execution.
    assert detail["workflow_state"] == "analyst_review_pending"
    # No approval decision was created by any agent.
    assert detail["approvals"] == []
    # Every drafted artifact is structurally non-final.
    request = container.legal_request_repository.get(SCENARIO_A)
    assert request.production_package.status == "draft_pending_analyst_review"
    assert request.production_package.certification.status == "draft_pending_approval"
    assert request.routing_recommendation.status == "recommended_pending_human"
    for draft in request.text_drafts:
        assert draft.status == "draft_not_final"
    for note in request.note_drafts:
        assert note.requires_human_approval is True


def test_runs_are_served_from_repository_not_session_state(rail_runs, client, container):
    assert [run.agent_id for run in rail_runs] == list(RAIL_ORDER)
    container.agent_run_repository._runs.clear()
    assert client.get(f"/api/legal-requests/{SCENARIO_A}/agent-runs").json() == []
