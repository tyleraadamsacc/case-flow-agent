"""Typed request/response contracts for the PR 1 API surface."""

from datetime import date

from app.models.approval_decision import ApprovalDecision
from app.models.audit_event import AuditEvent
from app.models.base import CaseFlowModel
from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import ReviewAction, ReviewTargetType
from app.models.governance_metric import GovernanceMetric
from app.models.human_review import HumanReview
from app.models.legal_request import LegalRequest
from app.orchestration.approval_policy import ApprovalPolicyResult
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
