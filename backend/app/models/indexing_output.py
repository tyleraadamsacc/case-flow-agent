from pydantic import Field

from app.models.base import CaseFlowModel


class IndexingOutput(CaseFlowModel):
    """Indexing Agent output payload: labels, domains, priority, and SOP
    matches (stable evidence ids) for the request."""

    schema_version: str = "1.0"
    primary_labels: list[str] = []
    product_domains: list[str] = []
    legal_process_tags: list[str] = []
    priority_rank: int = Field(default=3, ge=1, le=3)
    sop_matches: list[str] = []
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
