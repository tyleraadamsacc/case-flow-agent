from typing import Literal

from app.models.base import CaseFlowModel


class RoutingRecommendation(CaseFlowModel):
    """A recommended route/escalation. Never auto-applied: the status is
    type-constrained to pending-human."""

    schema_version: str = "1.0"
    target_queue: str | None = None
    target_owner: str | None = None
    escalation_target: str | None = None
    reason: str | None = None
    sla_risk: bool = False
    requires_approval: Literal[True] = True
    evidence_ids: list[str] = []
    status: Literal["recommended_pending_human"] = "recommended_pending_human"
