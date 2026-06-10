"""Note Taking and Data Entry Agent — fourth in the rail.

Drafts structured internal notes and the fields_to_update map (the
simulated data entry into the case record) from upstream structured
outputs. Nothing is applied without human approval; missing upstream
outputs produce a partial note flagged needs_review, never a silent skip.
"""

from typing import Any

from app.adk_agents import session_state
from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import NOTE_TAKING_AND_DATA_ENTRY_AGENT, OFFICIAL_AGENT_NAMES
from app.adk_agents.shared import (
    blocking_deficiencies,
    is_overbroad,
    request_input_summary,
    sme_reasons_present,
)
from app.models.agent_run import AgentRunDraft
from app.models.classification_result import ClassificationResult
from app.models.enums import AgentRunStatus, NoteType
from app.models.legal_request import LegalRequest
from app.models.note_draft import NoteDraft


class NoteTakingAndDataEntryAgent(CaseFlowAgent):
    """Drafts structured internal notes and fields to update; nothing is
    applied without human approval."""

    def execute(self, state: dict[str, Any]) -> AgentRunDraft:
        request = session_state.get_legal_request(state)
        if request is None:
            return self.blocked("awaiting_request", input_summary="no request in context")

        classification = session_state.get_classification(state)
        etl_output = session_state.get_etl_output(state)
        gaps = []
        if classification is None:
            gaps.append("classification")
        # ETL output is only an expected upstream when the retrieval path
        # was actually supposed to run (no blocking/SME/overbroad hold).
        etl_expected = not (
            blocking_deficiencies(request)
            or is_overbroad(request)
            or (
                classification is not None
                and sme_reasons_present(
                    [reason.value for reason in classification.review_reasons]
                )
            )
        )
        if etl_expected and etl_output is None:
            gaps.append("etl_output")

        note_type = self._note_type(state, request, classification)
        note = NoteDraft(
            note_type=note_type,
            body=self._body(request, classification, etl_output, note_type, gaps),
            fields_to_update=self._fields_to_update(classification),
            missing_fields=[finding.code.value for finding in request.deficiency_findings],
        )

        needs_review = bool(gaps)
        return self.result(
            status=AgentRunStatus.NEEDS_REVIEW if needs_review else AgentRunStatus.COMPLETE,
            input_summary=request_input_summary(request),
            output_summary=(
                f"Drafted {note_type.value.replace('_', ' ')} and populated "
                f"{len(note.fields_to_update)} case-record field(s). "
                "Human approval required before any field is applied."
            ),
            output={"note_draft": note.model_dump(mode="json")},
            rationale=(
                "Template-based note assembly from upstream structured outputs; "
                "fields_to_update derived only from classification and routing "
                "outputs, never invented."
            ),
            requires_human_review=True,
            review_reasons=[f"missing_upstream:{gap}" for gap in gaps],
        )

    @staticmethod
    def _note_type(
        state: dict[str, Any],
        request: LegalRequest,
        classification: ClassificationResult | None,
    ) -> NoteType:
        requested = state.get(session_state.REQUESTED_NOTE_TYPE)
        if requested:
            return NoteType(requested)
        if blocking_deficiencies(request) or is_overbroad(request):
            return NoteType.DEFICIENCY_NOTE
        if classification is not None and sme_reasons_present(
            [reason.value for reason in classification.review_reasons]
        ):
            return NoteType.ROUTING_RATIONALE
        return NoteType.REQUEST_INTAKE_NOTE

    @staticmethod
    def _body(
        request: LegalRequest,
        classification: ClassificationResult | None,
        etl_output: Any,
        note_type: NoteType,
        gaps: list[str],
    ) -> str:
        process = (
            request.legal_process.type.value.replace("_", " ").title()
            if request.legal_process
            else "Legal process (type unconfirmed)"
        )
        agency = (
            request.requesting_agency.agency
            if request.requesting_agency
            else "unidentified agency"
        )
        categories = (
            ", ".join(c.category for c in request.requested_data_categories)
            or "unspecified records"
        )
        identifiers = (
            ", ".join(i.value for i in request.subject_identifiers) or "no identifiers"
        )
        period = request.requested_period
        period_text = (
            f"{period.start:%Y-%m-%d} to {period.end:%Y-%m-%d}"
            if period and period.start and period.end
            else "an unspecified period"
        )
        sentences = [
            f"{process} received from {agency}.",
            f"Request seeks {categories} for {identifiers} from {period_text}.",
        ]
        if classification is not None:
            sentences.append(f"Routed to {classification.recommended_queue} (recommended).")
        if note_type == NoteType.DEFICIENCY_NOTE:
            for finding in request.deficiency_findings:
                resolution = finding.suggested_resolution or "review with requesting agency"
                sentences.append(
                    f"Deficiency — {finding.code.value.replace('_', ' ')}: "
                    f"{finding.message} Suggested resolution: {resolution}"
                )
        if note_type == NoteType.ROUTING_RATIONALE and classification is not None:
            reasons = ", ".join(
                reason.value.replace("_", " ") for reason in classification.review_reasons
            )
            sentences.append(
                f"SME escalation prepared: {reasons}. No action taken without approval."
            )
        if etl_output is not None:
            sentences.append(
                f"Mock retrieval returned {etl_output.total_responsive_records} "
                "synthetic record(s)."
            )
        if gaps:
            sentences.append(
                "Partial note — missing upstream outputs: " + ", ".join(gaps) + "."
            )
        return " ".join(sentences)

    @staticmethod
    def _fields_to_update(classification: ClassificationResult | None) -> dict[str, str]:
        if classification is None:
            return {}
        fields = {
            "request_category": classification.request_category,
            "recommended_queue": classification.recommended_queue or "",
            "urgency_tier": classification.urgency_tier or "",
            "sensitivity": classification.sensitivity.value,
        }
        if classification.product_domains:
            fields["product_domains"] = "; ".join(classification.product_domains)
        return fields


def create_note_taking_and_data_entry_agent() -> NoteTakingAndDataEntryAgent:
    return NoteTakingAndDataEntryAgent(
        name=NOTE_TAKING_AND_DATA_ENTRY_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[NOTE_TAKING_AND_DATA_ENTRY_AGENT],
        description=(
            "Drafts structured internal notes and the fields to update on "
            "the case record (human approval required)."
        ),
    )
