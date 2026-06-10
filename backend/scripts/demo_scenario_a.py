"""Backend-only demo runner: Scenario A end to end.

Builds a fresh in-process app (all local repositories start empty, so
every run IS a reset), seeds the synthetic scenarios, walks Scenario A
through extract → validate → six-agent rail → review → approve, and
prints the request id, the six agent statuses by official RFP name, the
response package status, the audit event count, and the governance
agent-activity summary. Zero credentials; nothing leaves the process.

Run via: make demo-scenario-a
"""

import logging

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

SCENARIO_A = "LER-2026-004812"


def line(text: str = "") -> None:
    print(text)


def main() -> None:
    logging.disable(logging.INFO)  # keep demo output readable
    client = TestClient(create_app(Settings(log_level="WARNING")))

    line("CaseFlow Agent — Scenario A backend demo (synthetic data only)")
    line("=" * 64)

    for step in ("extract", "validate"):
        response = client.post(f"/api/legal-requests/{SCENARIO_A}/{step}")
        response.raise_for_status()
    rail = client.post(f"/api/legal-requests/{SCENARIO_A}/agents/run")
    rail.raise_for_status()
    client.post(
        f"/api/legal-requests/{SCENARIO_A}/review",
        json={"action": "approve", "comments": "Demo review."},
    ).raise_for_status()
    approve = client.post(f"/api/legal-requests/{SCENARIO_A}/approve", json={})
    approve.raise_for_status()

    line(f"Request: {SCENARIO_A}")
    line(f"Workflow state: {approve.json()['legal_request']['workflow_state']}")
    line()
    line("Six-Agent Workflow Rail:")
    for run in rail.json()["agent_runs"]:
        confidence = f"  confidence={run['confidence']}" if run["confidence"] else ""
        line(f"  [{run['status']:>8}] {run['agent_name']}{confidence}")
        line(f"             {run['output_summary']}")

    package = client.get(f"/api/legal-requests/{SCENARIO_A}/production-package")
    package.raise_for_status()
    body = package.json()
    line()
    line(
        f"Response package: {body['production_id']} — status: {body['status']} "
        f"({body['production_summary']['total_responsive_records']} synthetic records)"
    )

    events = client.get(f"/api/legal-requests/{SCENARIO_A}/audit").json()
    line(f"Audit events for {SCENARIO_A}: {len(events)}")

    line()
    line("Governance — RFP Agent Coverage:")
    for agent in client.get("/api/governance/agent-activity").json()["agents"]:
        average = (
            f"  avg confidence={agent['average_confidence']}"
            if agent["average_confidence"] is not None
            else ""
        )
        line(
            f"  {agent['agent_name']:<34} runs={agent['runs_total']} "
            f"blocked={agent['runs_blocked']} audit_events={agent['audit_events']}"
            f"{average}"
        )
    line()
    line("Done. Drafts remain pending human approval; nothing was sent or released.")


if __name__ == "__main__":
    main()
