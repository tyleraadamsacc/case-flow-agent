"""Apply bounded human corrections to agent-produced fields (theme A).

Each OverrideTarget has an explicit handler that mutates the request and
returns the before/after strings. Targets that affect deficiency
detection (the requested period, the legal-process type) re-run the
deficiency service, so a human correction can clear a blocking
deficiency. The service mutates the aggregate in place; the route records
the HumanOverride and the audit event.
"""

from datetime import date, datetime

from app.errors import CaseFlowError
from app.models.enums import LegalProcessType, OverrideTarget
from app.models.legal_process import LegalProcess
from app.models.legal_request import LegalRequest
from app.models.requested_period import RequestedPeriod
from app.models.routing_recommendation import RoutingRecommendation
from app.services.deficiency_service import DeficiencyService


class OverrideError(CaseFlowError):
    """Raised when an override request is malformed (missing value, bad
    target/value combination). Mapped to HTTP 422."""


class OverrideResult:
    def __init__(self, before: str, after: str, cleared_deficiencies: list[str]):
        self.before = before
        self.after = after
        self.cleared_deficiencies = cleared_deficiencies


class OverrideService:
    def __init__(self, deficiency_service: DeficiencyService) -> None:
        self._deficiency = deficiency_service

    def apply(
        self,
        request: LegalRequest,
        target: OverrideTarget,
        *,
        text_value: str | None,
        period_start: date | None,
        period_end: date | None,
    ) -> OverrideResult:
        if target == OverrideTarget.REQUESTED_PERIOD:
            return self._apply_period(request, period_start, period_end)
        if target == OverrideTarget.LEGAL_PROCESS_TYPE:
            return self._apply_process_type(request, text_value)
        if target == OverrideTarget.RECOMMENDED_QUEUE:
            return self._apply_queue(request, text_value)
        if target == OverrideTarget.PRODUCTION_SUMMARY_TEXT:
            return self._apply_production_summary_text(request, text_value)
        if target == OverrideTarget.CERTIFICATION_REPRESENTATIVE:
            return self._apply_cert_representative(request, text_value)
        raise OverrideError(f"Unsupported override target: {target}")

    # ----- deficiency-affecting corrections -----

    def _apply_period(
        self, request: LegalRequest, start: date | None, end: date | None
    ) -> OverrideResult:
        if start is None or end is None:
            raise OverrideError(
                "requested_period override needs both period_start and period_end."
            )
        if start > end:
            raise OverrideError("period_start must not be after period_end.")
        before_codes = self._deficiency_codes(request)
        before = self._period_str(request.requested_period)
        request.requested_period = RequestedPeriod(
            start=datetime(start.year, start.month, start.day),
            end=datetime(end.year, end.month, end.day),
            valid=True,
            issues=[],
        )
        cleared = self._recompute_deficiencies(request, before_codes)
        return OverrideResult(before, self._period_str(request.requested_period), cleared)

    def _apply_process_type(
        self, request: LegalRequest, value: str | None
    ) -> OverrideResult:
        process_type = self._parse_process_type(value)
        before_codes = self._deficiency_codes(request)
        before = (
            request.legal_process.type.value if request.legal_process else "none"
        )
        if request.legal_process is None:
            request.legal_process = LegalProcess(type=process_type)
        else:
            request.legal_process.type = process_type
        cleared = self._recompute_deficiencies(request, before_codes)
        return OverrideResult(before, process_type.value, cleared)

    # ----- non-deficiency corrections -----

    def _apply_queue(self, request: LegalRequest, value: str | None) -> OverrideResult:
        queue = (value or "").strip()
        if not queue:
            raise OverrideError("recommended_queue override needs a non-empty value.")
        before = (
            request.routing_recommendation.target_queue
            if request.routing_recommendation
            else None
        ) or (
            request.classification.recommended_queue
            if request.classification
            else None
        ) or "none"
        if request.routing_recommendation is None:
            request.routing_recommendation = RoutingRecommendation(target_queue=queue)
        else:
            request.routing_recommendation.target_queue = queue
        if request.classification is not None:
            request.classification.recommended_queue = queue
        return OverrideResult(before, queue, [])

    def _apply_cert_representative(
        self, request: LegalRequest, value: str | None
    ) -> OverrideResult:
        name = (value or "").strip()
        if not name:
            raise OverrideError(
                "certification_representative override needs a non-empty value."
            )
        package = request.production_package
        if package is None or package.certification is None:
            raise OverrideError(
                "No drafted production package with a certification to correct."
            )
        before = package.certification.authorized_representative or "none"
        package.certification.authorized_representative = name
        return OverrideResult(before, name, [])

    def _apply_production_summary_text(
        self, request: LegalRequest, value: str | None
    ) -> OverrideResult:
        text = (value or "").strip()
        if not text:
            raise OverrideError(
                "production_summary_text override needs a non-empty value."
            )
        package = request.production_package
        if package is None:
            raise OverrideError("No drafted production package to correct.")
        before = package.production_summary.ordinary_course_statement or "none"
        package.production_summary.ordinary_course_statement = text
        for draft in request.text_drafts:
            if draft.draft_type.value in {"production_package", "production_summary"}:
                draft.sections["production_summary"] = text
        return OverrideResult(before, text, [])

    # ----- helpers -----

    def _recompute_deficiencies(
        self, request: LegalRequest, before_codes: set[str]
    ) -> list[str]:
        request.deficiency_findings = self._deficiency.evaluate(request)
        after_codes = self._deficiency_codes(request)
        return sorted(before_codes - after_codes)

    @staticmethod
    def _deficiency_codes(request: LegalRequest) -> set[str]:
        return {finding.code.value for finding in request.deficiency_findings}

    @staticmethod
    def _period_str(period: RequestedPeriod | None) -> str:
        if period is None or (period.start is None and period.end is None):
            return "none"
        start = period.start.date().isoformat() if period.start else "?"
        end = period.end.date().isoformat() if period.end else "?"
        return f"{start} to {end}"

    @staticmethod
    def _parse_process_type(value: str | None) -> LegalProcessType:
        try:
            return LegalProcessType((value or "").strip().lower())
        except ValueError as exc:
            allowed = ", ".join(t.value for t in LegalProcessType)
            raise OverrideError(
                f"Unknown legal_process_type '{value}'. Allowed: {allowed}."
            ) from exc
