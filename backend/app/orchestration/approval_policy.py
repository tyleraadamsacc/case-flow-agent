"""Code-enforced approval policy (plan §4 / handoff doc 06 trigger list).

The policy decides when human review is required and what blocks
finalization. It lives in code — never in prompts — and no agent or ADK
path can override it. Independent of this policy, finalization is
structurally human-only: the approve endpoint is the single path to an
approved state.
"""

from app.models.base import CaseFlowModel
from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import (
    DeficiencyCode,
    DeficiencySeverity,
    LegalProcessType,
    ReviewReason,
)
from app.models.legal_request import LegalRequest

# Product/domain count at or above which a request is considered overbroad.
OVERBROAD_DOMAIN_THRESHOLD = 3

# Classification confidence below which human review is forced (used from PR 2).
LOW_CONFIDENCE_THRESHOLD = 0.75

_DEFICIENCY_REASONS: dict[DeficiencyCode, ReviewReason] = {
    DeficiencyCode.MISSING_DATE_RANGE: ReviewReason.MISSING_OR_INVALID_DATE_RANGE,
    DeficiencyCode.INVALID_DATE_RANGE: ReviewReason.MISSING_OR_INVALID_DATE_RANGE,
    DeficiencyCode.MISSING_IDENTIFIER: ReviewReason.MISSING_REQUIRED_IDENTIFIER,
    DeficiencyCode.OVERBROAD_SCOPE: ReviewReason.OVERBROAD_SCOPE,
}

# Drafted-artifact context flags (set by the PR 2+ drafting flows).
_DRAFT_REASONS: dict[str, ReviewReason] = {
    "production_package": ReviewReason.PRODUCTION_PACKAGE_DRAFTED,
    "deficiency_response": ReviewReason.DEFICIENCY_RESPONSE_DRAFTED,
    "chain_of_custody": ReviewReason.CHAIN_OF_CUSTODY_GENERATED,
    "certification": ReviewReason.CERTIFICATION_GENERATED,
}


class ApprovalPolicyResult(CaseFlowModel):
    human_review_required: bool
    review_reasons: list[ReviewReason] = []
    blocking_reasons: list[str] = []
    warnings: list[str] = []


class ApprovalPolicy:
    def evaluate(
        self,
        request: LegalRequest,
        *,
        classification_confidence: float | None = None,
        sop_conflict: bool = False,
        drafted_artifacts: frozenset[str] = frozenset(),
        audit_exception: bool = False,
    ) -> ApprovalPolicyResult:
        reasons: list[ReviewReason] = []
        blocking: list[str] = []
        warnings: list[str] = []

        self._legal_process_reasons(request, reasons)
        self._special_handling_reasons(request, reasons)

        if len(request.product_domains) >= OVERBROAD_DOMAIN_THRESHOLD:
            self._add(reasons, ReviewReason.OVERBROAD_SCOPE)

        self._deficiency_reasons(request.deficiency_findings, reasons, blocking, warnings)

        if (
            classification_confidence is not None
            and classification_confidence < LOW_CONFIDENCE_THRESHOLD
        ):
            self._add(reasons, ReviewReason.LOW_CLASSIFICATION_CONFIDENCE)
        if sop_conflict:
            self._add(reasons, ReviewReason.SOP_CONFLICT)
        for artifact in sorted(drafted_artifacts):
            reason = _DRAFT_REASONS.get(artifact)
            if reason is not None:
                self._add(reasons, reason)
        if audit_exception:
            self._add(reasons, ReviewReason.AUDIT_EXCEPTION)
            blocking.append("audit_exception")

        return ApprovalPolicyResult(
            human_review_required=bool(reasons),
            review_reasons=reasons,
            blocking_reasons=blocking,
            warnings=warnings,
        )

    @staticmethod
    def _add(reasons: list[ReviewReason], reason: ReviewReason) -> None:
        if reason not in reasons:
            reasons.append(reason)

    def _legal_process_reasons(
        self, request: LegalRequest, reasons: list[ReviewReason]
    ) -> None:
        process = request.legal_process
        if process is None:
            return
        if process.type == LegalProcessType.SEARCH_WARRANT:
            self._add(reasons, ReviewReason.SEARCH_WARRANT)
        if process.pen_register:
            self._add(reasons, ReviewReason.PEN_REGISTER_REQUESTED)
        if process.trap_and_trace:
            self._add(reasons, ReviewReason.TRAP_AND_TRACE_REQUESTED)
        if process.location_tracking:
            self._add(reasons, ReviewReason.LOCATION_TRACKING_REQUESTED)

    def _special_handling_reasons(
        self, request: LegalRequest, reasons: list[ReviewReason]
    ) -> None:
        flags = request.special_handling
        flag_reasons: list[tuple[bool, ReviewReason]] = [
            (flags.pen_register_requested, ReviewReason.PEN_REGISTER_REQUESTED),
            (flags.trap_and_trace_requested, ReviewReason.TRAP_AND_TRACE_REQUESTED),
            (flags.non_disclosure_to_subscriber, ReviewReason.NON_DISCLOSURE_REQUESTED),
            (flags.no_adverse_action, ReviewReason.NO_ADVERSE_ACTION_REQUESTED),
            (flags.sealed, ReviewReason.SEALED_ORDER_REQUESTED),
            (flags.location_tracking_requested, ReviewReason.LOCATION_TRACKING_REQUESTED),
            (flags.content_requested, ReviewReason.CONTENT_REQUESTED),
            (flags.tombstone_requested, ReviewReason.TOMBSTONE_REQUESTED),
        ]
        for is_set, reason in flag_reasons:
            if is_set:
                self._add(reasons, reason)

    def _deficiency_reasons(
        self,
        findings: list[DeficiencyFinding],
        reasons: list[ReviewReason],
        blocking: list[str],
        warnings: list[str],
    ) -> None:
        for finding in findings:
            reason = _DEFICIENCY_REASONS.get(finding.code)
            if reason is not None:
                self._add(reasons, reason)
            if finding.severity == DeficiencySeverity.BLOCKING:
                blocking.append(finding.code.value)
            else:
                warnings.append(finding.message)
