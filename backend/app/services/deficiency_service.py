"""Deterministic deficiency detection driven by deficiency_rules.json.

Blocking deficiencies prevent downstream finalization (enforced by the
approval flow) and will block the ETL/production path in PR 2.
"""

import json
from pathlib import Path

from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import DeficiencyCode, DeficiencySeverity, LegalProcessType
from app.models.legal_request import LegalRequest


class DeficiencyService:
    def __init__(self, rules_path: Path) -> None:
        payload = json.loads(rules_path.read_text())
        self._overbroad_threshold: int = payload["overbroad_domain_threshold"]
        self._rules: dict[str, dict] = {rule["code"]: rule for rule in payload["rules"]}

    def evaluate(self, request: LegalRequest) -> list[DeficiencyFinding]:
        findings: list[DeficiencyFinding] = []

        period = request.requested_period
        if period is None or (period.start is None and period.end is None):
            findings.append(self._finding(DeficiencyCode.MISSING_DATE_RANGE))
        elif (
            period.start is None
            or period.end is None
            or period.start > period.end
        ):
            findings.append(self._finding(DeficiencyCode.INVALID_DATE_RANGE))

        if not request.subject_identifiers:
            findings.append(self._finding(DeficiencyCode.MISSING_IDENTIFIER))

        if len(request.product_domains) >= self._overbroad_threshold:
            findings.append(self._finding(DeficiencyCode.OVERBROAD_SCOPE))

        if request.legal_process is None or request.legal_process.type in (
            LegalProcessType.UNKNOWN,
        ):
            findings.append(self._finding(DeficiencyCode.AMBIGUOUS_REQUEST_TYPE))

        return findings

    def _finding(self, code: DeficiencyCode) -> DeficiencyFinding:
        rule = self._rules[code.value]
        return DeficiencyFinding(
            code=code,
            severity=DeficiencySeverity(rule["severity"]),
            message=rule["message"],
            requires_human_review=rule.get("requires_human_review", True),
            suggested_resolution=rule.get("suggested_resolution"),
            evidence_ids=[rule["evidence_id"]] if rule.get("evidence_id") else [],
        )
