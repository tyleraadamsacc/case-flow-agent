from typing import Literal

from app.models.base import CaseFlowModel


class AutomationOutput(CaseFlowModel):
    """Automation Agent output payload: a prepared — never executed —
    next workflow action. The status is type-constrained so the agent
    literally cannot emit an executed/approved action."""

    schema_version: str = "1.0"
    action_type: str
    target: str
    target_owner: str | None = None
    reason: str
    requires_approval: Literal[True] = True
    status: Literal["prepared_pending_human"] = "prepared_pending_human"
    follow_up_tasks: list[str] = []
    sla_risk: bool = False
