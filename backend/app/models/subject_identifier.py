from pydantic import Field

from app.models.base import CaseFlowModel
from app.models.enums import IdentifierType


class SubjectIdentifier(CaseFlowModel):
    """One extracted subject identifier; source_span enables UI highlighting."""

    type: IdentifierType
    value: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    source_span: str | None = None
