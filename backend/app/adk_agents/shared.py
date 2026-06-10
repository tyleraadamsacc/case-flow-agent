"""Deterministic helpers shared by the six agents' business logic."""

from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import DeficiencyCode, DeficiencySeverity, ReviewReason
from app.models.legal_request import LegalRequest

# Review reasons that demand subject-matter-expert escalation before any
# retrieval or response step.
SME_REVIEW_REASONS: frozenset[str] = frozenset(
    {
        ReviewReason.PEN_REGISTER_REQUESTED.value,
        ReviewReason.TRAP_AND_TRACE_REQUESTED.value,
        ReviewReason.NON_DISCLOSURE_REQUESTED.value,
        ReviewReason.SEALED_ORDER_REQUESTED.value,
        ReviewReason.NO_ADVERSE_ACTION_REQUESTED.value,
        ReviewReason.SENSITIVE_PARTY.value,
    }
)


def active_flags(request: LegalRequest) -> frozenset[str]:
    """Special-handling flags plus the equivalent legal-process flags."""
    flags = set(request.special_handling.active_flags())
    process = request.legal_process
    if process is not None:
        if process.pen_register:
            flags.add("pen_register_requested")
        if process.trap_and_trace:
            flags.add("trap_and_trace_requested")
        if process.location_tracking:
            flags.add("location_tracking_requested")
    return frozenset(flags)


def blocking_deficiencies(request: LegalRequest) -> list[DeficiencyFinding]:
    return [
        finding
        for finding in request.deficiency_findings
        if finding.severity == DeficiencySeverity.BLOCKING
    ]


def is_overbroad(request: LegalRequest) -> bool:
    return any(
        finding.code == DeficiencyCode.OVERBROAD_SCOPE
        for finding in request.deficiency_findings
    )


def is_extraction_incomplete(request: LegalRequest) -> bool:
    return (
        request.legal_process is None
        and not request.subject_identifiers
        and not request.requested_data_categories
    )


def request_input_summary(request: LegalRequest) -> str:
    process = request.legal_process.type.value if request.legal_process else "unknown process"
    return (
        f"{request.legal_request_id}: {process}, "
        f"{len(request.subject_identifiers)} identifier(s), "
        f"{len(request.requested_data_categories)} data categor(ies), "
        f"{len(request.deficiency_findings)} deficienc(ies)"
    )


def sme_reasons_present(reason_values: list[str]) -> list[str]:
    return [value for value in reason_values if value in SME_REVIEW_REASONS]


def has_human_approval(request: LegalRequest) -> bool:
    """A human has recorded an approving review or an approval decision.

    The ETL Agent simulates an *approved* responsive data pull (plan §3):
    special-handling and overbroad holds clear only once this is true.
    Blocking deficiencies are never approval-clearable."""
    if any(review.action.value == "approve" for review in request.reviews):
        return True
    return any(approval.decision.value == "approved" for approval in request.approvals)
