"""Agent-run API visibility: GET .../agent-runs and detail hydration are
powered by the agent-run repository (the source of truth), never by ADK
session state."""

from app.adk_agents.registry import OFFICIAL_AGENT_NAMES, RAIL_ORDER
from app.models.agent_run import AgentRun
from app.models.enums import AgentRunStatus


def seed_runs(container, legal_request_id: str = "LER-2026-004812") -> list[AgentRun]:
    runs = []
    for agent_id in RAIL_ORDER:
        run = AgentRun(
            agent_id=agent_id,
            agent_name=OFFICIAL_AGENT_NAMES[agent_id],
            legal_request_id=legal_request_id,
            status=AgentRunStatus.COMPLETE,
            output_summary=f"{OFFICIAL_AGENT_NAMES[agent_id]} deterministic run.",
        )
        container.agent_run_repository.save(run)
        runs.append(run)
    return runs


def test_agent_runs_endpoint_returns_persisted_runs_in_order(client, container):
    seed_runs(container)
    response = client.get("/api/legal-requests/LER-2026-004812/agent-runs")
    assert response.status_code == 200
    body = response.json()
    assert [run["agent_id"] for run in body] == list(RAIL_ORDER)
    assert [run["agent_name"] for run in body] == [
        OFFICIAL_AGENT_NAMES[agent_id] for agent_id in RAIL_ORDER
    ]


def test_agent_runs_endpoint_404_for_unknown_request(client):
    assert client.get("/api/legal-requests/LER-NOPE/agent-runs").status_code == 404


def test_agent_runs_empty_before_any_execution(client):
    response = client.get("/api/legal-requests/LER-2026-004812/agent-runs")
    assert response.status_code == 200
    assert response.json() == []


def test_request_detail_hydrates_latest_run_per_agent(client, container):
    seed_runs(container)
    # A re-run of one agent must win over its earlier run in the detail map.
    rerun = AgentRun(
        agent_id="etl_agent",
        agent_name=OFFICIAL_AGENT_NAMES["etl_agent"],
        legal_request_id="LER-2026-004812",
        status=AgentRunStatus.COMPLETE,
        output_summary="8 synthetic GPS records found for requested period.",
    )
    container.agent_run_repository.save(rerun)

    detail = client.get("/api/legal-requests/LER-2026-004812").json()
    assert set(detail["agent_runs"]) == set(RAIL_ORDER)
    assert detail["agent_runs"]["etl_agent"]["agent_run_id"] == rerun.agent_run_id


def test_detail_agent_runs_come_from_repository_not_session_state(client, container):
    """Deleting from the repository must make runs disappear from the API:
    proof the repository is the source of truth."""
    runs = seed_runs(container)
    container.agent_run_repository._runs.clear()
    detail = client.get("/api/legal-requests/LER-2026-004812").json()
    assert detail["agent_runs"] == {}
    assert runs  # the runs existed, but only the repository feeds the API
