from datetime import date

from app.models.base import CaseFlowModel


class ChainOfCustody(CaseFlowModel):
    """Chain-of-custody block of a production package. Always drafted —
    never agent-finalized."""

    collection_date: date | None = None
    collection_method: str | None = None
    collected_by: str | None = None
    review_status: str = "draft_pending_review"
