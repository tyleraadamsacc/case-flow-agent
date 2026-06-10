from typing import Literal

from app.models.base import CaseFlowModel


class Certification(CaseFlowModel):
    """Production certification block. The status is type-constrained so
    an agent literally cannot emit a final certification."""

    authorized_representative: str | None = None
    title: str | None = None
    certification_text: str | None = None
    status: Literal["draft_pending_approval"] = "draft_pending_approval"
