from datetime import UTC, datetime

from app.mock_data.seed import MOCK_DATA_DIR
from app.models.enums import (
    DeficiencyCode,
    DeficiencySeverity,
    IdentifierType,
    LegalProcessType,
)
from app.models.legal_process import LegalProcess
from app.models.legal_request import LegalRequest
from app.models.lers_quality import ScopeAuthorityCheck
from app.models.requested_period import RequestedPeriod
from app.models.subject_identifier import SubjectIdentifier
from app.services.deficiency_service import DeficiencyService
from app.services.request_extraction_service import RequestExtractionService


def make_service() -> DeficiencyService:
    return DeficiencyService(MOCK_DATA_DIR / "sop" / "deficiency_rules.json")


def extracted(legal_request_id: str) -> LegalRequest:
    request = LegalRequest(legal_request_id=legal_request_id)
    extraction_service = RequestExtractionService(MOCK_DATA_DIR / "legal_requests")
    extraction_service.apply(request, extraction_service.extract(request))
    return request


def codes(findings) -> set[DeficiencyCode]:
    return {finding.code for finding in findings}


def complete_request(raw_source_text: str) -> LegalRequest:
    return LegalRequest(
        legal_request_id="LER-UNIT-COMPLETE",
        raw_source_text=raw_source_text,
        legal_process=LegalProcess(type=LegalProcessType.SEARCH_WARRANT),
        subject_identifiers=[
            SubjectIdentifier(type=IdentifierType.ACCOUNT_ID, value="ACC-123")
        ],
        requested_period=RequestedPeriod(
            start=datetime(2026, 5, 10, tzinfo=UTC),
            end=datetime(2026, 5, 15, tzinfo=UTC),
        ),
        product_domains=["Account / Subscriber"],
    )


def test_scenario_b_flags_missing_date_range_as_blocking():
    findings = make_service().evaluate(extracted("LER-2026-004821"))
    by_code = {f.code: f for f in findings}
    assert DeficiencyCode.MISSING_DATE_RANGE in by_code
    finding = by_code[DeficiencyCode.MISSING_DATE_RANGE]
    assert finding.severity == DeficiencySeverity.BLOCKING
    assert finding.suggested_resolution
    assert finding.evidence_ids == ["DEF-MISSING-DATE-RANGE"]


def test_scenario_d_flags_overbroad_scope_as_warning():
    findings = make_service().evaluate(extracted("LER-2026-004842"))
    by_code = {f.code: f for f in findings}
    assert DeficiencyCode.OVERBROAD_SCOPE in by_code
    assert by_code[DeficiencyCode.OVERBROAD_SCOPE].severity == DeficiencySeverity.WARNING


def test_clean_scenarios_have_no_findings():
    service = make_service()
    for legal_request_id in ("LER-2026-004812", "LER-2026-004850", "LER-2026-004863"):
        assert service.evaluate(extracted(legal_request_id)) == []


def test_empty_request_flags_all_missing_fields():
    findings = make_service().evaluate(LegalRequest(legal_request_id="LER-EMPTY"))
    assert {
        DeficiencyCode.MISSING_DATE_RANGE,
        DeficiencyCode.MISSING_IDENTIFIER,
        DeficiencyCode.AMBIGUOUS_REQUEST_TYPE,
    } <= codes(findings)


def test_inverted_period_is_invalid_date_range():
    request = extracted("LER-2026-004812")
    request.requested_period = RequestedPeriod(
        start=datetime(2026, 5, 15, tzinfo=UTC), end=datetime(2026, 5, 10, tzinfo=UTC)
    )
    findings = make_service().evaluate(request)
    assert DeficiencyCode.INVALID_DATE_RANGE in codes(findings)


def test_raw_source_with_unresolved_placeholders_is_blocking():
    request = complete_request(
        "SEARCH WARRANT for ACC-123. Affiant: YOUR NAME HERE. "
        "Requested period: DATE OF INTEREST."
    )

    findings = make_service().evaluate(request)

    by_code = {finding.code: finding for finding in findings}
    finding = by_code[DeficiencyCode.UNRESOLVED_TEMPLATE_PLACEHOLDER]
    assert finding.severity == DeficiencySeverity.BLOCKING
    assert finding.evidence_ids == ["DEF-UNRESOLVED-TEMPLATE-PLACEHOLDER"]
    assert "YOUR NAME HERE" in finding.message
    assert "DATE OF INTEREST" in finding.message


def test_please_delete_instruction_alone_is_not_unresolved_placeholder():
    request = complete_request(
        "SEARCH WARRANT. [INSTRUCTIONS - PLEASE DELETE THIS BLOCK BEFORE SERVICE] "
        "Detective Synthetic requests subscriber information for ACC-123."
    )

    findings = make_service().evaluate(request)

    assert DeficiencyCode.UNRESOLVED_TEMPLATE_PLACEHOLDER not in codes(findings)


def test_scope_authority_gap_is_warning_deficiency():
    request = complete_request("SEARCH WARRANT for ACC-123 and GPS location records.")
    request.scope_authority_checks = [
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

    findings = make_service().evaluate(request)

    by_code = {finding.code: finding for finding in findings}
    finding = by_code[DeficiencyCode.SCOPE_AUTHORITY_MISMATCH]
    assert finding.severity == DeficiencySeverity.WARNING
    assert finding.evidence_ids == ["DEF-SCOPE-AUTHORITY-MISMATCH"]
