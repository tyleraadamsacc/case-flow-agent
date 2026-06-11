from datetime import date

from app.models.agent_run import AgentRun
from app.models.agent_run_review import AgentRunReview
from app.models.approval_decision import ApprovalDecision
from app.models.attestation import Attestation
from app.models.base import CaseFlowModel
from app.models.classification_result import ClassificationResult
from app.models.deficiency_finding import DeficiencyFinding
from app.models.human_override import HumanOverride
from app.models.human_review import HumanReview
from app.models.legal_authority import LegalAuthority
from app.models.legal_process import LegalProcess
from app.models.lers_quality import (
    PackageValidationFinding,
    ScopeAuthorityCheck,
    SourceDocumentSection,
)
from app.models.note_draft import NoteDraft
from app.models.production_package import ProductionPackage
from app.models.requested_data_category import RequestedDataCategory
from app.models.requested_period import RequestedPeriod
from app.models.requesting_agency import RequestingAgency
from app.models.routing_recommendation import RoutingRecommendation
from app.models.special_handling import SpecialHandlingFlags
from app.models.subject_identifier import SubjectIdentifier
from app.models.text_draft import TextDraft
from app.models.workflow_state import WorkflowState


class LegalRequest(CaseFlowModel):
    """Root aggregate for one LERS-style legal request (synthetic only).

    Persisted via the legal request repository — the source of truth for
    workflow state. ``agent_runs`` (latest run per agent, keyed by agent
    id) is hydrated from the agent-run repository at the API boundary;
    the agent-run repository remains the source of truth for runs.
    """

    schema_version: str = "1.0"
    legal_request_id: str
    source_type: str = "lers_request_template"
    date_received: date | None = None
    workflow_state: WorkflowState = WorkflowState.REQUEST_RECEIVED
    requesting_agency: RequestingAgency | None = None
    legal_process: LegalProcess | None = None
    subject_identifiers: list[SubjectIdentifier] = []
    requested_data_categories: list[RequestedDataCategory] = []
    product_domains: list[str] = []
    requested_period: RequestedPeriod | None = None
    special_handling: SpecialHandlingFlags = SpecialHandlingFlags()
    legal_authorities: list[LegalAuthority] = []
    source_sections: list[SourceDocumentSection] = []
    scope_authority_checks: list[ScopeAuthorityCheck] = []
    package_validation_findings: list[PackageValidationFinding] = []
    deficiency_findings: list[DeficiencyFinding] = []
    reviews: list[HumanReview] = []
    approvals: list[ApprovalDecision] = []
    # Human-in-the-lead records (drafts/corrections by people, all audited).
    human_overrides: list[HumanOverride] = []
    agent_run_reviews: list[AgentRunReview] = []
    attestations: list[Attestation] = []
    agent_runs: dict[str, AgentRun] = {}
    # Drafted artifacts persisted by the execution bridge / drafting
    # endpoints. All are drafts pending human review by construction.
    classification: ClassificationResult | None = None
    routing_recommendation: RoutingRecommendation | None = None
    note_drafts: list[NoteDraft] = []
    text_drafts: list[TextDraft] = []
    production_package: ProductionPackage | None = None
    owner: str | None = None
    urgency_tier: str | None = None
    raw_source_uri: str | None = None
    raw_source_text: str | None = None
