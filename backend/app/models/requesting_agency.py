from app.models.base import CaseFlowModel


class RequestingAgency(CaseFlowModel):
    """The requesting law-enforcement agency. Synthetic values only."""

    agency: str | None = None
    case_number: str | None = None
    officer: str | None = None
    contact_email: str | None = None
    phone: str | None = None
    address: str | None = None
