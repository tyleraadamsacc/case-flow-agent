from pydantic import model_validator

from app.models.base import CaseFlowModel
from app.models.enums import LegalProcessType


class LegalProcess(CaseFlowModel):
    """The legal instrument behind a request; drives approval-policy triggers."""

    type: LegalProcessType = LegalProcessType.UNKNOWN
    components: list[LegalProcessType] = []
    court_order_included: bool = False
    ex_parte_order: bool = False
    pen_register: bool = False
    trap_and_trace: bool = False
    location_tracking: bool = False
    stored_communications: bool = False

    @model_validator(mode="after")
    def populate_components(self) -> "LegalProcess":
        """Keep compound LERS instruments visible as first-class components."""
        components = list(self.components)
        if self.type != LegalProcessType.UNKNOWN and self.type not in components:
            components.append(self.type)
        flag_components = [
            (self.court_order_included, LegalProcessType.COURT_ORDER),
            (self.ex_parte_order, LegalProcessType.EX_PARTE_ORDER),
            (self.pen_register, LegalProcessType.PEN_REGISTER),
            (self.trap_and_trace, LegalProcessType.TRAP_AND_TRACE),
            (self.location_tracking, LegalProcessType.LOCATION_TRACKING),
        ]
        for is_set, component in flag_components:
            if is_set and component not in components:
                components.append(component)
        self.components = components
        return self
