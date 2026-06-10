"""Text Content Agent — fifth in the rail.

Drafts all outward-shaped text artifacts per the Template LERS Response
structure: production package, no-responsive-records variant, production
summary, deficiency response, and SME notification. Drafts only — the
TextDraft status is type-constrained to draft_not_final and the package
status has no agent-reachable final, so the agent literally cannot send,
certify final, or release anything. The record index is always copied
from the ETL output, never invented.
"""

from datetime import date
from pathlib import Path
from typing import Any

from app.adk_agents import session_state
from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import ETL_AGENT, OFFICIAL_AGENT_NAMES, TEXT_CONTENT_AGENT
from app.adk_agents.shared import (
    blocking_deficiencies,
    is_overbroad,
    request_input_summary,
    sme_reasons_present,
)
from app.mock_data.seed import MOCK_DATA_DIR
from app.models.agent_run import AgentRunDraft
from app.models.classification_result import ClassificationResult
from app.models.enums import AgentRunStatus, DraftType
from app.models.legal_request import LegalRequest
from app.models.responsive_record import ResponsiveRecord
from app.models.text_draft import TextDraft
from app.services.response_package_service import ResponsePackageService

PACKAGE_DRAFT_TYPES = (
    DraftType.PRODUCTION_PACKAGE,
    DraftType.NO_RESPONSIVE_RECORDS,
    DraftType.PRODUCTION_SUMMARY,
)


class TextContentAgent(CaseFlowAgent):
    """Drafts the response package, deficiency response, SME notification,
    or production summary.

    Drafts only: never sends, never certifies final, never releases.
    """

    package_rules_path: str = ""

    def execute(self, state: dict[str, Any]) -> AgentRunDraft:
        request = session_state.get_legal_request(state)
        if request is None:
            return self.blocked("awaiting_triage", input_summary="no request in context")
        input_summary = request_input_summary(request)

        classification = session_state.get_classification(state)
        if classification is None:
            return self.blocked(
                "awaiting_triage",
                output_summary="Blocked: no classification available to draft from.",
                input_summary=input_summary,
            )

        etl_output = session_state.get_etl_output(state)
        draft_type = self._draft_type(state, request, classification, etl_output)
        if draft_type in PACKAGE_DRAFT_TYPES and etl_output is None:
            return self.blocked(
                "awaiting_etl",
                output_summary=(
                    "Blocked: a production package cannot be drafted without "
                    "a completed ETL Agent run."
                ),
                input_summary=input_summary,
            )

        service = ResponsePackageService(Path(self.package_rules_path))
        as_of = date.fromisoformat(state[session_state.AS_OF_DATE]) \
            if state.get(session_state.AS_OF_DATE) else date.today()

        package = None
        if draft_type in PACKAGE_DRAFT_TYPES:
            etl_draft = session_state.get_run_draft(state, ETL_AGENT)
            records = [
                ResponsiveRecord.model_validate(item)
                for item in (etl_draft.output.get("records") if etl_draft else None) or []
            ]
            package = service.build_production_package(
                request,
                etl_output,
                records,
                as_of=as_of,
                risk_flags=[reason.value for reason in classification.review_reasons],
            )
            sections = service.package_sections(package)
        elif draft_type == DraftType.DEFICIENCY_RESPONSE:
            findings = request.deficiency_findings
            sections = service.deficiency_response_sections(request, findings)
        else:  # SME notification
            sections = service.sme_notification_sections(request, classification)

        text_draft = TextDraft(
            draft_type=draft_type,
            sections=sections,
            evidence_ids=[service.evidence_id(draft_type)],
        )
        output: dict[str, Any] = {"text_draft": text_draft.model_dump(mode="json")}
        if package is not None:
            output["production_package"] = package.model_dump(mode="json")

        return self.result(
            status=AgentRunStatus.COMPLETE,
            input_summary=input_summary,
            output_summary=self._output_summary(draft_type, sections),
            output=output,
            rationale=(
                "Template-driven assembly from response_package_rules.json; "
                "record index and counts taken verbatim from the ETL output."
            ),
            evidence_ids=text_draft.evidence_ids,
            requires_human_review=True,
            review_reasons=[f"{draft_type.value}_drafted"],
            risk_flags=sme_reasons_present(
                [reason.value for reason in classification.review_reasons]
            ),
        )

    @staticmethod
    def _draft_type(
        state: dict[str, Any],
        request: LegalRequest,
        classification: ClassificationResult,
        etl_output: Any,
    ) -> DraftType:
        requested = state.get(session_state.REQUESTED_DRAFT_TYPE)
        if requested:
            return DraftType(requested)
        if blocking_deficiencies(request):
            return DraftType.DEFICIENCY_RESPONSE
        if sme_reasons_present([reason.value for reason in classification.review_reasons]):
            return DraftType.SME_NOTIFICATION
        if is_overbroad(request):
            # Overbroad scope is answered with a clarification/narrowing
            # request, modeled as a deficiency response.
            return DraftType.DEFICIENCY_RESPONSE
        if etl_output is not None and etl_output.total_responsive_records > 0:
            return DraftType.PRODUCTION_PACKAGE
        if etl_output is not None and any(
            category.content_type == "location"
            for category in request.requested_data_categories
        ):
            return DraftType.NO_RESPONSIVE_RECORDS
        return DraftType.PRODUCTION_SUMMARY

    @staticmethod
    def _output_summary(draft_type: DraftType, sections: dict[str, str]) -> str:
        if draft_type in PACKAGE_DRAFT_TYPES:
            return (
                "Drafted production summary, record index, field definitions, "
                "chain of custody, and certification "
                f"({draft_type.value}). Draft pending analyst approval."
            )
        if draft_type == DraftType.DEFICIENCY_RESPONSE:
            return (
                f"Drafted deficiency/clarification response ({len(sections)} section(s)). "
                "Draft pending analyst approval — nothing is sent."
            )
        return "Drafted SME notification. Draft pending analyst approval — nothing is sent."


def create_text_content_agent(mock_data_dir: Path = MOCK_DATA_DIR) -> TextContentAgent:
    return TextContentAgent(
        name=TEXT_CONTENT_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[TEXT_CONTENT_AGENT],
        description=(
            "Drafts response package, deficiency response, SME "
            "notification, or production summary (draft-only, human "
            "approval required)."
        ),
        package_rules_path=str(mock_data_dir / "sop" / "response_package_rules.json"),
    )
