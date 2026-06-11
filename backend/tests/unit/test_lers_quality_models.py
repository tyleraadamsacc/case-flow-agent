from app.models.enums import LegalProcessType
from app.models.legal_authority import LegalAuthority
from app.models.legal_process import LegalProcess
from app.models.legal_request import LegalRequest
from app.models.requested_data_category import RequestedDataCategory
from app.services.scope_authority_service import ScopeAuthorityService


def test_compound_legal_process_components_are_preserved():
    process = LegalProcess(
        type=LegalProcessType.SEARCH_WARRANT,
        court_order_included=True,
        ex_parte_order=True,
        pen_register=True,
        trap_and_trace=True,
        location_tracking=True,
    )

    assert process.components == [
        LegalProcessType.SEARCH_WARRANT,
        LegalProcessType.COURT_ORDER,
        LegalProcessType.EX_PARTE_ORDER,
        LegalProcessType.PEN_REGISTER,
        LegalProcessType.TRAP_AND_TRACE,
        LegalProcessType.LOCATION_TRACKING,
    ]


def test_scope_authority_service_flags_location_category_without_matching_authority():
    request = LegalRequest(
        legal_request_id="LER-SCOPE-GAP",
        requested_data_categories=[
            RequestedDataCategory(
                category="GPS Location Records",
                product_domain="Maps / Location",
                content_type="location",
            )
        ],
        legal_authorities=[
            LegalAuthority(
                citation="18 U.S.C. §§3122 and 3123",
                description="Pen register and trap and trace authorization",
            )
        ],
    )

    checks = ScopeAuthorityService().analyze(request)

    assert len(checks) == 1
    assert checks[0].category == "GPS Location Records"
    assert checks[0].status == "missing_authority"
    assert checks[0].required_citations == [
        "C.R.S. §16-3-303.5",
        "18 U.S.C. §2703",
        "C.R.S. §16-3-301",
    ]
    assert checks[0].matched_citations == []
