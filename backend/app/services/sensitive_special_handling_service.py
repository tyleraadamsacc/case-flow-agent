"""Deterministic special-handling detection.

Reads the extracted SpecialHandlingFlags (and legal-process flags) and
produces the review reasons that feed the approval policy, with stable
evidence ids from special_handling_rules.json.
"""

import json
from pathlib import Path

from app.models.base import CaseFlowModel
from app.models.enums import ReviewReason
from app.models.legal_request import LegalRequest


class SpecialHandlingCheck(CaseFlowModel):
    active_flags: list[str] = []
    review_reasons: list[ReviewReason] = []
    evidence_ids: list[str] = []


class SensitiveSpecialHandlingService:
    def __init__(self, rules_path: Path) -> None:
        rules = json.loads(rules_path.read_text())["rules"]
        self._rules: dict[str, dict] = {rule["flag"]: rule for rule in rules}

    def check(self, request: LegalRequest) -> SpecialHandlingCheck:
        flags = request.special_handling
        active = flags.active_flags()
        process = request.legal_process
        if process is not None:
            if process.pen_register and "pen_register_requested" not in active:
                active.append("pen_register_requested")
            if process.trap_and_trace and "trap_and_trace_requested" not in active:
                active.append("trap_and_trace_requested")
            if process.location_tracking and "location_tracking_requested" not in active:
                active.append("location_tracking_requested")

        reasons: list[ReviewReason] = []
        evidence_ids: list[str] = []
        for flag in active:
            rule = self._rules.get(flag)
            if rule is None:
                continue
            reason = ReviewReason(rule["review_reason"])
            if reason not in reasons:
                reasons.append(reason)
            evidence_id = rule.get("evidence_id")
            if evidence_id and evidence_id not in evidence_ids:
                evidence_ids.append(evidence_id)

        return SpecialHandlingCheck(
            active_flags=active, review_reasons=reasons, evidence_ids=evidence_ids
        )
