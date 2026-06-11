import uuid
from datetime import UTC, datetime

from pydantic import Field

from app.models.base import CaseFlowModel
from app.models.enums import AgentRunDecision


def _review_id() -> str:
    return f"arr_{uuid.uuid4().hex[:12]}"


class AgentRunReview(CaseFlowModel):
    """A human's verdict on one agent's output: accept it, or send it back
    with an instruction for a targeted re-run. The human stays in the lead
    over each agent rather than only over the final package."""

    schema_version: str = "1.0"
    review_id: str = Field(default_factory=_review_id)
    legal_request_id: str
    agent_id: str
    agent_run_id: str | None = None
    decision: AgentRunDecision
    instruction: str | None = None
    reviewed_by: str
    role: str = "analyst"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    audit_event_id: str | None = None
