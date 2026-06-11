"""Deterministic completeness scoring over the LegalRequest aggregate."""

import re
from collections.abc import Iterable

from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import AttestationItem, DeficiencyCode
from app.models.legal_request import LegalRequest
from app.models.request_completeness_score import (
    CompletenessComponent,
    CompletenessComponentScore,
    CompletenessStatus,
    RequestCompletenessScore,
)
from app.orchestration.approval_policy import ApprovalPolicy

_PLACEHOLDER_PATTERN = re.compile(
    r"(_{3,}|YOUR\s+[^.\n]{2,80}\s+ADDRESS|"
    r"\[(?:INSERT|ENTER|NAME|DATE|CASE|PHONE|EMAIL|ADDRESS|UNKNOWN|NOT KNOWN)[^\]]*\])",
    re.IGNORECASE,
)

_SPECIAL_HANDLING_ATTESTATIONS: frozenset[AttestationItem] = frozenset(
    {
        AttestationItem.NONDISCLOSURE_REVIEWED,
        AttestationItem.SEALED_HANDLING_ACKNOWLEDGED,
        AttestationItem.CONTENT_SCOPE_CONFIRMED,
        AttestationItem.ONGOING_COLLECTION_REVIEWED,
    }
)


class RequestCompletenessScoreService:
    def __init__(self, approval_policy: ApprovalPolicy | None = None) -> None:
        self._approval_policy = approval_policy or ApprovalPolicy()

    def score(self, request: LegalRequest) -> RequestCompletenessScore:
        components = [
            self._score_placeholders(request),
            self._score_identifiers(request),
            self._score_date_range(request),
            self._score_authority_coverage(request),
            self._score_special_handling_review(request),
            self._score_package_validation(request),
            self._score_attestations(request),
        ]
        total = round(sum(component.score for component in components) / len(components))
        return RequestCompletenessScore(
            legal_request_id=request.legal_request_id,
            total_score=total,
            status=self._status_from_score(total),
            components=components,
        )

    def _score_placeholders(
        self, request: LegalRequest
    ) -> CompletenessComponentScore:
        unresolved = self._deficiencies(
            request, {DeficiencyCode.UNRESOLVED_TEMPLATE_PLACEHOLDER}
        )
        raw_matches = _PLACEHOLDER_PATTERN.findall(request.raw_source_text or "")
        evidence = [finding.code.value for finding in unresolved]
        evidence.extend(sorted(set(match.strip() for match in raw_matches))[:5])
        if unresolved or raw_matches:
            return self._component(
                CompletenessComponent.PLACEHOLDERS,
                CompletenessStatus.INCOMPLETE,
                0,
                "Unresolved template placeholder text remains.",
                evidence,
            )
        return self._component(
            CompletenessComponent.PLACEHOLDERS,
            CompletenessStatus.COMPLETE,
            100,
            "No unresolved template placeholders detected.",
        )

    def _score_identifiers(
        self, request: LegalRequest
    ) -> CompletenessComponentScore:
        missing = self._deficiencies(request, {DeficiencyCode.MISSING_IDENTIFIER})
        usable = [
            identifier
            for identifier in request.subject_identifiers
            if identifier.value.strip()
        ]
        if usable and not missing:
            return self._component(
                CompletenessComponent.IDENTIFIERS,
                CompletenessStatus.COMPLETE,
                100,
                f"{len(usable)} subject identifier(s) extracted.",
                [identifier.type.value for identifier in usable],
            )
        if usable:
            return self._component(
                CompletenessComponent.IDENTIFIERS,
                CompletenessStatus.PARTIAL,
                50,
                "Subject identifiers are present, but identifier deficiencies remain.",
                [finding.code.value for finding in missing],
            )
        return self._component(
            CompletenessComponent.IDENTIFIERS,
            CompletenessStatus.INCOMPLETE,
            0,
            "No usable subject identifiers are present.",
            [finding.code.value for finding in missing],
        )

    def _score_date_range(
        self, request: LegalRequest
    ) -> CompletenessComponentScore:
        invalid = self._deficiencies(
            request,
            {DeficiencyCode.MISSING_DATE_RANGE, DeficiencyCode.INVALID_DATE_RANGE},
        )
        period = request.requested_period
        has_start = period is not None and period.start is not None
        has_end = period is not None and period.end is not None
        if period is not None and has_start and has_end and period.valid and not invalid:
            return self._component(
                CompletenessComponent.DATE_RANGE,
                CompletenessStatus.COMPLETE,
                100,
                "Requested date range is present and valid.",
            )
        if period is not None and (has_start or has_end):
            return self._component(
                CompletenessComponent.DATE_RANGE,
                CompletenessStatus.PARTIAL,
                50,
                "Requested date range is partially present or needs correction.",
                [*period.issues, *(finding.code.value for finding in invalid)],
            )
        return self._component(
            CompletenessComponent.DATE_RANGE,
            CompletenessStatus.INCOMPLETE,
            0,
            "Requested date range is missing.",
            [finding.code.value for finding in invalid],
        )

    def _score_authority_coverage(
        self, request: LegalRequest
    ) -> CompletenessComponentScore:
        checks = request.scope_authority_checks
        if not request.requested_data_categories:
            return self._component(
                CompletenessComponent.AUTHORITY_COVERAGE,
                CompletenessStatus.INCOMPLETE,
                0,
                "No requested data categories are present to check against authority.",
            )
        if not checks:
            return self._component(
                CompletenessComponent.AUTHORITY_COVERAGE,
                CompletenessStatus.PARTIAL,
                50,
                "Authority coverage has not been analyzed yet.",
            )
        covered = [check for check in checks if check.status == "covered"]
        gaps = [check for check in checks if check.status != "covered"]
        if not gaps:
            return self._component(
                CompletenessComponent.AUTHORITY_COVERAGE,
                CompletenessStatus.COMPLETE,
                100,
                "All requested categories are covered by cited authority.",
                [check.category for check in covered],
            )
        if covered:
            return self._component(
                CompletenessComponent.AUTHORITY_COVERAGE,
                CompletenessStatus.PARTIAL,
                50,
                "Some requested categories need authority review.",
                [f"{check.category}:{check.status}" for check in gaps],
            )
        return self._component(
            CompletenessComponent.AUTHORITY_COVERAGE,
            CompletenessStatus.INCOMPLETE,
            0,
            "Requested categories are not covered by cited authority.",
            [f"{check.category}:{check.status}" for check in gaps],
        )

    def _score_special_handling_review(
        self, request: LegalRequest
    ) -> CompletenessComponentScore:
        active_flags = request.special_handling.active_flags()
        if not active_flags:
            return self._component(
                CompletenessComponent.SPECIAL_HANDLING_REVIEW,
                CompletenessStatus.COMPLETE,
                100,
                "No special handling flags are active.",
            )

        required = [
            item
            for item in self._approval_policy.required_attestations(request)
            if item in _SPECIAL_HANDLING_ATTESTATIONS
        ]
        attested = {attestation.item for attestation in request.attestations}
        missing = [item for item in required if item not in attested]
        has_human_review = bool(request.reviews or request.approvals)
        if required and not missing:
            return self._component(
                CompletenessComponent.SPECIAL_HANDLING_REVIEW,
                CompletenessStatus.COMPLETE,
                100,
                "Special handling flags have the required human attestations.",
                [item.value for item in required],
            )
        if has_human_review:
            return self._component(
                CompletenessComponent.SPECIAL_HANDLING_REVIEW,
                CompletenessStatus.PARTIAL,
                50,
                "Special handling flags have human review but missing attestations.",
                [item.value for item in missing],
            )
        return self._component(
            CompletenessComponent.SPECIAL_HANDLING_REVIEW,
            CompletenessStatus.INCOMPLETE,
            0,
            "Special handling flags are active and still need human review.",
            active_flags,
        )

    def _score_package_validation(
        self, request: LegalRequest
    ) -> CompletenessComponentScore:
        if request.production_package is None:
            return self._component(
                CompletenessComponent.PACKAGE_VALIDATION,
                CompletenessStatus.INCOMPLETE,
                0,
                "No production package is present for validation.",
            )
        findings = request.package_validation_findings
        if not findings:
            return self._component(
                CompletenessComponent.PACKAGE_VALIDATION,
                CompletenessStatus.COMPLETE,
                100,
                "Production package validation has no findings.",
            )
        blocking = [finding for finding in findings if finding.severity == "blocking"]
        status = (
            CompletenessStatus.INCOMPLETE
            if blocking
            else CompletenessStatus.PARTIAL
        )
        return self._component(
            CompletenessComponent.PACKAGE_VALIDATION,
            status,
            0 if blocking else 50,
            "Production package validation findings remain.",
            [finding.code for finding in findings],
        )

    def _score_attestations(
        self, request: LegalRequest
    ) -> CompletenessComponentScore:
        required = self._approval_policy.required_attestations(request)
        attested = {attestation.item for attestation in request.attestations}
        missing = [item for item in required if item not in attested]
        if not missing:
            return self._component(
                CompletenessComponent.ATTESTATIONS,
                CompletenessStatus.COMPLETE,
                100,
                "All required attestations are recorded.",
                [item.value for item in required],
            )
        if attested:
            return self._component(
                CompletenessComponent.ATTESTATIONS,
                CompletenessStatus.PARTIAL,
                50,
                "Some required attestations are still missing.",
                [item.value for item in missing],
            )
        return self._component(
            CompletenessComponent.ATTESTATIONS,
            CompletenessStatus.INCOMPLETE,
            0,
            "Required attestations have not been recorded.",
            [item.value for item in missing],
        )

    @staticmethod
    def _component(
        component: CompletenessComponent,
        status: CompletenessStatus,
        score: int,
        message: str,
        evidence: Iterable[str] = (),
    ) -> CompletenessComponentScore:
        return CompletenessComponentScore(
            component=component,
            status=status,
            score=score,
            message=message,
            evidence=list(evidence),
        )

    @staticmethod
    def _deficiencies(
        request: LegalRequest, codes: set[DeficiencyCode]
    ) -> list[DeficiencyFinding]:
        return [finding for finding in request.deficiency_findings if finding.code in codes]

    @staticmethod
    def _status_from_score(score: int) -> CompletenessStatus:
        if score == 100:
            return CompletenessStatus.COMPLETE
        if score == 0:
            return CompletenessStatus.INCOMPLETE
        return CompletenessStatus.PARTIAL
