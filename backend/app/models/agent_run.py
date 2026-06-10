import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.models.base import CaseFlowModel
from app.models.enums import AgentRunStatus


def _agent_run_id() -> str:
    return f"run_{uuid.uuid4().hex[:12]}"


class AgentRunDraft(CaseFlowModel):
    """The behavioral envelope an agent writes into ADK session state.

    Session state is an execution scratchpad only: the execution bridge
    converts each draft into a persisted AgentRun, which is the source of
    truth for every API and governance surface.
    """

    schema_version: str = "1.0"
    agent_id: str
    agent_name: str
    status: AgentRunStatus
    input_summary: str = ""
    output_summary: str = ""
    output: dict[str, Any] = {}
    confidence: float | None = None
    rationale: str | None = None
    evidence_ids: list[str] = []
    requires_human_review: bool = False
    review_reasons: list[str] = []
    risk_flags: list[str] = []
    blocked_reason: str | None = None
    validation_status: str = "valid"
    started_at: datetime | None = None
    completed_at: datetime | None = None
    latency_ms: float | None = None


class AgentRun(AgentRunDraft):
    """One persisted agent execution record — the single object the
    Six-Agent Workflow Rail renders.

    ``agent_name`` carries the exact official RFP display name. Every run
    (including blocked and failed runs) stores the id of the one audit
    event written for it.
    """

    agent_run_id: str = Field(default_factory=_agent_run_id)
    legal_request_id: str
    audit_event_id: str | None = None
    model_id: str | None = None
    prompt_version: str | None = None
    input_hash: str | None = None
    retry_count: int = 0
