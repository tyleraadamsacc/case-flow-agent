"""Rule-driven routing resolution over routing_rules.json.

Rules are data, not code, so SME corrections are config edits. The
resolution is a recommendation only — RoutingRecommendation.status is
type-constrained to recommended_pending_human and no queue is ever
auto-assigned.
"""

import json
from pathlib import Path
from typing import Any

from app.models.base import CaseFlowModel

SENSITIVE_PARTY_RULE_ID = "ROUTE-SENSITIVE-PARTY"


class RoutingResolution(CaseFlowModel):
    queue: str
    rule_id: str
    escalation: bool = False
    sop_conflict: bool = False
    conflicting_rule_id: str | None = None
    matched_rule_ids: list[str] = []


class RoutingRulesService:
    def __init__(self, rules: list[dict[str, Any]]) -> None:
        self._rules: list[dict[str, Any]] = sorted(rules, key=lambda rule: rule["priority"])

    @classmethod
    def from_file(cls, rules_path: Path) -> "RoutingRulesService":
        return cls(json.loads(rules_path.read_text())["rules"])

    def resolve(
        self,
        *,
        flags: frozenset[str],
        product_domains: list[str],
        overbroad: bool,
        sensitive_party: bool,
    ) -> RoutingResolution:
        matches = [
            rule
            for rule in self._rules
            if self._matches(rule["when"], flags, product_domains, overbroad, sensitive_party)
        ]
        chosen = matches[0]  # ROUTE-DEFAULT always matches, so matches is never empty

        # An SOP conflict exists when the sensitive-party registry forces
        # SME review while the routing rules would otherwise send the
        # request to a different queue.
        sop_conflict = False
        conflicting_rule_id = None
        if chosen["rule_id"] == SENSITIVE_PARTY_RULE_ID:
            others = [rule for rule in matches if rule["rule_id"] != SENSITIVE_PARTY_RULE_ID]
            if others and others[0]["queue"] != chosen["queue"]:
                sop_conflict = True
                conflicting_rule_id = others[0]["rule_id"]

        return RoutingResolution(
            queue=chosen["queue"],
            rule_id=chosen["rule_id"],
            escalation=chosen.get("escalation", False),
            sop_conflict=sop_conflict,
            conflicting_rule_id=conflicting_rule_id,
            matched_rule_ids=[rule["rule_id"] for rule in matches],
        )

    @staticmethod
    def _matches(
        when: dict[str, Any],
        flags: frozenset[str],
        product_domains: list[str],
        overbroad: bool,
        sensitive_party: bool,
    ) -> bool:
        if when.get("always"):
            return True
        if when.get("sensitive_party"):
            return sensitive_party
        if when.get("overbroad"):
            return overbroad
        if "any_flag" in when:
            return bool(set(when["any_flag"]) & flags)
        if "product_domain" in when:
            return when["product_domain"] in product_domains
        return False
