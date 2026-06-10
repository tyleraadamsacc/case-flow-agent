from pydantic import Field

from app.models.base import CaseFlowModel
from app.models.enums import LegalProcessType, ReviewReason, Sensitivity


class ClassificationResult(CaseFlowModel):
    """Triaging Agent output payload (produced in PR 2; modeled now)."""

    schema_version: str = "1.0"
    legal_process_type: LegalProcessType
    request_category: str
    product_domains: list[str] = []
    urgency_tier: str | None = None
    sensitivity: Sensitivity = Sensitivity.MEDIUM
    recommended_queue: str | None = None
    complexity: str | None = None
    missing_fields: list[str] = []
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    human_review_required: bool = True
    review_reasons: list[ReviewReason] = []
    rationale: str | None = None
    evidence_ids: list[str] = []
