import uuid
from datetime import UTC, datetime

from pydantic import Field

from app.models.base import CaseFlowModel
from app.models.enums import ApprovalDecisionType, ReviewReason, ReviewTargetType


def _approval_id() -> str:
    return f"appr_{uuid.uuid4().hex[:12]}"


class ApprovalDecision(CaseFlowModel):
    """The result of a human approval gate. Required before any
    'approved' workflow state."""

    schema_version: str = "1.0"
    approval_id: str = Field(default_factory=_approval_id)
    legal_request_id: str
    target_type: ReviewTargetType
    decision: ApprovalDecisionType
    decided_by: str
    # Reviewer role at decision time; dual control needs to know whether a
    # senior co-signer is among the approvers.
    role: str = "analyst"
    policy_reasons: list[ReviewReason] = []
    comments: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    audit_event_id: str | None = None
