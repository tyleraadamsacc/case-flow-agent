"""Triaging Agent — second in the rail.

Classifies the request (type, category, urgency, sensitivity, queue,
complexity) and produces the routing recommendation. Deterministic rules
over the indexing output, special-handling flags, deficiency findings,
routing_rules.json, and the sensitive-party registry. The recommendation
is never auto-applied: its status is type-constrained to pending-human.
"""

import json
from pathlib import Path
from typing import Any

from app.adk_agents import session_state
from app.adk_agents.base import CaseFlowAgent
from app.llm.model_assist import ModelAssist
from app.adk_agents.registry import INDEXING_AGENT, OFFICIAL_AGENT_NAMES, TRIAGING_AGENT
from app.adk_agents.shared import (
    active_flags,
    blocking_deficiencies,
    is_overbroad,
    request_input_summary,
    sme_reasons_present,
)
from app.mock_data.seed import MOCK_DATA_DIR
from app.models.agent_run import AgentRunDraft
from app.models.classification_result import ClassificationResult
from app.models.enums import (
    AgentRunStatus,
    DeficiencyCode,
    LegalProcessType,
    ReviewReason,
    Sensitivity,
)
from app.models.indexing_output import IndexingOutput
from app.models.legal_request import LegalRequest
from app.models.routing_recommendation import RoutingRecommendation
from app.orchestration.approval_policy import LOW_CONFIDENCE_THRESHOLD, ApprovalPolicy
from app.services.routing_rules_service import RoutingRulesService

URGENCY_BY_PRIORITY = {1: "urgent", 2: "high", 3: "routine"}

# Deliberately below LOW_CONFIDENCE_THRESHOLD: an ambiguous legal process
# always forces human review via the low-confidence trigger.
AMBIGUOUS_PROCESS_CONFIDENCE = 0.55
assert AMBIGUOUS_PROCESS_CONFIDENCE < LOW_CONFIDENCE_THRESHOLD


