"""Deterministic deficiency detection driven by deficiency_rules.json.

Blocking deficiencies prevent downstream finalization (enforced by the
approval flow) and will block the ETL/production path in PR 2.
"""

import json
from pathlib import Path

from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import DeficiencyCode, DeficiencySeverity, LegalProcessType
from app.models.legal_request import LegalRequest

UNRESOLVED_PLACEHOLDER_PATTERNS: tuple[str, ...] = (
    "YOUR NAME HERE",
    "ACCOUNT NAME [IF KNOWN]",
    "GOOGLE ID(UID) [IF KNOWN]",
    "ESN / IMEI / MEID [IF KNOWN]",
    "MAC ID [IF KNOWN]",
    "DATE OF INTEREST",
    "LIST CRIMINAL OFFENSE(S)",
    "YOUR EMAIL ADDRESS",
    "LAW ENFORCEMENT AGENGY",
)


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

        unresolved_placeholders = self._unresolved_placeholders(request.raw_source_text)
        if unresolved_placeholders:
            finding = self._finding(DeficiencyCode.UNRESOLVED_TEMPLATE_PLACEHOLDER)
            finding.message = (
                f"{finding.message} Unresolved marker(s): "
                f"{', '.join(unresolved_placeholders)}."
            )
            findings.append(finding)

        if any(
            check.status in {"needs_review", "missing_authority"}
            for check in request.scope_authority_checks
        ):
            findings.append(self._finding(DeficiencyCode.SCOPE_AUTHORITY_MISMATCH))

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

    @staticmethod
    def _unresolved_placeholders(raw_source_text: str | None) -> list[str]:
        if not raw_source_text:
            return []
        upper = raw_source_text.upper()
        return [
            pattern
            for pattern in UNRESOLVED_PLACEHOLDER_PATTERNS
            if pattern in upper
        ]
