from datetime import UTC, datetime

from app.mock_data.seed import MOCK_DATA_DIR
from app.models.enums import DeficiencyCode, DeficiencySeverity
from app.models.legal_request import LegalRequest
from app.models.requested_period import RequestedPeriod
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
