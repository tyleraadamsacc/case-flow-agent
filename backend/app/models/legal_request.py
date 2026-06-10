from datetime import date

from app.models.agent_run import AgentRun
from app.models.approval_decision import ApprovalDecision
from app.models.base import CaseFlowModel
from app.models.deficiency_finding import DeficiencyFinding
from app.models.human_review import HumanReview
from app.models.legal_authority import LegalAuthority
from app.models.legal_process import LegalProcess
from app.models.requested_data_category import RequestedDataCategory
from app.models.requested_period import RequestedPeriod
from app.models.requesting_agency import RequestingAgency
from app.models.special_handling import SpecialHandlingFlags
from app.models.subject_identifier import SubjectIdentifier
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
    deficiency_findings: list[DeficiencyFinding] = []
    reviews: list[HumanReview] = []
    approvals: list[ApprovalDecision] = []
    agent_runs: dict[str, AgentRun] = {}
    owner: str | None = None
    urgency_tier: str | None = None
    raw_source_uri: str | None = None
    raw_source_text: str | None = None
