"""FastAPI-side bridge between the application and ADK.

Creates the ADK session, seeds the scratchpad input state, runs
``CaseFlowRootAgent`` (or a single rail agent) through the ADK Runner,
and converts each agent's session-state draft into a persisted AgentRun
with exactly one audit event — blocked and failed runs included. The
agent-run repository is the source of truth; session state is discarded
after conversion.

The bridge enforces the authority boundary: agent execution never
transitions the legal workflow state, and nothing here can approve,
finalize, release, or send. Audit-write failure aborts persistence of the
failing run and everything after it.
"""

import asyncio
import hashlib
from datetime import date
from pathlib import Path
from typing import Any

from google.adk.runners import InMemoryRunner
from google.genai import types

from app.adk_agents import session_state
from app.adk_agents.registry import (
    AUTOMATION_AGENT,
    ETL_AGENT,
    INDEXING_AGENT,
    NOTE_TAKING_AND_DATA_ENTRY_AGENT,
    OFFICIAL_AGENT_NAMES,
    RAIL_ORDER,
    TEXT_CONTENT_AGENT,
    TRIAGING_AGENT,
)
from app.adk_agents.root_agent import create_caseflow_root_agent
from app.llm.model_assist import ModelAssist
from app.errors import AgentExecutionStateError, NotFoundError
from app.logging_config import correlation_id_var
from app.mock_data.seed import MOCK_DATA_DIR
from app.models.agent_run import AgentRun, AgentRunDraft
from app.models.classification_result import ClassificationResult
from app.models.enums import ActorType, AgentRunStatus, AuditAction
from app.models.legal_request import LegalRequest
from app.models.note_draft import NoteDraft
from app.models.production_package import ProductionPackage
from app.models.routing_recommendation import RoutingRecommendation
from app.models.text_draft import TextDraft
from app.models.workflow_state import WorkflowState
from app.repositories.agent_run_repository import AgentRunRepository
from app.repositories.legal_request_repository import LegalRequestRepository
from app.repositories.response_record_repository import ResponseRecordRepository
from app.services.audit_service import AuditService

# Agent execution requires extracted fields and runs before/alongside
# human review. It never runs after approval or on un-extracted intake.
ALLOWED_STATES = frozenset(
    {
        WorkflowState.REQUEST_EXTRACTED,
        WorkflowState.REQUEST_VALIDATED,
        WorkflowState.ANALYST_REVIEW_PENDING,
        WorkflowState.CHANGES_REQUESTED,
        WorkflowState.ESCALATED,
    }
)

# Default audit action per agent. Text Content's action is refined per
# draft type when its output is present.
AUDIT_ACTION_BY_AGENT: dict[str, AuditAction] = {
    INDEXING_AGENT: AuditAction.REQUEST_INDEXED,
    TRIAGING_AGENT: AuditAction.REQUEST_CLASSIFIED,
    ETL_AGENT: AuditAction.ETL_SIMULATED,
    NOTE_TAKING_AND_DATA_ENTRY_AGENT: AuditAction.NOTE_DRAFTED,
    TEXT_CONTENT_AGENT: AuditAction.PRODUCTION_PACKAGE_DRAFTED,
    AUTOMATION_AGENT: AuditAction.WORKFLOW_ACTION_PREPARED,
}

TEXT_DRAFT_AUDIT_ACTIONS: dict[str, AuditAction] = {
    "production_package": AuditAction.PRODUCTION_PACKAGE_DRAFTED,
    "no_responsive_records": AuditAction.PRODUCTION_PACKAGE_DRAFTED,
    "production_summary": AuditAction.PRODUCTION_PACKAGE_DRAFTED,
    "deficiency_response": AuditAction.DEFICIENCY_RESPONSE_DRAFTED,
    "sme_notification": AuditAction.SME_NOTIFICATION_DRAFTED,
}

APP_NAME = "caseflow"
USER_ID = "caseflow-backend"


