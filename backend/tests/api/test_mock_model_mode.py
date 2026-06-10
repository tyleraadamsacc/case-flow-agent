"""MODEL_MODE=mock_model end to end: the rail runs credential-free with
model-assisted drafts, metadata is stamped on the persisted AgentRuns,
ETL/Automation/Indexing stay deterministic, and the one-audit-event-per-
run invariant holds. Deterministic mode stays byte-for-byte unchanged
(the rest of the suite runs it)."""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

SCENARIO_A = "LER-2026-004812"
MODEL_ASSISTED = {"triaging_agent", "note_taking_and_data_entry_agent", "text_content_agent"}
PINNED_DETERMINISTIC = {"indexing_agent", "etl_agent", "automation_agent"}


@pytest.fixture()
def mock_mode_client() -> TestClient:
    return TestClient(create_app(Settings(model_mode="mock_model", log_level="WARNING")))


def run_rail(client: TestClient, request_id: str) -> list[dict]:
    for step in ("extract", "validate"):
        response = client.post(f"/api/legal-requests/{request_id}/{step}")
        assert response.status_code == 200, response.text
    response = client.post(f"/api/legal-requests/{request_id}/agents/run")
    assert response.status_code == 200, response.text
    return response.json()["agent_runs"]


def test_mock_model_rail_stamps_metadata_and_keeps_safety_critical_deterministic(
    mock_mode_client,
):
    runs = run_rail(mock_mode_client, SCENARIO_A)
    assert len(runs) == 6
    by_agent = {run["agent_id"]: run for run in runs}

    for agent_id in MODEL_ASSISTED:
        run = by_agent[agent_id]
        assert run["model_id"] == "mock-model", agent_id
        assert run["prompt_version"], agent_id
        assert run["validation_status"] == "valid"
        assert run["status"] == "complete"

    for agent_id in PINNED_DETERMINISTIC:
        run = by_agent[agent_id]
        assert run["model_id"] is None, agent_id
        assert run["prompt_version"] is None, agent_id

    # Exactly one audit event per agent run — failure or success alike.
    events = mock_mode_client.get(f"/api/legal-requests/{SCENARIO_A}/audit").json()
    agent_events = [event for event in events if event["actor_type"] == "agent"]
    assert len(agent_events) == 6


def test_mock_model_classification_is_adopted_and_still_pending_human(
    mock_mode_client,
):
    run_rail(mock_mode_client, SCENARIO_A)
    detail = mock_mode_client.get(f"/api/legal-requests/{SCENARIO_A}").json()
    classification = detail["classification"]
    assert classification["request_category"] == "mock_model_classification"
    # The model-assisted draft demands review; routing stays a
    # recommendation pending human approval.
    assert classification["human_review_required"] is True
    assert detail["routing_recommendation"]["status"] == "recommended_pending_human"
    # The record index remains deterministic ETL output, never model text.
    package = mock_mode_client.get(
        f"/api/legal-requests/{SCENARIO_A}/production-package"
    ).json()
    assert package["status"] == "draft_pending_analyst_review"
    assert all(record["data_confidence"] == "synthetic_mock" for record in package["records"])
