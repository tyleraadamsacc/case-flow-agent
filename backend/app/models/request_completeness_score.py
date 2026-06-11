from enum import StrEnum

from pydantic import Field

from app.models.base import CaseFlowModel


class CompletenessComponent(StrEnum):
    PLACEHOLDERS = "placeholders"
    IDENTIFIERS = "identifiers"
    DATE_RANGE = "date_range"
    AUTHORITY_COVERAGE = "authority_coverage"
    SPECIAL_HANDLING_REVIEW = "special_handling_review"
    PACKAGE_VALIDATION = "package_validation"
    ATTESTATIONS = "attestations"


class CompletenessStatus(StrEnum):
    COMPLETE = "complete"
    PARTIAL = "partial"
    INCOMPLETE = "incomplete"


class CompletenessComponentScore(CaseFlowModel):
    component: CompletenessComponent
    status: CompletenessStatus
    score: int = Field(ge=0, le=100)
    message: str
    evidence: list[str] = []


class RequestCompletenessScore(CaseFlowModel):
    """Deterministic review-readiness score for one legal request.

    The score is not a legal sufficiency judgment. It is an explainable
    checklist average over fields already present on the request aggregate.
    """

    legal_request_id: str
    total_score: int = Field(ge=0, le=100)
    status: CompletenessStatus
    components: list[CompletenessComponentScore]
