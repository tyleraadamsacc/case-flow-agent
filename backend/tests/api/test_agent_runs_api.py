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


def rail(client, legal_request_id: str) -> dict:
    response = client.post(f"/api/legal-requests/{legal_request_id}/agents/run")
    assert response.status_code == 200, response.text
    return response.json()


def test_rail_returns_six_runs_in_order_and_persists_them(
    client, advance_to_review
):
    advance_to_review("LER-2026-004812")
    body = rail(client, "LER-2026-004812")
    assert [run["agent_id"] for run in body["agent_runs"]] == list(RAIL_ORDER)
    assert all(run["status"] == "complete" for run in body["agent_runs"])

    persisted = client.get("/api/legal-requests/LER-2026-004812/agent-runs").json()
    assert [run["agent_run_id"] for run in persisted] == [
        run["agent_run_id"] for run in body["agent_runs"]
    ]
    detail = client.get("/api/legal-requests/LER-2026-004812").json()
    assert set(detail["agent_runs"]) == set(RAIL_ORDER)
    # Agent execution never moves the legal workflow state.
    assert detail["workflow_state"] == "analyst_review_pending"


def test_rail_audit_timeline_contains_all_six_agent_events(client, advance_to_review):
    advance_to_review("LER-2026-004812")
    rail(client, "LER-2026-004812")
    events = client.get("/api/legal-requests/LER-2026-004812/audit").json()
    agent_actions = [e["action"] for e in events if e["actor_type"] == "agent"]
    assert agent_actions == [
        "request_indexed",
        "request_classified",
        "etl_simulated",
        "note_drafted",
        "production_package_drafted",
        "workflow_action_prepared",
    ]


def test_rail_scenario_b_shows_etl_blocked_on_missing_date_range(
    client, advance_to_review
):
    advance_to_review("LER-2026-004821")
    runs = {run["agent_id"]: run for run in rail(client, "LER-2026-004821")["agent_runs"]}
    etl = runs["etl_agent"]
    assert etl["status"] == "blocked"
    assert "missing_date_range" in etl["blocked_reason"]
    assert "date range" in etl["output_summary"]
    # The blocked step is visible in the rail rather than disappearing.
    assert len(runs) == 6


def test_rail_scenario_c_blocks_etl_and_prepares_sme_escalation(
    client, advance_to_review
):
    advance_to_review("LER-2026-004835")
    runs = {run["agent_id"]: run for run in rail(client, "LER-2026-004835")["agent_runs"]}
    assert runs["etl_agent"]["status"] == "blocked"
    assert runs["etl_agent"]["blocked_reason"] == "sme_escalation_pending"
    text_draft = runs["text_content_agent"]["output"]["text_draft"]
    assert text_draft["draft_type"] == "sme_notification"
    automation = runs["automation_agent"]["output"]["automation_output"]
    assert automation["action_type"] == "prepare_sme_escalation"
    assert automation["status"] == "prepared_pending_human"
    assert "Pen register" in automation["reason"]


def test_rail_scenario_d_blocks_etl_on_overbroad_scope(client, advance_to_review):
    advance_to_review("LER-2026-004842")
    runs = {run["agent_id"]: run for run in rail(client, "LER-2026-004842")["agent_runs"]}
    assert runs["etl_agent"]["status"] == "blocked"
    assert runs["etl_agent"]["blocked_reason"] == "overbroad_scope_pending_review"
    indexing = runs["indexing_agent"]["output"]["indexing_output"]
    assert len(indexing["product_domains"]) >= 7  # multi-domain surfaced
    automation = runs["automation_agent"]["output"]["automation_output"]
    assert automation["action_type"] == "prepare_sme_assignment"


def test_rail_scenario_f_etl_completes_with_zero_records(client, advance_to_review):
    advance_to_review("LER-2026-004863")
    runs = {run["agent_id"]: run for run in rail(client, "LER-2026-004863")["agent_runs"]}
    etl = runs["etl_agent"]
    assert etl["status"] == "complete"
    etl_output = etl["output"]["etl_output"]
    assert etl_output["total_responsive_records"] == 0
    assert etl_output["data_confidence"] == "synthetic_mock"
    text_draft = runs["text_content_agent"]["output"]["text_draft"]
    assert text_draft["draft_type"] == "no_responsive_records"


def test_rail_scenario_a_etl_returns_exactly_eight_synthetic_records(
    client, advance_to_review
):
    advance_to_review("LER-2026-004812")
    runs = {run["agent_id"]: run for run in rail(client, "LER-2026-004812")["agent_runs"]}
    etl_output = runs["etl_agent"]["output"]["etl_output"]
    assert etl_output["total_responsive_records"] == 8
    assert etl_output["data_confidence"] == "synthetic_mock"
    assert "No production backend connected" in etl_output["limitations"]
    assert len(runs["etl_agent"]["output"]["records"]) == 8


def test_rail_refused_before_extraction(client):
    response = client.post("/api/legal-requests/LER-2026-004812/agents/run")
    assert response.status_code == 409
    assert response.json()["state"] == "request_received"


def test_rail_audit_write_failure_persists_no_runs(client, container, advance_to_review):
    from tests.unit.test_audit_service import FailingAuditRepository

    advance_to_review("LER-2026-004812")
    container.audit_service.repository = FailingAuditRepository()
    response = client.post("/api/legal-requests/LER-2026-004812/agents/run")
    assert response.status_code == 503
    assert container.agent_run_repository.list_for_request("LER-2026-004812") == []
