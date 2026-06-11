import pytest

from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import (
    AttestationItem,
    DeficiencyCode,
    DeficiencySeverity,
    LegalProcessType,
    ReviewReason,
)
from app.models.legal_process import LegalProcess
from app.models.legal_request import LegalRequest
from app.models.lers_quality import PackageValidationFinding, ScopeAuthorityCheck
from app.models.production_package import ProductionPackage
from app.models.special_handling import SpecialHandlingFlags
from app.orchestration.approval_policy import ApprovalPolicy


def make_request(**overrides) -> LegalRequest:
    return LegalRequest(legal_request_id="LER-TEST-1", **overrides)


def blocking_finding(code: DeficiencyCode) -> DeficiencyFinding:
    return DeficiencyFinding(
        code=code, severity=DeficiencySeverity.BLOCKING, message=f"test {code.value}"
    )


def test_search_warrant_requires_review():
    request = make_request(
        legal_process=LegalProcess(type=LegalProcessType.SEARCH_WARRANT)
    )
    result = ApprovalPolicy().evaluate(request)
    assert result.human_review_required
    assert ReviewReason.SEARCH_WARRANT in result.review_reasons


@pytest.mark.parametrize(
    ("flag", "expected_reason"),
    [
        ("pen_register_requested", ReviewReason.PEN_REGISTER_REQUESTED),
        ("trap_and_trace_requested", ReviewReason.TRAP_AND_TRACE_REQUESTED),
        ("non_disclosure_to_subscriber", ReviewReason.NON_DISCLOSURE_REQUESTED),
        ("no_adverse_action", ReviewReason.NO_ADVERSE_ACTION_REQUESTED),
        ("sealed", ReviewReason.SEALED_ORDER_REQUESTED),
        ("location_tracking_requested", ReviewReason.LOCATION_TRACKING_REQUESTED),
        ("content_requested", ReviewReason.CONTENT_REQUESTED),
        ("tombstone_requested", ReviewReason.TOMBSTONE_REQUESTED),
        ("ongoing_access_requested", ReviewReason.ONGOING_COLLECTION_REQUESTED),
    ],
)
def test_special_handling_flags_require_review(flag, expected_reason):
    request = make_request(special_handling=SpecialHandlingFlags(**{flag: True}))
    result = ApprovalPolicy().evaluate(request)
    assert result.human_review_required
    assert expected_reason in result.review_reasons


def test_ongoing_collection_requires_explicit_attestation():
    request = make_request(
        special_handling=SpecialHandlingFlags(
            ongoing_access_requested=True,
            ongoing_duration_days=60,
            ongoing_update_interval_minutes=15,
        )
    )

    assert AttestationItem.ONGOING_COLLECTION_REVIEWED in (
        ApprovalPolicy().required_attestations(request)
    )


def test_missing_date_range_requires_review_and_blocks():
    request = make_request(
        deficiency_findings=[blocking_finding(DeficiencyCode.MISSING_DATE_RANGE)]
    )
    result = ApprovalPolicy().evaluate(request)
    assert ReviewReason.MISSING_OR_INVALID_DATE_RANGE in result.review_reasons
    assert "missing_date_range" in result.blocking_reasons


def test_missing_identifier_requires_review_and_blocks():
    request = make_request(
        deficiency_findings=[blocking_finding(DeficiencyCode.MISSING_IDENTIFIER)]
    )
    result = ApprovalPolicy().evaluate(request)
    assert ReviewReason.MISSING_REQUIRED_IDENTIFIER in result.review_reasons
    assert "missing_identifier" in result.blocking_reasons


def test_overbroad_scope_requires_review():
    request = make_request(product_domains=["Gmail", "YouTube", "Drive", "Pay"])
    result = ApprovalPolicy().evaluate(request)
    assert ReviewReason.OVERBROAD_SCOPE in result.review_reasons


def test_low_classification_confidence_requires_review():
    result = ApprovalPolicy().evaluate(make_request(), classification_confidence=0.5)
    assert ReviewReason.LOW_CLASSIFICATION_CONFIDENCE in result.review_reasons


