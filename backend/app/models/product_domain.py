from app.models.base import CaseFlowModel
from app.models.enums import Sensitivity


class ProductDomain(CaseFlowModel):
    """Taxonomy entry loaded from product_domain_taxonomy.json."""

    domain_id: str
    name: str
    description: str = ""
    default_queue: str | None = None
    sensitivity_default: Sensitivity = Sensitivity.MEDIUM
