from app.mock_data.seed import MOCK_DATA_DIR
from app.models.enums import ReviewReason
from app.models.legal_request import LegalRequest
from app.services.request_extraction_service import RequestExtractionService
from app.services.sensitive_special_handling_service import SensitiveSpecialHandlingService


def make_service() -> SensitiveSpecialHandlingService:
    return SensitiveSpecialHandlingService(
        MOCK_DATA_DIR / "sop" / "special_handling_rules.json"
    )


def extracted(legal_request_id: str) -> LegalRequest:
    request = LegalRequest(legal_request_id=legal_request_id)
    extraction_service = RequestExtractionService(MOCK_DATA_DIR / "legal_requests")
    extraction_service.apply(request, extraction_service.extract(request))
    return request


def test_scenario_c_flags_pen_register_trap_and_trace_and_non_disclosure():
    check = make_service().check(extracted("LER-2026-004835"))
    assert {
        "sealed",
        "non_disclosure_to_subscriber",
        "no_adverse_action",
        "pen_register_requested",
        "trap_and_trace_requested",
        "ongoing_access_requested",
    } <= set(check.active_flags)
    assert {
        ReviewReason.PEN_REGISTER_REQUESTED,
        ReviewReason.TRAP_AND_TRACE_REQUESTED,
        ReviewReason.NON_DISCLOSURE_REQUESTED,
        ReviewReason.NO_ADVERSE_ACTION_REQUESTED,
        ReviewReason.SEALED_ORDER_REQUESTED,
    } <= set(check.review_reasons)
    assert "SH-PEN-REGISTER" in check.evidence_ids


def test_scenario_e_has_no_special_handling():
    check = make_service().check(extracted("LER-2026-004850"))
    assert check.active_flags == []
    assert check.review_reasons == []


def test_legal_process_flags_are_picked_up_without_handling_flags():
    request = extracted("LER-2026-004850")
    request.legal_process.pen_register = True
    check = make_service().check(request)
    assert "pen_register_requested" in check.active_flags
    assert ReviewReason.PEN_REGISTER_REQUESTED in check.review_reasons
