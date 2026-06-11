"""Golden flow for the two-document demo dataset (PR 12): the LERS
Request Template (placeholders filled from the Template LERS Response)
is the only seeded request, the warrant's special handling blocks the
ETL Agent until a human approves, and the post-approval rerun drafts a
response package matching the Template LERS Response — records verbatim,
PROD-2026-004812-01, Jane Doe certification — before human finalization
completes the audit."""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

REQUEST_ID = "LER-2026-004812"


@pytest.fixture()
def demo_client() -> TestClient:
    return TestClient(create_app(Settings(seed_dataset="demo", log_level="WARNING")))


def test_demo_dataset_seeds_only_the_two_document_scenario(demo_client):
    requests = demo_client.get("/api/legal-requests").json()
    assert [request["legal_request_id"] for request in requests] == [REQUEST_ID]
    detail = demo_client.get(f"/api/legal-requests/{REQUEST_ID}").json()
    assert "AFFIDAVIT FOR SEARCH WARRANT" in detail["raw_source_text"]
    assert "PLEASE DELETE" in detail["raw_source_text"]  # template block intact


def test_two_document_flow_blocks_then_human_approval_unlocks_production(demo_client):
    for step in ("extract", "validate"):
        response = demo_client.post(f"/api/legal-requests/{REQUEST_ID}/{step}")
        assert response.status_code == 200, response.text

    detail = demo_client.get(f"/api/legal-requests/{REQUEST_ID}").json()
    handling = detail["special_handling"]
    assert handling["pen_register_requested"] and handling["sealed"]
    assert handling["non_disclosure_to_subscriber"] and handling["tombstone_requested"]
    assert len(detail["product_domains"]) >= 10  # the warrant requests broadly

    # First rail run: the warrant's special handling holds the pull.
    rail = demo_client.post(f"/api/legal-requests/{REQUEST_ID}/agents/run").json()
    by_agent = {run["agent_id"]: run for run in rail["agent_runs"]}
    assert by_agent["etl_agent"]["status"] == "blocked"
    assert "SME escalation pending" in by_agent["etl_agent"]["output_summary"]
    text_draft = by_agent["text_content_agent"]["output"]["text_draft"]
    assert text_draft["draft_type"] == "sme_notification"
    assert by_agent["automation_agent"]["output"]["automation_output"]["action_type"] == (
        "prepare_sme_escalation"
    )

    # Finalizing now is refused: the latest ETL run is blocked.
    refused = demo_client.post(f"/api/legal-requests/{REQUEST_ID}/approve", json={})
    assert refused.status_code == 409
    assert "blocked_agent_runs" in refused.text

    # A human approves the route — the approval is what clears the hold.
    review = demo_client.post(
        f"/api/legal-requests/{REQUEST_ID}/review",
        json={"action": "approve", "comments": "Special handling reviewed (demo)."},
    )
    assert review.status_code == 200

    rerun = demo_client.post(f"/api/legal-requests/{REQUEST_ID}/agents/run").json()
    by_agent = {run["agent_id"]: run for run in rerun["agent_runs"]}
    assert by_agent["etl_agent"]["status"] == "complete"
    assert "8 synthetic GPS records" in by_agent["etl_agent"]["output_summary"]
    assert by_agent["note_taking_and_data_entry_agent"]["output"]["note_draft"][
        "note_type"
    ] == "response_prep_note"
    assert by_agent["automation_agent"]["output"]["automation_output"]["action_type"] == (
        "prepare_approval_task"
    )

    # The drafted package matches the Template LERS Response.
    package = demo_client.get(
        f"/api/legal-requests/{REQUEST_ID}/production-package"
    ).json()
    assert package["production_id"] == "PROD-2026-004812-01"
    assert package["status"] == "draft_pending_analyst_review"
    records = package["records"]
    assert len(records) == 8
    assert records[0]["record_id"] == "GPS-0001"
    assert records[0]["timestamp_utc"].startswith("2026-05-10T08:14:22")
    assert records[0]["latitude"] == 39.7421 and records[0]["longitude"] == -104.9915
    assert records[-1]["record_id"] == "GPS-0008"
    assert records[-1]["latitude"] == 39.6888 and records[-1]["accuracy_meters"] == 9
    assert all(record["source"] == "Mobile Device" for record in records)
    assert all(record["data_confidence"] == "synthetic_mock" for record in records)
    certification = package["certification"]
    assert certification["authorized_representative"] == "Jane Doe"
    assert certification["title"] == "Legal Operations Analyst"
    assert certification["status"] == "draft_pending_approval"
    custody = package["chain_of_custody"]
    assert custody["collected_by"] == "Legal Response Operations Team"

    # Human finalization completes the audit.
    approve = demo_client.post(f"/api/legal-requests/{REQUEST_ID}/approve", json={})
    assert approve.status_code == 200, approve.text
    assert approve.json()["finalized"] is True
    assert approve.json()["legal_request"]["workflow_state"] == "audit_complete"
