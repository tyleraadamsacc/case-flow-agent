import uuid
from datetime import UTC, datetime

from pydantic import Field

from app.models.base import CaseFlowModel
from app.models.enums import OverrideTarget


def _override_id() -> str:
    return f"ovr_{uuid.uuid4().hex[:12]}"


class HumanOverride(CaseFlowModel):
    """A human correction of an agent-produced field, recorded with the
    before/after values and the reviewer who made it. Overrides feed the
    human-override governance metric and may clear deficiencies that the
    corrected field had triggered."""

    schema_version: str = "1.0"
    override_id: str = Field(default_factory=_override_id)
    legal_request_id: str
    target: OverrideTarget
    field_path: str
    before_value: str
    after_value: str
    reason: str
    overridden_by: str
    role: str = "analyst"
    cleared_deficiencies: list[str] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    audit_event_id: str | None = None
