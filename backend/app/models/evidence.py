from pydantic import Field

from app.models.base import CaseFlowModel
from app.models.enums import EvidenceSourceType


class EvidenceReference(CaseFlowModel):
    """Grounding pointer with a stable evidence_id, referenced by agent
    outputs, audit events, and governance insights."""

    evidence_id: str
    source_type: EvidenceSourceType
    title: str
    snippet: str | None = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
