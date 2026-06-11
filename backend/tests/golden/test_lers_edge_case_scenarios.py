"""Additional LERS edge-case coverage for Agent 4's mock corpus.

These scenarios intentionally use new fixture IDs so the original twelve
golden paths remain stable.
"""

SCENARIO_I_PLACEHOLDERS = "LER-2026-004901"
SCENARIO_J_MISSING_AUTHORITY = "LER-2026-004912"
SCENARIO_K_OVERBROAD = "LER-2026-004923"
SCENARIO_L_ONGOING = "LER-2026-004934"
SCENARIO_M_NO_RECORDS = "LER-2026-004945"
SCENARIO_N_PACKAGE_DEFECTS = "LER-2026-004956"


def run_rail(client, advance_to_review, legal_request_id: str) -> dict:
    advance_to_review(legal_request_id)
    response = client.post(f"/api/legal-requests/{legal_request_id}/agents/run")
    assert response.status_code == 200, response.text
    return {run["agent_id"]: run for run in response.json()["agent_runs"]}


def finding_codes(response_body: dict) -> set[str]:
    return {finding["code"] for finding in response_body["deficiency_findings"]}


def test_unresolved_template_fields_create_blocking_deficiency_and_review_reason(
    client,
):
    extract = client.post(f"/api/legal-requests/{SCENARIO_I_PLACEHOLDERS}/extract")
    assert extract.status_code == 200, extract.text
    request = extract.json()["legal_request"]
    assert request["requesting_agency"]["officer"] is None
    assert [identifier["value"] for identifier in request["subject_identifiers"]] == [
        "UID-449120"
    ]

    validate = client.post(f"/api/legal-requests/{SCENARIO_I_PLACEHOLDERS}/validate")
    assert validate.status_code == 200, validate.text
    body = validate.json()
    assert {
        "missing_date_range",
        "unresolved_template_placeholder",
    } <= finding_codes(body)
    assert "template_placeholder_unresolved" in body["approval_policy"][
        "review_reasons"
    ]
    assert "unresolved_template_placeholder" in body["approval_policy"][
        "blocking_reasons"
    ]

    runs = client.post(
        f"/api/legal-requests/{SCENARIO_I_PLACEHOLDERS}/agents/run"
    ).json()["agent_runs"]
    etl = next(run for run in runs if run["agent_id"] == "etl_agent")
    assert etl["status"] == "blocked"
    assert "unresolved_template_placeholder" in etl["blocked_reason"]


def test_missing_content_authority_routes_review_without_blocking_extraction(client):
    client.post(f"/api/legal-requests/{SCENARIO_J_MISSING_AUTHORITY}/extract")
    validate = client.post(f"/api/legal-requests/{SCENARIO_J_MISSING_AUTHORITY}/validate")
    assert validate.status_code == 200, validate.text
    body = validate.json()
    assert "scope_authority_mismatch" in finding_codes(body)
    assert "scope_authority_mismatch" in body["approval_policy"]["review_reasons"]
    assert "scope_authority_mismatch" not in body["approval_policy"][
        "blocking_reasons"
    ]
    checks = body["legal_request"]["scope_authority_checks"]
    assert any(
        check["category"] == "Email Contents and Attachments"
        and check["status"] == "missing_authority"
        for check in checks
    )


def test_overbroad_variant_routes_to_sme_narrowing_and_blocks_retrieval(
    client, advance_to_review
):
    runs = run_rail(client, advance_to_review, SCENARIO_K_OVERBROAD)
    classification = runs["triaging_agent"]["output"]["classification"]
    assert classification["recommended_queue"] == "SME Review"
    assert "overbroad_scope" in classification["review_reasons"]
    assert classification["request_category"] == "Multi-Product Data Production"

    etl = runs["etl_agent"]
    assert etl["status"] == "blocked"
    assert etl["blocked_reason"] == "overbroad_scope_pending_review"
    draft = runs["text_content_agent"]["output"]["text_draft"]
    assert draft["draft_type"] == "deficiency_response"
    automation = runs["automation_agent"]["output"]["automation_output"]
    assert automation["action_type"] == "prepare_sme_assignment"
    assert "narrowing" in " ".join(automation["follow_up_tasks"]).lower()


def test_no_records_variant_drafts_no_responsive_records_package(
    client, advance_to_review
):
    runs = run_rail(client, advance_to_review, SCENARIO_M_NO_RECORDS)
    etl_output = runs["etl_agent"]["output"]["etl_output"]
    assert runs["etl_agent"]["status"] == "complete"
    assert etl_output["records_ref"] == "local://response_records/empty_records_scenario_m.json"
    assert etl_output["total_responsive_records"] == 0

    draft = runs["text_content_agent"]["output"]["text_draft"]
    assert draft["draft_type"] == "no_responsive_records"
    package = runs["text_content_agent"]["output"]["production_package"]
    assert package["records"] == []
    assert package["production_summary"]["total_responsive_records"] == 0
    automation = runs["automation_agent"]["output"]["automation_output"]
    assert automation["action_type"] == "prepare_no_records_review_task"


def test_ongoing_collection_variant_requires_sme_and_attestation(
    client, advance_to_review
):
    advance_to_review(SCENARIO_L_ONGOING)
    status = client.get(
        f"/api/legal-requests/{SCENARIO_L_ONGOING}/finalization-status"
    ).json()
    assert "ongoing_collection_reviewed" in status["required_attestations"]

    runs = client.post(
        f"/api/legal-requests/{SCENARIO_L_ONGOING}/agents/run"
    ).json()["agent_runs"]
    triaging = next(run for run in runs if run["agent_id"] == "triaging_agent")
    classification = triaging["output"]["classification"]
    assert classification["recommended_queue"] == "SME Review"
    assert "ongoing_collection_requested" in classification["review_reasons"]
    assert "sealed_order_requested" in classification["review_reasons"]
    etl = next(run for run in runs if run["agent_id"] == "etl_agent")
    assert etl["blocked_reason"] == "sme_escalation_pending"


def test_package_validation_variant_surfaces_record_count_and_certification_blocks(
    client, container, advance_to_review
):
    runs = run_rail(client, advance_to_review, SCENARIO_N_PACKAGE_DEFECTS)
    package = runs["text_content_agent"]["output"]["production_package"]
    assert package["production_summary"]["total_responsive_records"] == 2
    assert len(package["records"]) == 2
    assert package["validation_findings"] == []

    request = container.legal_request_repository.get(SCENARIO_N_PACKAGE_DEFECTS)
    request.production_package.production_summary.total_responsive_records = 3
    request.production_package.certification.authorized_representative = None
    container.legal_request_repository.save(request)

    package_response = client.get(
        f"/api/legal-requests/{SCENARIO_N_PACKAGE_DEFECTS}/production-package"
    )
    assert package_response.status_code == 200, package_response.text
    findings = {
        finding["code"]: finding
        for finding in package_response.json()["validation_findings"]
    }
    assert findings["record_count_mismatch"]["section"] == "record_index"
    assert findings["certification_incomplete"]["section"] == "certification"

    status = client.get(
        f"/api/legal-requests/{SCENARIO_N_PACKAGE_DEFECTS}/finalization-status"
    ).json()
    assert "record_count_mismatch" in status["blocking_reasons"]
    assert "certification_incomplete" in status["blocking_reasons"]

    approve = client.post(
        f"/api/legal-requests/{SCENARIO_N_PACKAGE_DEFECTS}/approve", json={}
    )
    assert approve.status_code == 409
    assert {"record_count_mismatch", "certification_incomplete"} <= set(
        approve.json()["reasons"]
    )
