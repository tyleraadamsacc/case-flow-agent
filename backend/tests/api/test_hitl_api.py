"""Human-in-the-lead behavior: inline overrides (theme A), per-agent
send-back/accept (theme C), dual control (theme B), and the
pre-finalization attestation checklist (theme E).

All four reinforce the same invariant the rest of the suite guards: a
person, never an agent, decides — and every human action is audited.
"""

SEARCH_WARRANT = "LER-2026-004812"  # high sensitivity in the full dataset
SUBSCRIBER = "LER-2026-004850"  # low sensitivity
MISSING_DATES = "LER-2026-004821"  # blocking missing_date_range

SENIOR = {"X-CaseFlow-Actor": "senior.local", "X-CaseFlow-Role": "senior_analyst"}


def timeline_actions(client, legal_request_id: str) -> list[str]:
    return [
        event["action"]
        for event in client.get(f"/api/legal-requests/{legal_request_id}/audit").json()
    ]


# --------------------------- theme A: overrides ---------------------------


def test_period_override_clears_blocking_deficiency(client, advance_to_review):
    advance_to_review(MISSING_DATES)
    response = client.post(
        f"/api/legal-requests/{MISSING_DATES}/override",
        json={
            "target": "requested_period",
            "reason": "Date range confirmed with the requesting agency.",
            "period_start": "2026-05-10",
            "period_end": "2026-05-15",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["override"]["target"] == "requested_period"
    assert "missing_date_range" in body["override"]["cleared_deficiencies"]
    assert body["override"]["overridden_by"] == "analyst.local"
    # The corrected request no longer carries the blocking deficiency.
    codes = [f["code"] for f in body["legal_request"]["deficiency_findings"]]
    assert "missing_date_range" not in codes
    assert body["audit_event"]["action"] == "human_override_applied"
    assert "human_override_applied" in timeline_actions(client, MISSING_DATES)


def test_route_override_replaces_recommended_queue(client, advance_to_review):
    advance_to_review(SUBSCRIBER)
    client.post(f"/api/legal-requests/{SUBSCRIBER}/agents/run")
    response = client.post(
        f"/api/legal-requests/{SUBSCRIBER}/override",
        json={
            "target": "recommended_queue",
            "reason": "Reassigning to the location desk.",
            "text_value": "Location Response Review",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["override"]["after_value"] == "Location Response Review"
    assert (
        body["legal_request"]["routing_recommendation"]["target_queue"]
        == "Location Response Review"
    )


def test_production_summary_override_updates_drafted_package(client, advance_to_review):
    advance_to_review(SEARCH_WARRANT)
    client.post(f"/api/legal-requests/{SEARCH_WARRANT}/agents/run")
    client.post(f"/api/legal-requests/{SEARCH_WARRANT}/production-package/draft")

    response = client.post(
        f"/api/legal-requests/{SEARCH_WARRANT}/override",
        json={
            "target": "production_summary_text",
            "reason": "Analyst tightened the ordinary-course wording.",
            "text_value": "Analyst-reviewed summary text for the draft package.",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["override"]["target"] == "production_summary_text"
    assert body["override"]["after_value"] == (
        "Analyst-reviewed summary text for the draft package."
    )
    assert (
        body["legal_request"]["production_package"]["production_summary"][
            "ordinary_course_statement"
        ]
        == "Analyst-reviewed summary text for the draft package."
    )


def test_override_with_missing_value_is_rejected(client, advance_to_review):
    advance_to_review(SUBSCRIBER)
    response = client.post(
        f"/api/legal-requests/{SUBSCRIBER}/override",
        json={"target": "recommended_queue", "reason": "no value supplied"},
    )
    assert response.status_code == 422


# --------------------------- theme E: attestations ---------------------------


def test_attestation_required_set_and_duplicate_handling(client, advance_to_review):
    advance_to_review(SUBSCRIBER)
    status = client.get(
        f"/api/legal-requests/{SUBSCRIBER}/finalization-status"
    ).json()
    expected = [
        "scope_verified",
        "identifiers_match",
        "authority_scope_match_confirmed",
    ]
    assert status["required_attestations"] == expected
    assert status["missing_attestations"] == expected
    assert status["ready_for_approval"] is False

    first = client.post(
        f"/api/legal-requests/{SUBSCRIBER}/attest", json={"item": "scope_verified"}
    )
    assert first.status_code == 200
    assert first.json()["satisfied"] is False  # identifiers_match still missing

    # Re-attesting the same item is a conflict, not a silent duplicate.
    dup = client.post(
        f"/api/legal-requests/{SUBSCRIBER}/attest", json={"item": "scope_verified"}
    )
    assert dup.status_code == 409

    # An item that is not required for this request is rejected.
    not_required = client.post(
        f"/api/legal-requests/{SUBSCRIBER}/attest",
        json={"item": "sealed_handling_acknowledged"},
    )
    assert not_required.status_code == 422


def test_missing_attestations_block_approval(client, advance_to_review):
    advance_to_review(SUBSCRIBER)
    response = client.post(f"/api/legal-requests/{SUBSCRIBER}/approve", json={})
    assert response.status_code == 409
    assert "missing_attestations" in response.text
    assert "finalization_blocked" in timeline_actions(client, SUBSCRIBER)


# --------------------------- theme B: dual control ---------------------------


def test_high_sensitivity_request_requires_two_distinct_senior_cosign(
    client, advance_to_review
):
    advance_to_review(SEARCH_WARRANT)
    status = client.get(
        f"/api/legal-requests/{SEARCH_WARRANT}/finalization-status"
    ).json()
    assert status["approvals_required"] == 2
    assert status["requires_senior_approval"] is True
    for item in status["required_attestations"]:
        assert (
            client.post(
                f"/api/legal-requests/{SEARCH_WARRANT}/attest", json={"item": item}
            ).status_code
            == 200
        )

    # First approval is recorded but awaits a co-signer.
    first = client.post(f"/api/legal-requests/{SEARCH_WARRANT}/approve", json={})
    assert first.status_code == 200
    assert first.json()["awaiting_approval"] is True
    assert first.json()["finalized"] is False
    assert first.json()["approvals_recorded"] == 1

    # The same actor cannot supply the second approval.
    again = client.post(f"/api/legal-requests/{SEARCH_WARRANT}/approve", json={})
    assert again.status_code == 409

    # A different but non-senior reviewer cannot finalize.
    junior = client.post(
        f"/api/legal-requests/{SEARCH_WARRANT}/approve",
        json={},
        headers={"X-CaseFlow-Actor": "analyst.two", "X-CaseFlow-Role": "analyst"},
    )
    assert junior.status_code == 403

    # A senior co-signer completes finalization.
    senior = client.post(
        f"/api/legal-requests/{SEARCH_WARRANT}/approve", json={}, headers=SENIOR
    )
    assert senior.status_code == 200, senior.text
    assert senior.json()["finalized"] is True
    assert senior.json()["approvals_recorded"] == 2
    assert senior.json()["legal_request"]["workflow_state"] == "audit_complete"


# --------------------------- theme C: per-agent control ---------------------------


def test_single_agent_rerun_records_send_back_and_new_run(client, advance_to_review):
    advance_to_review(SEARCH_WARRANT)
    client.post(f"/api/legal-requests/{SEARCH_WARRANT}/agents/run")
    runs_before = client.get(f"/api/legal-requests/{SEARCH_WARRANT}/agent-runs").json()
    triaging_before = len([r for r in runs_before if r["agent_id"] == "triaging_agent"])

    response = client.post(
        f"/api/legal-requests/{SEARCH_WARRANT}/agents/triaging_agent/rerun",
        json={"instruction": "Re-classify; the legal process was corrected."},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["agent_run"]["agent_id"] == "triaging_agent"
    assert body["agent_run_review"]["decision"] == "sent_back"
    assert body["agent_run_review"]["instruction"].startswith("Re-classify")
    assert "Human instruction: Re-classify" in body["agent_run"]["input_summary"]
    assert body["agent_run"]["output"]["human_instruction"].startswith("Re-classify")
    assert body["audit_event"]["action"] == "agent_run_sent_back"

    runs_after = client.get(f"/api/legal-requests/{SEARCH_WARRANT}/agent-runs").json()
    triaging_after = len([r for r in runs_after if r["agent_id"] == "triaging_agent"])
    assert triaging_after == triaging_before + 1


def test_accept_records_human_verdict_on_agent_run(client, advance_to_review):
    advance_to_review(SEARCH_WARRANT)
    client.post(f"/api/legal-requests/{SEARCH_WARRANT}/agents/run")
    response = client.post(
        f"/api/legal-requests/{SEARCH_WARRANT}/agents/indexing_agent/accept",
        json={"comments": "Labels look right."},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["agent_run_review"]["decision"] == "accepted"
    assert body["agent_run_review"]["agent_id"] == "indexing_agent"
    assert body["audit_event"]["action"] == "agent_run_accepted"
    detail = client.get(f"/api/legal-requests/{SEARCH_WARRANT}").json()
    assert any(
        review["decision"] == "accepted" and review["agent_id"] == "indexing_agent"
        for review in detail["agent_run_reviews"]
    )


def test_accepted_agent_run_is_pinned_across_full_rail_rerun(client, advance_to_review):
    advance_to_review(SEARCH_WARRANT)
    first_rail = client.post(f"/api/legal-requests/{SEARCH_WARRANT}/agents/run").json()
    accepted_run_id = next(
        run["agent_run_id"]
        for run in first_rail["agent_runs"]
        if run["agent_id"] == "indexing_agent"
    )
    accept = client.post(
        f"/api/legal-requests/{SEARCH_WARRANT}/agents/indexing_agent/accept",
        json={"comments": "Indexing labels accepted."},
    )
    assert accept.status_code == 200, accept.text

    second_rail = client.post(f"/api/legal-requests/{SEARCH_WARRANT}/agents/run").json()
    indexing = next(
        run for run in second_rail["agent_runs"] if run["agent_id"] == "indexing_agent"
    )
    assert indexing["agent_run_id"] == accepted_run_id
    detail = client.get(f"/api/legal-requests/{SEARCH_WARRANT}").json()
    assert detail["agent_runs"]["indexing_agent"]["agent_run_id"] == accepted_run_id


def test_rerun_unknown_agent_is_not_found(client, advance_to_review):
    advance_to_review(SUBSCRIBER)
    response = client.post(
        f"/api/legal-requests/{SUBSCRIBER}/agents/not_an_agent/rerun", json={}
    )
    assert response.status_code == 404


def test_accept_with_no_run_is_conflict(client, advance_to_review):
    advance_to_review(SUBSCRIBER)
    response = client.post(
        f"/api/legal-requests/{SUBSCRIBER}/agents/indexing_agent/accept", json={}
    )
    assert response.status_code == 409
