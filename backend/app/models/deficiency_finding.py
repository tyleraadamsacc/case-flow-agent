from app.models.base import CaseFlowModel
from app.models.enums import DeficiencyCode, DeficiencySeverity


class DeficiencyFinding(CaseFlowModel):
    """One detected deficiency. Blocking severity halts finalization and
    the (PR 2) ETL/production path."""

    code: DeficiencyCode
    severity: DeficiencySeverity
    message: str
    requires_human_review: bool = True
    suggested_resolution: str | None = None
    evidence_ids: list[str] = []
