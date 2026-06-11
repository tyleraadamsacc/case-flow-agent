from datetime import UTC, datetime

from pydantic import Field

from app.models.base import CaseFlowModel
from app.models.enums import AttestationItem


class Attestation(CaseFlowModel):
    """One pre-finalization check a human personally confirmed. The
    required set is computed from the approval policy; finalization is
    blocked until every required item is attested."""

    schema_version: str = "1.0"
    item: AttestationItem
    attested_by: str
    role: str = "analyst"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    audit_event_id: str | None = None
