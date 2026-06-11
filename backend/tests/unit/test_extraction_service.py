import json

from app.mock_data.seed import MOCK_DATA_DIR
from app.models.enums import LegalProcessType
from app.models.legal_request import LegalRequest
from app.services.request_extraction_service import (
    PLACEHOLDER_PATTERNS,
    RequestExtractionService,
    build_source_sections,
    build_source_trace_target,
    contains_placeholder,
)


def make_service() -> RequestExtractionService:
    return RequestExtractionService(MOCK_DATA_DIR / "legal_requests")


def stub(legal_request_id: str) -> LegalRequest:
    return LegalRequest(legal_request_id=legal_request_id)


def test_scenario_a_extracts_valid_fields():
    result = make_service().extract(stub("LER-2026-004812"))
    assert result.legal_process.type == LegalProcessType.SEARCH_WARRANT
    assert result.requesting_agency.agency.startswith("Los Angeles")
    assert [i.value for i in result.subject_identifiers] == [
        "ACC-7784512",
        "CUST-992181",
        "DEV-IMEI-88471",
    ]
    assert result.product_domains == ["Maps / Location"]
    assert result.requested_period.valid
    assert [a.citation for a in result.legal_authorities] == [
        "18 U.S.C. §2703",
        "C.R.S. §16-3-301",
    ]


def test_scenario_b_strips_placeholder_officer_and_flags_period():
    result = make_service().extract(stub("LER-2026-004821"))
    # "YOUR NAME HERE" must not survive extraction.
    assert result.requesting_agency.officer is None
    assert result.requested_period is not None
    assert not result.requested_period.valid
    assert result.requested_period.issues


def test_no_placeholder_text_survives_extraction_for_any_scenario():
    service = make_service()
    for legal_request_id in (
        "LER-2026-004812",
        "LER-2026-004821",
        "LER-2026-004835",
        "LER-2026-004842",
        "LER-2026-004850",
        "LER-2026-004863",
    ):
        dumped = json.dumps(
            service.extract(stub(legal_request_id)).model_dump(mode="json")
        ).upper()
        for pattern in PLACEHOLDER_PATTERNS:
            assert pattern not in dumped, (legal_request_id, pattern)


def test_unknown_request_extracts_nothing():
    result = make_service().extract(stub("LER-UNKNOWN"))
    assert result.legal_process is None
    assert result.subject_identifiers == []


def test_contains_placeholder_is_case_insensitive():
    assert contains_placeholder("please delete this block")
    assert contains_placeholder("Between DATE OF INTEREST and now")
    assert not contains_placeholder("Detective Sarah Johnson")


def test_source_trace_target_resolves_span_to_stable_section_id():
    sections = build_source_sections(
        "\n".join(
            [
                "AFFIDAVIT FOR SEARCH WARRANT",
                "Narrative introduction.",
                "THE FOLLOWING RECORDS",
                "GPS location records for account ACC-7784512.",
                "FOLLOWING TIME PERIOD",
                "Between May 10, 2026 and May 15, 2026.",
            ]
        )
    )

    target = build_source_trace_target("account ACC-7784512", sections)

    assert target is not None
    assert target.section_id == "02-requested-records"
    assert target.source_span == "account ACC-7784512"
    assert target.match == "exact_span"


def test_source_trace_target_uses_normalized_span_matching():
    sections = build_source_sections(
        "\n".join(
            [
                "THE FOLLOWING RECORDS",
                "GPS location records for account ACC-7784512.",
            ]
        )
    )

    target = build_source_trace_target("records for account\nACC-7784512", sections)

    assert target is not None
    assert target.section_id == "01-requested-records"
    assert target.match == "normalized_span"