class AgentExecutionService:
    def __init__(
        self,
        legal_request_repository: LegalRequestRepository,
        agent_run_repository: AgentRunRepository,
        response_record_repository: ResponseRecordRepository,
        audit_service: AuditService,
        mock_data_dir: Path = MOCK_DATA_DIR,
        llm_assist: ModelAssist | None = None,
    ) -> None:
        self._requests = legal_request_repository
        self._runs = agent_run_repository
        self._records = response_record_repository
        self._audit = audit_service
        self._mock_data_dir = mock_data_dir
        self.llm_assist = llm_assist

    def run_rail(self, legal_request_id: str) -> list[AgentRun]:
        """Run all six agents in rail order through CaseFlowRootAgent and
        persist one AgentRun + one audit event per agent."""
        request = self._load(legal_request_id)
        initial_state = self._build_input_state(request)
        final_state = asyncio.run(
            self._execute(create_caseflow_root_agent(self._mock_data_dir, self.llm_assist),
            initial_state,)
        )
        return self._persist(request, final_state, RAIL_ORDER)

    def run_single(
        self,
        legal_request_id: str,
        agent,
        *,
        requested_draft_type: str | None = None,
        requested_note_type: str | None = None,
    ) -> AgentRun:
        """Run one rail agent with context rebuilt from persisted runs."""
        request = self._load(legal_request_id)
        initial_state = self._build_input_state(request)
        for run in self._runs.list_for_request(legal_request_id):
            # Latest persisted run per agent provides the upstream context.
            initial_state[session_state.run_key(run.agent_id)] = run.model_dump(
                mode="json", include=set(AgentRunDraft.model_fields)
            )
        if requested_draft_type is not None:
            initial_state[session_state.REQUESTED_DRAFT_TYPE] = requested_draft_type
        if requested_note_type is not None:
            initial_state[session_state.REQUESTED_NOTE_TYPE] = requested_note_type

        final_state = asyncio.run(self._execute(agent, initial_state))
        return self._persist(request, final_state, (agent.name,))[0]

    def _load(self, legal_request_id: str) -> LegalRequest:
        request = self._requests.get(legal_request_id)
        if request is None:
            raise NotFoundError("legal_request", legal_request_id)
        if request.workflow_state not in ALLOWED_STATES:
            raise AgentExecutionStateError(legal_request_id, request.workflow_state)
        return request

    def _build_input_state(self, request: LegalRequest) -> dict[str, Any]:
        records = self._records.records_for_request(request.legal_request_id)
        records_ref = self._records.source_for_request(request.legal_request_id)
        return {
            session_state.LEGAL_REQUEST: request.model_dump(mode="json"),
            session_state.RESPONSIVE_RECORDS: [
                record.model_dump(mode="json") for record in records
            ],
            session_state.RECORDS_REF: records_ref,
            session_state.AS_OF_DATE: date.today().isoformat(),
        }

    @staticmethod
    async def _execute(node, initial_state: dict[str, Any]) -> dict[str, Any]:
        runner = InMemoryRunner(node=node, app_name=APP_NAME)
        session = await runner.session_service.create_session(
            app_name=APP_NAME, user_id=USER_ID, state=initial_state
        )
        async for _ in runner.run_async(
            user_id=USER_ID,
            session_id=session.id,
            new_message=types.Content(role="user", parts=[types.Part(text="run")]),
        ):
            pass
        final = await runner.session_service.get_session(
            app_name=APP_NAME, user_id=USER_ID, session_id=session.id
        )
        return dict(final.state)

    def _persist(
        self,
        request: LegalRequest,
        final_state: dict[str, Any],
        agent_ids: tuple[str, ...],
    ) -> list[AgentRun]:
        input_hash = hashlib.sha256(
            request.model_dump_json().encode()
        ).hexdigest()[:16]
        persisted: list[AgentRun] = []
        for agent_id in agent_ids:
            draft = session_state.get_run_draft(final_state, agent_id)
            if draft is None:
                # An agent that produced no draft is itself an audited failure.
                draft = AgentRunDraft(
                    agent_id=agent_id,
                    agent_name=OFFICIAL_AGENT_NAMES[agent_id],
                    status=AgentRunStatus.FAILED,
                    output_summary="Agent produced no output draft.",
                    validation_status="invalid",
                )
            event = self._audit.record(
                legal_request_id=request.legal_request_id,
                actor_type=ActorType.AGENT,
                actor_id=agent_id,
                action=self._audit_action(agent_id, draft),
                before_state=request.workflow_state,
                after_state=request.workflow_state,
                summary=f"{draft.agent_name}: {draft.output_summary}",
                evidence_ids=draft.evidence_ids,
                confidence=draft.confidence,
                correlation_id=correlation_id_var.get(),
            )
            run = AgentRun(
                **draft.model_dump(),
                legal_request_id=request.legal_request_id,
                audit_event_id=event.audit_event_id,
                input_hash=input_hash,
            )
            self._runs.save(run)
            persisted.append(run)
            self._apply_artifacts(request, run)
        self._requests.save(request)
        return persisted

    @staticmethod
    def _audit_action(agent_id: str, draft: AgentRunDraft) -> AuditAction:
        if agent_id == TEXT_CONTENT_AGENT and draft.output.get("text_draft"):
            draft_type = draft.output["text_draft"].get("draft_type", "")
            return TEXT_DRAFT_AUDIT_ACTIONS.get(
                draft_type, AuditAction.PRODUCTION_PACKAGE_DRAFTED
            )
        return AUDIT_ACTION_BY_AGENT[agent_id]

    @staticmethod
    def _apply_artifacts(request: LegalRequest, run: AgentRun) -> None:
        """Persist drafted artifacts onto the request aggregate. Drafts
        only — every artifact remains pending human review by type."""
        output = run.output
        if run.agent_id == TRIAGING_AGENT and output.get("classification"):
            request.classification = ClassificationResult.model_validate(
                output["classification"]
            )
            request.routing_recommendation = RoutingRecommendation.model_validate(
                output["routing_recommendation"]
            )
        elif run.agent_id == NOTE_TAKING_AND_DATA_ENTRY_AGENT and output.get("note_draft"):
            request.note_drafts.append(NoteDraft.model_validate(output["note_draft"]))
        elif run.agent_id == TEXT_CONTENT_AGENT and output.get("text_draft"):
            request.text_drafts.append(TextDraft.model_validate(output["text_draft"]))
            if output.get("production_package"):
                request.production_package = ProductionPackage.model_validate(
                    output["production_package"]
                )
