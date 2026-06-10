from app.models.base import CaseFlowModel
from app.models.enums import Sensitivity


class RequestedDataCategory(CaseFlowModel):
    """One requested data category mapped to a product/domain."""

    category: str
    product_domain: str
    sensitivity: Sensitivity = Sensitivity.MEDIUM
    content_type: str | None = None
    requires_sme_review: bool = False
