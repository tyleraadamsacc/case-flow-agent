"""Typed request/response contracts for the API surface."""

from typing import Literal

from datetime import date

from app.models.agent_run import AgentRun
from app.models.agent_run_review import AgentRunReview
from app.models.approval_decision import ApprovalDecision
from app.models.attestation import Attestation
from app.models.audit_event import AuditEvent
from app.models.base import CaseFlowModel
from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import (
    AttestationItem,
    OverrideTarget,
    ReviewAction,
    ReviewTargetType,
)
from app.models.governance_metric import GovernanceMetric
from app.models.human_override import HumanOverride
from app.models.human_review import HumanReview
from app.models.legal_request import LegalRequest
from app.models.production_package import ProductionPackage
from app.models.request_completeness_score import RequestCompletenessScore
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


class CompletenessScoreResponse(CaseFlowModel):
    score: RequestCompletenessScore


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
    # Dual-control surface (theme B): how many distinct human approvals
    # have been recorded vs. required, and whether a co-signer is still
    # awaited. For single-approval requests, required == 1 and awaiting
    # is false once approved.
    approvals_recorded: int = 1
    approvals_required: int = 1
    awaiting_approval: bool = False


class OverrideBody(CaseFlowModel):
    """A bounded human correction of an agent-produced field (theme A)."""

    target: OverrideTarget
    reason: str
    text_value: str | None = None
    period_start: date | None = None
    period_end: date | None = None


class OverrideResponse(CaseFlowModel):
    legal_request: LegalRequest
    override: HumanOverride
    audit_event: AuditEvent


class AgentRerunBody(CaseFlowModel):
    """Send one agent's output back with an instruction and re-run just
    that agent (theme C). An empty instruction is a plain re-run."""

    instruction: str | None = None


class AgentRunReviewResponse(CaseFlowModel):
    legal_request: LegalRequest
    agent_run: AgentRun | None = None
    agent_run_review: AgentRunReview
    audit_event: AuditEvent


class AgentAcceptBody(CaseFlowModel):
    comments: str | None = None


class AttestBody(CaseFlowModel):
    item: AttestationItem


class AttestResponse(CaseFlowModel):
    legal_request: LegalRequest
    attestation: Attestation
    audit_event: AuditEvent
    required_attestations: list[AttestationItem]
    satisfied: bool


class FinalizationStatus(CaseFlowModel):
    """Everything the human-review surface needs to know about whether a
    request can be finalized: the attestation checklist, the dual-control
    count, and any remaining blockers. Read-only — computing it changes
    nothing."""

    workflow_state: str
    required_attestations: list[AttestationItem]
    attested: list[AttestationItem]
    missing_attestations: list[AttestationItem]
    approvals_recorded: int
    approvals_required: int
    requires_senior_approval: bool
    senior_approval_present: bool
    blocked_agent_runs: list[str]
    blocking_reasons: list[str]
    ready_for_approval: bool


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