def test_sop_conflict_requires_review():
    result = ApprovalPolicy().evaluate(make_request(), sop_conflict=True)
    assert ReviewReason.SOP_CONFLICT in result.review_reasons


def test_drafted_artifacts_require_review():
    result = ApprovalPolicy().evaluate(
        make_request(),
        drafted_artifacts=frozenset(
            {"production_package", "deficiency_response", "chain_of_custody", "certification"}
        ),
    )
    assert {
        ReviewReason.PRODUCTION_PACKAGE_DRAFTED,
        ReviewReason.DEFICIENCY_RESPONSE_DRAFTED,
        ReviewReason.CHAIN_OF_CUSTODY_GENERATED,
        ReviewReason.CERTIFICATION_GENERATED,
    } <= set(result.review_reasons)


def test_audit_exception_requires_review_and_blocks():
    result = ApprovalPolicy().evaluate(make_request(), audit_exception=True)
    assert ReviewReason.AUDIT_EXCEPTION in result.review_reasons
    assert "audit_exception" in result.blocking_reasons


def test_clean_subscriber_request_has_no_policy_triggers():
    """A clean common case carries no review reasons — but final actions
    remain human-only (proven structurally in the API tests)."""
    request = make_request(
        legal_process=LegalProcess(type=LegalProcessType.LEGAL_PROCESS_REQUEST),
        product_domains=["Account / Subscriber"],
    )
    result = ApprovalPolicy().evaluate(request)
    assert not result.human_review_required
    assert result.blocking_reasons == []


def test_warning_deficiencies_surface_as_warnings_not_blockers():
    request = make_request(
        deficiency_findings=[
            DeficiencyFinding(
                code=DeficiencyCode.OVERBROAD_SCOPE,
                severity=DeficiencySeverity.WARNING,
                message="overbroad",
            )
        ]
    )
    result = ApprovalPolicy().evaluate(request)
    assert result.blocking_reasons == []
    assert result.warnings == ["overbroad"]


def test_scope_authority_mismatch_requires_review_without_blocking():
    request = make_request(
        scope_authority_checks=[
            ScopeAuthorityCheck(
                category="GPS Location Records",
                status="missing_authority",
                required_citations=["C.R.S. §16-3-303.5"],
                matched_citations=[],
                message=(
                    "Requested category does not have an obvious matching cited "
                    "authority."
                ),
            )
        ]
    )

    result = ApprovalPolicy().evaluate(request)

    assert ReviewReason.SCOPE_AUTHORITY_MISMATCH in result.review_reasons
    assert result.blocking_reasons == []
    assert result.warnings == [
        "GPS Location Records: Requested category does not have an obvious matching "
        "cited authority."
    ]
    assert AttestationItem.AUTHORITY_SCOPE_MATCH_CONFIRMED in (
        ApprovalPolicy().required_attestations(request)
    )


def test_package_validation_findings_map_to_policy_reasons_and_blockers():
    request = make_request(
        package_validation_findings=[
            PackageValidationFinding(
                code="record_count_mismatch",
                severity="blocking",
                section="record_index",
                message="summary count does not match records",
            ),
            PackageValidationFinding(
                code="certification_incomplete",
                severity="blocking",
                section="certification",
                message="certification missing representative",
            ),
        ],
        production_package=ProductionPackage(
            request_id="LER-TEST-1", production_id="PROD-TEST-1"
        ),
    )

    result = ApprovalPolicy().evaluate(request)

    assert ReviewReason.RECORD_COUNT_MISMATCH in result.review_reasons
    assert ReviewReason.CERTIFICATION_INCOMPLETE in result.review_reasons
    assert result.blocking_reasons == [
        "record_count_mismatch",
        "certification_incomplete",
    ]
    assert {
        AttestationItem.PACKAGE_COMPLETENESS_CONFIRMED,
        AttestationItem.CERTIFICATION_REVIEWED,
    } <= set(ApprovalPolicy().required_attestations(request))
