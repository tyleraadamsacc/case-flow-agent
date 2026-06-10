from datetime import datetime
from typing import Literal

from app.models.base import CaseFlowModel


class ResponsiveRecord(CaseFlowModel):
    """One mock responsive record. ``data_confidence`` is type-constrained
    to synthetic_mock: no real records exist in this prototype."""

    record_id: str
    timestamp_utc: datetime | None = None
    latitude: float | None = None
    longitude: float | None = None
    accuracy_meters: float | None = None
    source: str | None = None
    data_confidence: Literal["synthetic_mock"] = "synthetic_mock"
