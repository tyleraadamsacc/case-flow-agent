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
    AttestationItem,
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

# High-sensitivity review reasons require dual control: two distinct human
# approvers, at least one senior, before finalization (theme B).
HIGH_SENSITIVITY_REASONS: frozenset[ReviewReason] = frozenset(
    {
        ReviewReason.SEARCH_WARRANT,
        ReviewReason.CONTENT_REQUESTED,
        ReviewReason.ONGOING_COLLECTION_REQUESTED,
        ReviewReason.SEALED_ORDER_REQUESTED,
    }
)

_DEFICIENCY_REASONS: dict[DeficiencyCode, ReviewReason] = {
    DeficiencyCode.MISSING_DATE_RANGE: ReviewReason.MISSING_OR_INVALID_DATE_RANGE,
    DeficiencyCode.INVALID_DATE_RANGE: ReviewReason.MISSING_OR_INVALID_DATE_RANGE,
    DeficiencyCode.MISSING_IDENTIFIER: ReviewReason.MISSING_REQUIRED_IDENTIFIER,
    DeficiencyCode.OVERBROAD_SCOPE: ReviewReason.OVERBROAD_SCOPE,
    DeficiencyCode.UNRESOLVED_TEMPLATE_PLACEHOLDER: (
        ReviewReason.TEMPLATE_PLACEHOLDER_UNRESOLVED
    ),
    DeficiencyCode.SCOPE_AUTHORITY_MISMATCH: ReviewReason.SCOPE_AUTHORITY_MISMATCH,
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
    # Dual control (theme B): how many distinct human approvers must
    # co-sign, and whether one of them must be a senior analyst.
    required_approvals: int = 1
    requires_senior_approval: bool = False


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
        self._scope_authority_reasons(request, reasons, warnings)
        self._package_validation_reasons(request, reasons, blocking, warnings)

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

        high_sensitivity = any(
            reason in HIGH_SENSITIVITY_REASONS for reason in reasons
        )
        return ApprovalPolicyResult(
            human_review_required=bool(reasons),
            review_reasons=reasons,
            blocking_reasons=blocking,
            warnings=warnings,
            required_approvals=2 if high_sensitivity else 1,
            requires_senior_approval=high_sensitivity,
        )

    def required_attestations(self, request: LegalRequest) -> list[AttestationItem]:
        """Pre-finalization checks a human must confirm for this request.
        Scope and identifier checks are always required; sensitive-handling
        items are added when the corresponding flag is set (theme E)."""
        items = [AttestationItem.SCOPE_VERIFIED, AttestationItem.IDENTIFIERS_MATCH]
        flags = request.special_handling
        if flags.non_disclosure_to_subscriber:
            items.append(AttestationItem.NONDISCLOSURE_REVIEWED)
        if flags.sealed:
            items.append(AttestationItem.SEALED_HANDLING_ACKNOWLEDGED)
        if flags.content_requested:
            items.append(AttestationItem.CONTENT_SCOPE_CONFIRMED)
        if flags.ongoing_access_requested:
            items.append(AttestationItem.ONGOING_COLLECTION_REVIEWED)
        if request.scope_authority_checks:
            items.append(AttestationItem.AUTHORITY_SCOPE_MATCH_CONFIRMED)
        if request.production_package is not None:
            items.append(AttestationItem.PACKAGE_COMPLETENESS_CONFIRMED)
            items.append(AttestationItem.CERTIFICATION_REVIEWED)
        return items

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
            (flags.ongoing_access_requested, ReviewReason.ONGOING_COLLECTION_REQUESTED),
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

    def _scope_authority_reasons(
        self,
        request: LegalRequest,
        reasons: list[ReviewReason],
        warnings: list[str],
    ) -> None:
        for check in request.scope_authority_checks:
            if check.status == "covered":
                continue
            self._add(reasons, ReviewReason.SCOPE_AUTHORITY_MISMATCH)
            warnings.append(f"{check.category}: {check.message}")

    def _package_validation_reasons(
        self,
        request: LegalRequest,
        reasons: list[ReviewReason],
        blocking: list[str],
        warnings: list[str],
    ) -> None:
        for finding in request.package_validation_findings:
            if finding.code == "record_count_mismatch":
                self._add(reasons, ReviewReason.RECORD_COUNT_MISMATCH)
            elif finding.code == "certification_incomplete":
                self._add(reasons, ReviewReason.CERTIFICATION_INCOMPLETE)
            else:
                self._add(reasons, ReviewReason.RESPONSE_PACKAGE_VALIDATION_ISSUE)

            if finding.severity == "blocking":
                blocking.append(finding.code)
            else:
                warnings.append(finding.message)
