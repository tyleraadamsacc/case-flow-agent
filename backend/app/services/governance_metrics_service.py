"""Minimal PR 1 governance summary. Product-volume, bottleneck,
agent-activity, and response-package analytics arrive in later PRs."""

from app.models.enums import DataConfidence
from app.models.governance_metric import GovernanceMetric
from app.models.workflow_state import WorkflowState
from app.orchestration.approval_policy import ApprovalPolicy
from app.repositories.audit_repository import AuditRepository
from app.repositories.legal_request_repository import LegalRequestRepository


class GovernanceMetricsService:
    def __init__(
        self,
        legal_request_repository: LegalRequestRepository,
        audit_repository: AuditRepository,
        approval_policy: ApprovalPolicy,
    ) -> None:
        self._requests = legal_request_repository
        self._audit = audit_repository
        self._policy = approval_policy

    def summary(self) -> list[GovernanceMetric]:
        requests = self._requests.list_all()

        def metric(
            metric_id: str, title: str, value: float, confidence: DataConfidence
        ) -> GovernanceMetric:
            return GovernanceMetric(
                metric_id=metric_id, title=title, value=value, data_confidence=confidence
            )

        synthetic = DataConfidence.SYNTHETIC_MOCK
        return [
            metric("total_requests", "Total requests", len(requests), synthetic),
            metric(
                "open_requests",
                "Open requests",
                sum(1 for r in requests if r.workflow_state != WorkflowState.AUDIT_COMPLETE),
                synthetic,
            ),
            metric(
                "requests_with_deficiencies",
                "Requests with deficiencies",
                sum(1 for r in requests if r.deficiency_findings),
                synthetic,
            ),
            metric(
                "requests_requiring_human_review",
                "Requests requiring human review",
                sum(
                    1 for r in requests if self._policy.evaluate(r).human_review_required
                ),
                synthetic,
            ),
            metric(
                "special_handling_requests",
                "Requests with special handling flags",
                sum(1 for r in requests if r.special_handling.active_flags()),
                synthetic,
            ),
            metric(
                "escalated_requests",
                "Escalated requests",
                sum(1 for r in requests if r.workflow_state == WorkflowState.ESCALATED),
                synthetic,
            ),
            metric(
                "audit_events",
                "Audit events recorded",
                self._audit.count(),
                DataConfidence.FULLY_TRACKED,
            ),
        ]