class TriagingAgent(CaseFlowAgent):
    """Classifies the request into the correct pool and recommends the
    route — pending human approval, always."""

    routing_rules: list[dict[str, Any]] = []
    sensitive_parties: list[str] = []

    def execute(self, state: dict[str, Any]) -> AgentRunDraft:
        request = session_state.get_legal_request(state)
        if request is None:
            return self.blocked("awaiting_indexing", input_summary="no request in context")
        indexing_draft = session_state.get_run_draft(state, INDEXING_AGENT)
        if (
            indexing_draft is None
            or indexing_draft.status
            not in (AgentRunStatus.COMPLETE, AgentRunStatus.NEEDS_REVIEW)
            or not indexing_draft.output.get("indexing_output")
        ):
            return self.blocked(
                "awaiting_indexing",
                output_summary="Blocked: no completed Indexing Agent output to classify from.",
                input_summary=request_input_summary(request),
            )
        indexing = IndexingOutput.model_validate(indexing_draft.output["indexing_output"])

        flags = active_flags(request)
        overbroad = is_overbroad(request)
        sensitive_party = self._sensitive_party_match(request)
        routing = RoutingRulesService(self.routing_rules).resolve(
            flags=flags,
            product_domains=request.product_domains,
            overbroad=overbroad,
            sensitive_party=sensitive_party,
        )

        confidence = self._confidence(request, overbroad, flags)
        review_reasons = self._review_reasons(
            request, confidence, sensitive_party, routing.sop_conflict
        )

        classification = ClassificationResult(
            legal_process_type=(
                request.legal_process.type
                if request.legal_process
                else LegalProcessType.UNKNOWN
            ),
            request_category=self._request_category(request, flags, overbroad),
            product_domains=list(request.product_domains),
            urgency_tier=URGENCY_BY_PRIORITY[indexing.priority_rank],
            sensitivity=self._sensitivity(indexing.priority_rank, flags),
            recommended_queue=routing.queue,
            complexity=self._complexity(request, flags, overbroad),
            missing_fields=self._missing_fields(request),
            confidence=confidence,
            human_review_required=bool(review_reasons),
            review_reasons=review_reasons,
            rationale=(
                f"Routing rule {routing.rule_id} matched; "
                f"{len(request.product_domains)} product domain(s); "
                f"special handling: {', '.join(sorted(flags)) or 'none'}."
            ),
            evidence_ids=routing.matched_rule_ids,
        )
        recommendation = RoutingRecommendation(
            target_queue=routing.queue,
            escalation_target="SME Review" if routing.escalation else None,
            reason=classification.rationale,
            evidence_ids=[routing.rule_id],
        )

        # The run itself completed; policy-driven review is carried on
        # requires_human_review. needs_review status is reserved for the
        # agent's own uncertainty (low classification confidence).
        low_confidence = confidence < LOW_CONFIDENCE_THRESHOLD
        return self.result(
            status=AgentRunStatus.NEEDS_REVIEW if low_confidence else AgentRunStatus.COMPLETE,
            input_summary=request_input_summary(request),
            output_summary=(
                f"Classified as {classification.request_category}. "
                f"Route: {routing.queue}. Human approval required."
            ),
            output={
                "classification": classification.model_dump(mode="json"),
                "routing_recommendation": recommendation.model_dump(mode="json"),
            },
            confidence=confidence,
            rationale=classification.rationale,
            evidence_ids=routing.matched_rule_ids,
            requires_human_review=classification.human_review_required,
            review_reasons=[reason.value for reason in review_reasons],
            risk_flags=sme_reasons_present([reason.value for reason in review_reasons]),
        )

    def _sensitive_party_match(self, request: LegalRequest) -> bool:
        agency = request.requesting_agency
        if agency is None or not agency.agency:
            return False
        return any(party.lower() in agency.agency.lower() for party in self.sensitive_parties)

    def _review_reasons(
        self,
        request: LegalRequest,
        confidence: float,
        sensitive_party: bool,
        sop_conflict: bool,
    ) -> list[ReviewReason]:
        policy = ApprovalPolicy().evaluate(
            request,
            classification_confidence=confidence,
            sop_conflict=sop_conflict,
        )
        reasons = list(policy.review_reasons)
        if sensitive_party and ReviewReason.SENSITIVE_PARTY not in reasons:
            reasons.append(ReviewReason.SENSITIVE_PARTY)
        return reasons

    @staticmethod
    def _request_category(
        request: LegalRequest, flags: frozenset[str], overbroad: bool
    ) -> str:
        if overbroad:
            return "Multi-Product Data Production"
        if {"pen_register_requested", "trap_and_trace_requested"} & flags:
            return "Non-Content Metadata Production"
        if "Maps / Location" in request.product_domains:
            return "Location Data Production"
        if "content_requested" in flags:
            return "Content Production"
        if "Account / Subscriber" in request.product_domains:
            return "Subscriber Information Production"
        return "General Records Production"

    @staticmethod
    def _sensitivity(priority_rank: int, flags: frozenset[str]) -> Sensitivity:
        if priority_rank == 1 or {
            "content_requested",
            "tombstone_requested",
            "location_tracking_requested",
        } & flags:
            return Sensitivity.HIGH
        return Sensitivity.MEDIUM

    @staticmethod
    def _complexity(request: LegalRequest, flags: frozenset[str], overbroad: bool) -> str:
        if overbroad or len(request.product_domains) >= 3:
            return "high"
        if len(request.product_domains) == 2 or flags:
            return "medium"
        return "low"

    @staticmethod
    def _missing_fields(request: LegalRequest) -> list[str]:
        fields = []
        for finding in request.deficiency_findings:
            if finding.code in (
                DeficiencyCode.MISSING_DATE_RANGE,
                DeficiencyCode.INVALID_DATE_RANGE,
            ):
                fields.append("requested_period")
            elif finding.code == DeficiencyCode.MISSING_IDENTIFIER:
                fields.append("subject_identifiers")
        return fields

    @staticmethod
    def _confidence(
        request: LegalRequest, overbroad: bool, flags: frozenset[str]
    ) -> float:
        ambiguous = request.legal_process is None or (
            request.legal_process.type == LegalProcessType.UNKNOWN
        )
        if ambiguous:
            return AMBIGUOUS_PROCESS_CONFIDENCE
        if blocking_deficiencies(request):
            return 0.78
        if overbroad:
            return 0.80
        if flags & {"pen_register_requested", "trap_and_trace_requested", "sealed"}:
            return 0.90
        if len(request.product_domains) == 1:
            return 0.94
        return 0.85


def create_triaging_agent(
    mock_data_dir: Path = MOCK_DATA_DIR, llm_assist: ModelAssist | None = None
) -> TriagingAgent:
    routing_rules = json.loads(
        (mock_data_dir / "sop" / "routing_rules.json").read_text()
    )["rules"]
    registry_payload = json.loads(
        (mock_data_dir / "registries" / "sensitive_party_registry.json").read_text()
    )
    return TriagingAgent(
        name=TRIAGING_AGENT,
        llm_task="triage_classification",
        llm_assist=llm_assist,
        display_name=OFFICIAL_AGENT_NAMES[TRIAGING_AGENT],
        description=(
            "Classifies the legal request (type, category, urgency, "
            "sensitivity, queue) and produces the routing recommendation "
            "pending human approval."
        ),
        routing_rules=routing_rules,
        sensitive_parties=[party["name"] for party in registry_payload["parties"]],
    )
