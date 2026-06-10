from app.models.base import CaseFlowModel


class LegalAuthority(CaseFlowModel):
    """A cited statute or rule, e.g. '18 U.S.C. §2703'."""

    citation: str
    description: str | None = None
    source_span: str | None = None
