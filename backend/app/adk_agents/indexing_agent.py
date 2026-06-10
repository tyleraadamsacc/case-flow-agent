"""Indexing Agent — first in the rail.

Indexes and ranks the request by legal process, product/domain,
identifiers, SOP matches, and priority, deterministically from the
extracted fields and request_intake_sop.json.
"""

import json
from pathlib import Path
from typing import Any

from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import INDEXING_AGENT, OFFICIAL_AGENT_NAMES
from app.adk_agents.shared import (
    active_flags,
    blocking_deficiencies,
    is_extraction_incomplete,
    is_overbroad,
    request_input_summary,
)
from app.mock_data.seed import MOCK_DATA_DIR
from app.models.agent_run import AgentRunDraft
from app.models.enums import AgentRunStatus, LegalProcessType, ReviewReason
from app.models.indexing_output import IndexingOutput
from app.models.legal_request import LegalRequest
from app.adk_agents import session_state

PRIORITY_1_FLAGS = frozenset(
    {
        "pen_register_requested",
        "trap_and_trace_requested",
        "sealed",
        "non_disclosure_to_subscriber",
        "no_adverse_action",
        "ongoing_access_requested",
    }
)
PRIORITY_2_FLAGS = frozenset(
    {"location_tracking_requested", "content_requested", "tombstone_requested"}
)


class IndexingAgent(CaseFlowAgent):
    """Indexes the request by legal process, product/domain, identifiers,
    SOP matches, and priority."""

    sop_entries: list[dict[str, Any]] = []

    def execute(self, state: dict[str, Any]) -> AgentRunDraft:
        request = session_state.get_legal_request(state)
        if request is None or is_extraction_incomplete(request):
            return self.blocked(
                "extraction_incomplete",
                output_summary=(
                    "Blocked: extraction incomplete — no extracted fields available to index."
                ),
                input_summary=request_input_summary(request) if request else "no request",
            )

        flags = active_flags(request)
        output = IndexingOutput(
            primary_labels=self._primary_labels(request),
            product_domains=list(request.product_domains),
            legal_process_tags=self._legal_process_tags(request, flags),
            priority_rank=self._priority_rank(request, flags),
            sop_matches=self._sop_matches(request, flags),
            confidence=self._confidence(request),
        )

        unknown_process = (
            request.legal_process is None
            or request.legal_process.type == LegalProcessType.UNKNOWN
        )
        needs_review = unknown_process or output.confidence < 0.75
        return self.result(
            status=AgentRunStatus.NEEDS_REVIEW if needs_review else AgentRunStatus.COMPLETE,
            input_summary=request_input_summary(request),
            output_summary="Indexed as " + " + ".join(output.primary_labels) + ".",
            output={"indexing_output": output.model_dump(mode="json")},
            confidence=output.confidence,
            rationale=(
                "Rule-driven labeling from extracted fields: legal process type, "
                "requested data categories, product/domain taxonomy, and "
                "special-handling flags matched against intake SOP entries."
            ),
            evidence_ids=output.sop_matches,
            requires_human_review=needs_review,
            review_reasons=(
                [ReviewReason.LOW_CLASSIFICATION_CONFIDENCE.value] if needs_review else []
            ),
            risk_flags=sorted(flags & (PRIORITY_1_FLAGS | PRIORITY_2_FLAGS)),
        )

    @staticmethod
    def _primary_labels(request: LegalRequest) -> list[str]:
        labels: list[str] = []
        if request.legal_process is not None:
            labels.append(request.legal_process.type.value.replace("_", " ").title())
        labels.extend(category.category for category in request.requested_data_categories)
        for domain in request.product_domains:
            if domain not in labels:
                labels.append(domain)
        return labels or ["Unclassified Request"]

    @staticmethod
    def _legal_process_tags(request: LegalRequest, flags: frozenset[str]) -> list[str]:
        tags: list[str] = []
        process = request.legal_process
        if process is not None:
            tags.append(process.type.value)
            if process.court_order_included:
                tags.append("court_order_included")
            if process.ex_parte_order:
                tags.append("ex_parte_order")
            if process.stored_communications:
                tags.append("stored_communications")
        tags.extend(sorted(flags))
        return tags

    @staticmethod
    def _priority_rank(request: LegalRequest, flags: frozenset[str]) -> int:
        if flags & PRIORITY_1_FLAGS:
            return 1
        if flags & PRIORITY_2_FLAGS or is_overbroad(request) or blocking_deficiencies(request):
            return 2
        return 3

    def _sop_matches(self, request: LegalRequest, flags: frozenset[str]) -> list[str]:
        matches: list[str] = []
        overbroad = is_overbroad(request)
        for entry in self.sop_entries:
            when = entry["match"]
            matched = (
                ("product_domain" in when and when["product_domain"] in request.product_domains)
                or ("any_flag" in when and bool(set(when["any_flag"]) & flags))
                or (when.get("overbroad") and overbroad)
            )
            if matched:
                matches.append(entry["sop_id"])
        return matches

    @staticmethod
    def _confidence(request: LegalRequest) -> float:
        confidence = 0.95
        if not request.subject_identifiers:
            confidence -= 0.15
        if request.legal_process is None or (
            request.legal_process.type == LegalProcessType.UNKNOWN
        ):
            confidence -= 0.30
        return round(max(confidence, 0.0), 2)


def create_indexing_agent(mock_data_dir: Path = MOCK_DATA_DIR) -> IndexingAgent:
    sop_entries = json.loads(
        (mock_data_dir / "sop" / "request_intake_sop.json").read_text()
    )["sop_entries"]
    return IndexingAgent(
        name=INDEXING_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[INDEXING_AGENT],
        description=(
            "Indexes the legal request by legal process, product/domain, "
            "identifiers, SOP matches, and priority."
        ),
        sop_entries=sop_entries,
    )
