from app.models.base import CaseFlowModel


class SpecialHandlingFlags(CaseFlowModel):
    """Risk/sensitivity flags. Every true flag maps to a review trigger."""

    sealed: bool = False
    non_disclosure_to_subscriber: bool = False
    no_adverse_action: bool = False
    pen_register_requested: bool = False
    trap_and_trace_requested: bool = False
    ongoing_access_requested: bool = False
    location_tracking_requested: bool = False
    content_requested: bool = False
    tombstone_requested: bool = False
    production_deadline_days: int | None = None
    service_deadline_days: int | None = None
    nondisclosure_period: str | None = None

    def active_flags(self) -> list[str]:
        """Names of all boolean flags currently set."""
        return [
            name
            for name, value in self.model_dump().items()
            if isinstance(value, bool) and value
        ]
