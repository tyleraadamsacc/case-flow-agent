"""Typed request/response contracts for the API surface."""

from typing import Literal

from datetime import date

from app.models.agent_run import AgentRun
from app.models.approval_decision import ApprovalDecision
from app.models.audit_event import AuditEvent
from app.models.base import CaseFlowModel
from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import ReviewAction, ReviewTargetType
from app.models.governance_metric import GovernanceMetric
from app.models.human_review import HumanReview
from app.models.legal_request import LegalRequest
from app.models.production_package import ProductionPackage
from app.models.text_draft import TextDraft
from app.orchestration.approval_policy import ApprovalPolicyResult
from app.services.governance_metrics_service import AgentActivity, AttentionItem
from app.services.sensitive_special_handling_service import SpecialHandlingCheck


class LegalRequestCreate(CaseFlowModel):
    legal_request_id: str | None = None
    source_type: str = "lers_request_template"
    date_received: date | None = None
    raw_source_uri: str | None = None
    raw_source_text: str | None = None


class ExtractResponse(CaseFlowModel):
    legal_request: LegalRequest
    deficiency_findings: list[DeficiencyFinding]
    audit_event: AuditEvent


class ValidateResponse(CaseFlowModel):
    legal_request: LegalRequest
    deficiency_findings: list[DeficiencyFinding]
    special_handling: SpecialHandlingCheck
    approval_policy: ApprovalPolicyResult
    audit_event: AuditEvent


class ReviewBody(CaseFlowModel):
    target_type: ReviewTargetType = ReviewTargetType.ROUTE
    action: ReviewAction
    comments: str | None = None
    edits: dict[str, str] = {}


class ReviewResponse(CaseFlowModel):
    legal_request: LegalRequest
    review: HumanReview
    audit_event: AuditEvent


class ApproveBody(CaseFlowModel):
    target_type: ReviewTargetType = ReviewTargetType.ROUTE
    comments: str | None = None


class ApproveResponse(CaseFlowModel):
    legal_request: LegalRequest
    approval_decision: ApprovalDecision
    finalized: bool
    audit_events: list[AuditEvent]


class EscalateBody(CaseFlowModel):
    reason: str
    target: str = "SME Review"


class SendToQaBody(CaseFlowModel):
    reason: str | None = None


class ActionResponse(CaseFlowModel):
    legal_request: LegalRequest
    audit_event: AuditEvent


class GovernanceSummaryResponse(CaseFlowModel):
    metrics: list[GovernanceMetric]


class AgentActivityResponse(CaseFlowModel):
    """RFP Agent Coverage: all six agents by exact official name."""

    agents: list[AgentActivity]


class WorkNeedingAttentionResponse(CaseFlowModel):
    items: list[AttentionItem]


class RailRunResponse(CaseFlowModel):
    """Six AgentRuns in rail order, served from the repository."""

    legal_request: LegalRequest
    agent_runs: list[AgentRun]


class DraftRunResponse(CaseFlowModel):
    """A single drafting run. Human approval is structurally required:
    no draft produced by any agent carries a final status."""

    agent_run: AgentRun
    text_draft: TextDraft | None = None
    production_package: ProductionPackage | None = None
    requires_human_approval: Literal[True] = True
    risk_flags: list[str] = []
    audit_event_id: str | None = None
