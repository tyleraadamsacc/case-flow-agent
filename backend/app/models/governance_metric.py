from app.models.base import CaseFlowModel
from app.models.enums import DataConfidence


class GovernanceMetric(CaseFlowModel):
    """One computed governance metric. The data-confidence label is
    mandatory (plan §14)."""

    schema_version: str = "1.0"
    metric_id: str
    title: str
    value: float
    unit: str = "count"
    dimension: str | None = None
    period: str | None = None
    data_confidence: DataConfidence
    evidence_ids: list[str] = []
