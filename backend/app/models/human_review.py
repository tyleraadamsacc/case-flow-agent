import uuid
from datetime import UTC, datetime

from pydantic import Field

from app.models.base import CaseFlowModel
from app.models.enums import ReviewAction, ReviewTargetType


def _review_id() -> str:
    return f"rev_{uuid.uuid4().hex[:12]}"


class HumanReview(CaseFlowModel):
    """One recorded human review action; edits are captured to compute
    human-override metrics."""

    schema_version: str = "1.0"
    review_id: str = Field(default_factory=_review_id)
    legal_request_id: str
    target_type: ReviewTargetType
    reviewer_id: str
    role: str = "analyst"
    action: ReviewAction
    edits: dict[str, str] = {}
    comments: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
