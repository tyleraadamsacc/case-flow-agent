from app.models.base import CaseFlowModel
from app.models.enums import LegalProcessType


class LegalProcess(CaseFlowModel):
    """The legal instrument behind a request; drives approval-policy triggers."""

    type: LegalProcessType = LegalProcessType.UNKNOWN
    court_order_included: bool = False
    ex_parte_order: bool = False
    pen_register: bool = False
    trap_and_trace: bool = False
    location_tracking: bool = False
    stored_communications: bool = False
