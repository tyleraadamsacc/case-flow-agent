from pydantic import BaseModel, ConfigDict


class CaseFlowModel(BaseModel):
    """Base for all CaseFlow domain models.

    ``extra="forbid"`` so fixture typos and contract drift fail loudly
    instead of being silently dropped.
    """

    model_config = ConfigDict(extra="forbid")
