import uuid
from datetime import UTC, datetime

from pydantic import Field

from app.models.base import CaseFlowModel
from app.models.enums import ActorType, AuditAction
from app.models.workflow_state import WorkflowState


def _audit_event_id() -> str:
    return f"audit_{uuid.uuid4().hex[:12]}"


class AuditEvent(CaseFlowModel):
    """One immutable audit record. Written through the single
    AuditService path; the repository is append-only."""

    schema_version: str = "1.0"
    audit_event_id: str = Field(default_factory=_audit_event_id)
    legal_request_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    actor_type: ActorType
    actor_id: str
    action: AuditAction
    before_state: WorkflowState | None = None
    after_state: WorkflowState | None = None
    summary: str = ""
    evidence_ids: list[str] = []
    confidence: float | None = None
    approval_id: str | None = None
    correlation_id: str | None = None
