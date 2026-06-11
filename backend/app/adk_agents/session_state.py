"""The ADK session-state contract between the execution bridge and the
six agents.

Session state is an execution scratchpad ONLY. The bridge seeds the input
keys before a run; each agent writes its AgentRunDraft under its run key
via an event state_delta; the bridge reads the drafts back and persists
AgentRun records — the source of truth — through the repositories.
"""

from typing import Any

from app.models.agent_run import AgentRunDraft
from app.models.classification_result import ClassificationResult
from app.models.etl_output import EtlOutput
from app.models.legal_request import LegalRequest

LEGAL_REQUEST = "caseflow:legal_request"
APPROVAL_POLICY = "caseflow:approval_policy"
RESPONSIVE_RECORDS = "caseflow:responsive_records"
RECORDS_REF = "caseflow:records_ref"
AS_OF_DATE = "caseflow:as_of_date"
REQUESTED_DRAFT_TYPE = "caseflow:requested_draft_type"
REQUESTED_NOTE_TYPE = "caseflow:requested_note_type"
HUMAN_INSTRUCTIONS = "caseflow:human_instructions"


def run_key(agent_id: str) -> str:
    return f"caseflow:run:{agent_id}"


def get_legal_request(state: dict[str, Any]) -> LegalRequest | None:
    payload = state.get(LEGAL_REQUEST)
    return LegalRequest.model_validate(payload) if payload else None


def get_run_draft(state: dict[str, Any], agent_id: str) -> AgentRunDraft | None:
    payload = state.get(run_key(agent_id))
    return AgentRunDraft.model_validate(payload) if payload else None


def get_human_instruction(state: dict[str, Any], agent_id: str) -> str | None:
    payload = state.get(HUMAN_INSTRUCTIONS)
    if not isinstance(payload, dict):
        return None
    value = payload.get(agent_id)
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def get_classification(state: dict[str, Any]) -> ClassificationResult | None:
    from app.adk_agents.registry import TRIAGING_AGENT

    draft = get_run_draft(state, TRIAGING_AGENT)
    if draft is None or not draft.output.get("classification"):
        return None
    return ClassificationResult.model_validate(draft.output["classification"])


def get_etl_output(state: dict[str, Any]) -> EtlOutput | None:
    from app.adk_agents.registry import ETL_AGENT

    draft = get_run_draft(state, ETL_AGENT)
    if draft is None or not draft.output.get("etl_output"):
        return None
    return EtlOutput.model_validate(draft.output["etl_output"])
