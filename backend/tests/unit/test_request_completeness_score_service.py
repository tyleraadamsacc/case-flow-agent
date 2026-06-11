from datetime import UTC, date, datetime

from app.models.attestation import Attestation
from app.models.certification import Certification
from app.models.chain_of_custody import ChainOfCustody
from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import (
    AttestationItem,
    DeficiencyCode,
    DeficiencySeverity,
    IdentifierType,
)
from app.models.legal_request import LegalRequest
from app.models.lers_quality import PackageValidationFinding, ScopeAuthorityCheck
from app.models.production_package import ProductionPackage
from app.models.request_completeness_score import CompletenessStatus
from app.models.requested_data_category import RequestedDataCategory
from app.models.requested_period import RequestedPeriod
from app.models.requesting_agency import RequestingAgency
from app.models.special_handling import SpecialHandlingFlags
from app.models.subject_identifier import SubjectIdentifier
from app.services.request_completeness_score_service import (
    RequestCompletenessScoreService,
)


def _components(score):
    return {component.component.value: component for component in score.components}


def _complete_package() -> ProductionPackage:
    return ProductionPackage(
        request_id="LER-COMPLETE",
        production_id="PROD-COMPLETE-01",
        date_produced=date(2026, 6, 11),
        requesting_agency=RequestingAgency(agency="Example PD"),
        subject_identifiers=[
            SubjectIdentifier(type=IdentifierType.GMAIL_ACCOUNT, value="target@example.com")
        ],
        chain_of_custody=ChainOfCustody(
            collection_date=date(2026, 6, 11),
            collection_method="Synthetic export",
            collected_by="CaseFlow",
        ),
        certification=Certification(
            authorized_representative="Analyst Example",
            title="Records Custodian",
            certification_text="Synthetic certification text.",
        ),
    )


def test_complete_request_scores_all_components_complete():
    request = LegalRequest(
        legal_request_id="LER-COMPLETE",
        raw_source_text="Fully filled request text.",
        subject_identifiers=[
            SubjectIdentifier(type=IdentifierType.GMAIL_ACCOUNT, value="target@example.com")
        ],
        requested_period=RequestedPeriod(
            start=datetime(2026, 5, 1, tzinfo=UTC),
            end=datetime(2026, 5, 10, tzinfo=UTC),
            valid=True,
        ),
        requested_data_categories=[
            RequestedDataCategory(
                category="Subscriber records",
                product_domain="Gmail",
            )
        ],
        scope_authority_checks=[
            ScopeAuthorityCheck(
                category="Subscriber records",
                status="covered",
                matched_citations=["18 U.S.C. §2703"],
                message="Covered by cited authority.",
            )
        ],
        production_package=_complete_package(),
        attestations=[
            Attestation(item=AttestationItem.SCOPE_VERIFIED, attested_by="analyst"),
            Attestation(item=AttestationItem.IDENTIFIERS_MATCH, attested_by="analyst"),
            Attestation(
                item=AttestationItem.PACKAGE_COMPLETENESS_CONFIRMED,
                attested_by="analyst",
            ),
            Attestation(
                item=AttestationItem.AUTHORITY_SCOPE_MATCH_CONFIRMED,
                attested_by="analyst",
            ),
            Attestation(
                item=AttestationItem.CERTIFICATION_REVIEWED,
                attested_by="analyst",
            ),
        ],
    )

    score = RequestCompletenessScoreService().score(request)

    assert score.status == CompletenessStatus.COMPLETE
    assert score.total_score == 100
    assert {component.status for component in score.components} == {
        CompletenessStatus.COMPLETE
    }


def test_incomplete_request_scores_zero_when_required_state_is_absent():
    request = LegalRequest(
        legal_request_id="LER-INCOMPLETE",
        raw_source_text="Detective contact: YOUR EMAIL ADDRESS",
        special_handling=SpecialHandlingFlags(content_requested=True),
        deficiency_findings=[
            DeficiencyFinding(
                code=DeficiencyCode.MISSING_IDENTIFIER,
                severity=DeficiencySeverity.BLOCKING,
                message="Missing identifier.",
            ),
            DeficiencyFinding(
                code=DeficiencyCode.MISSING_DATE_RANGE,
                severity=DeficiencySeverity.BLOCKING,
                message="Missing date range.",
            ),
            DeficiencyFinding(
                code=DeficiencyCode.UNRESOLVED_TEMPLATE_PLACEHOLDER,
                severity=DeficiencySeverity.BLOCKING,
                message="Placeholder remains.",
            ),
        ],
    )

    score = RequestCompletenessScoreService().score(request)
    components = _components(score)

    assert score.status == CompletenessStatus.INCOMPLETE
    assert score.total_score == 0
    assert components["placeholders"].status == CompletenessStatus.INCOMPLETE
    assert components["special_handling_review"].status == CompletenessStatus.INCOMPLETE


def test_partial_request_scores_mixed_component_breakdown():
    request = LegalRequest(
        legal_request_id="LER-PARTIAL",
        raw_source_text="Filled request text.",
        subject_identifiers=[
            SubjectIdentifier(type=IdentifierType.GMAIL_ACCOUNT, value="target@example.com")
        ],
        requested_period=RequestedPeriod(
            start=datetime(2026, 5, 1, tzinfo=UTC),
            valid=False,
            issues=["End date missing."],
        ),
        requested_data_categories=[
            RequestedDataCategory(category="Subscriber records", product_domain="Gmail"),
            RequestedDataCategory(category="Location history", product_domain="Maps"),
        ],
        scope_authority_checks=[
            ScopeAuthorityCheck(
                category="Subscriber records",
                status="covered",
                matched_citations=["18 U.S.C. §2703"],
                message="Covered by cited authority.",
            ),
            ScopeAuthorityCheck(
                category="Location history",
                status="missing_authority",
                required_citations=["C.R.S. §16-3-303.5"],
                message="Missing location authority.",
            ),
        ],
        production_package=_complete_package(),
        package_validation_findings=[
            PackageValidationFinding(
                code="missing_field_definitions",
                severity="warning",
                section="field_definitions",
                message="Field definitions should be reviewed.",
            )
        ],
        attestations=[
            Attestation(item=AttestationItem.SCOPE_VERIFIED, attested_by="analyst")
        ],
    )

    score = RequestCompletenessScoreService().score(request)
    components = _components(score)

    assert score.status == CompletenessStatus.PARTIAL
    assert 0 < score.total_score < 100
    assert components["date_range"].status == CompletenessStatus.PARTIAL
    assert components["authority_coverage"].status == CompletenessStatus.PARTIAL
    assert components["package_validation"].status == CompletenessStatus.PARTIAL
    assert components["attestations"].status == CompletenessStatus.PARTIAL
