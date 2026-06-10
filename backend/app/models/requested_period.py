from datetime import datetime

from app.models.base import CaseFlowModel


class RequestedPeriod(CaseFlowModel):
    """Date range under request. ``valid`` and ``issues`` are computed
    during extraction/validation."""

    start: datetime | None = None
    end: datetime | None = None
    valid: bool = False
    issues: list[str] = []
