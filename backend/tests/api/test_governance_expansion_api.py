"""Governance expansion: RFP Agent Coverage, work-needing-attention,
volume/time/bottleneck/readiness/package-status endpoints, and the
agent filter on the global audit query."""

from app.adk_agents.registry import OFFICIAL_AGENT_NAMES, RAIL_ORDER

OFFICIAL_NAMES = [OFFICIAL_AGENT_NAMES[agent_id] for agent_id in RAIL_ORDER]


def run_rail(client, advance_to_review, legal_request_id):
    advance_to_review(legal_request_id)
    response = client.post(f"/api/legal-requests/{legal_request_id}/agents/run")
    assert response.status_code == 200, response.text


def test_agent_activity_lists_all_six_agents_even_with_zero_runs(client):
    agents = client.get("/api/governance/agent-activity").json()["agents"]
    assert [agent["agent_name"] for agent in agents] == OFFICIAL_NAMES
    assert all(agent["runs_total"] == 0 for agent in agents)
    assert all(agent["data_confidence"] == "fully_tracked" for agent in agents)


def test_agent_activity_counts_runs_blocks_audit_events_and_confidence(
    client, advance_to_review
):
    run_rail(client, advance_to_review, "LER-2026-004812")
    run_rail(client, advance_to_review, "LER-2026-004821")
    activity = {
        agent["agent_id"]: agent
        for agent in client.get("/api/governance/agent-activity").json()["agents"]
    }
    etl = activity["etl_agent"]
    assert etl["runs_total"] == 2
    assert etl["runs_completed"] == 1  # A completed
    assert etl["runs_blocked"] == 1  # B blocked on missing date range
    assert etl["audit_events"] == 2  # one audit event per run, blocked included

    triaging = activity["triaging_agent"]
    assert triaging["runs_total"] == 2
    assert triaging["average_confidence"] is not None
    assert 0.0 <= triaging["average_confidence"] <= 1.0
    assert set(triaging["requests_covered"]) == {"LER-2026-004812", "LER-2026-004821"}

    indexing = activity["indexing_agent"]
    assert indexing["agent_name"] == "Indexing Agent"
    assert indexing["runs_completed"] == 2


def test_work_needing_attention_surfaces_the_right_reasons(client, advance_to_review):
    run_rail(client, advance_to_review, "LER-2026-004821")  # blocking deficiency + blocked ETL
    run_rail(client, advance_to_review, "LER-2026-004835")  # special handling
    items = {
        item["legal_request_id"]: item
        for item in client.get("/api/governance/work-needing-attention").json()["items"]
    }

    deficient = items["LER-2026-004821"]
    assert any(r.startswith("blocking_deficiency:missing_date_range") for r in deficient["reasons"])
    assert any(r.startswith("etl_blocked:") for r in deficient["reasons"])
    assert deficient["related_agent_run_ids"]

    sensitive = items["LER-2026-004835"]
    assert any("special_handling:pen_register_requested" in r for r in sensitive["reasons"])
    assert sensitive["priority"] == 100
    # Special handling outranks everything else in the sort.
    ordered = client.get("/api/governance/work-needing-attention").json()["items"]
    assert ordered[0]["priority"] >= ordered[-1]["priority"]


def test_attention_includes_audit_exceptions(client, advance_to_review):
    advance_to_review("LER-2026-004821")
    client.post("/api/legal-requests/LER-2026-004821/approve", json={})  # blocked, audited
    items = {
        item["legal_request_id"]: item
        for item in client.get("/api/governance/work-needing-attention").json()["items"]
    }
    assert "audit_exception:finalization_blocked" in items["LER-2026-004821"]["reasons"]


def test_product_volume_counts_by_domain_with_confidence_labels(
    client, advance_to_review
):
    # Domains are populated by extraction.
    for legal_request_id in ("LER-2026-004812", "LER-2026-004821", "LER-2026-004863"):
        advance_to_review(legal_request_id)
    metrics = client.get("/api/governance/product-volume").json()["metrics"]
    by_domain = {m["metric_id"]: m for m in metrics}
    assert by_domain["product_volume:Maps / Location"]["value"] == 3  # A, B, F
    assert by_domain["product_volume:Account / Subscriber"]["value"] == 1  # B
    assert all(m["data_confidence"] == "synthetic_mock" for m in metrics)
    assert all(m["dimension"] == "product_domain" for m in metrics)


def test_processing_time_and_bottlenecks_are_estimated(client, advance_to_review):
    advance_to_review("LER-2026-004812")
    timing = client.get("/api/governance/processing-time-by-product").json()["metrics"]
    assert timing, "extract+validate should produce a measurable elapsed time"
    assert all(m["data_confidence"] == "estimated" for m in timing)
    assert all(m["unit"] == "hours" for m in timing)

    bottlenecks = client.get("/api/governance/bottlenecks").json()["metrics"]
    states = {m["metric_id"] for m in bottlenecks}
    assert "bottleneck:analyst_review_pending" in states
    assert all(m["data_confidence"] == "estimated" for m in bottlenecks)


def test_audit_readiness_reports_missing_events_and_blocks(
    client, advance_to_review, finalize
):
    advance_to_review("LER-2026-004850")
    report = client.get("/api/governance/audit-readiness").json()
    assert report["requests_total"] == 14
    # No request is approved yet, so route_approved is missing everywhere.
    assert report["requests_with_all_required_events"] == 0
    assert "route_approved" in report["missing_events_by_request"]["LER-2026-004850"]
    assert report["data_confidence"] == "fully_tracked"

    client.post(
        "/api/legal-requests/LER-2026-004850/review", json={"action": "approve"}
    )
    finalize("LER-2026-004850")
    report = client.get("/api/governance/audit-readiness").json()
    assert report["requests_with_all_required_events"] == 1
    assert "LER-2026-004850" not in report["missing_events_by_request"]


def test_response_package_status_counts(client, advance_to_review):
    before = {
        m["metric_id"]: m["value"]
        for m in client.get("/api/governance/response-package-status").json()["metrics"]
    }
    assert before["response_package:none"] == 14

    run_rail(client, advance_to_review, "LER-2026-004812")
    after = {
        m["metric_id"]: m["value"]
        for m in client.get("/api/governance/response-package-status").json()["metrics"]
    }
    assert after["response_package:draft_pending_analyst_review"] == 1
    assert after["response_package:none"] == 13


def test_audit_events_filter_by_agent_id_and_official_name(client, advance_to_review):
    run_rail(client, advance_to_review, "LER-2026-004812")
    by_id = client.get("/api/audit/events", params={"agent": "etl_agent"}).json()
    assert by_id and all(e["actor_id"] == "etl_agent" for e in by_id)

    by_name = client.get("/api/audit/events", params={"agent": "ETL Agent"}).json()
    assert [e["audit_event_id"] for e in by_name] == [e["audit_event_id"] for e in by_id]

    for official_name in OFFICIAL_NAMES:
        events = client.get("/api/audit/events", params={"agent": official_name}).json()
        assert len(events) == 1  # exactly one audit event per agent run

    assert (
        client.get("/api/audit/events", params={"agent": "mystery_agent"}).status_code
        == 422
    )
