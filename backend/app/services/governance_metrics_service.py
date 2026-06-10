"""Governance metrics, agent-activity (RFP Agent Coverage), and
work-needing-attention computations over the local repositories.

Every metric carries a mandatory data-confidence label; request-derived
counts are synthetic_mock, timing-derived values are estimated, and
audit/agent-run counts are fully_tracked.
"""

from datetime import UTC, datetime

from app.adk_agents.registry import ETL_AGENT, OFFICIAL_AGENT_NAMES, RAIL_ORDER
from app.models.agent_run import AgentRun
from app.models.base import CaseFlowModel
from app.models.enums import (
    AgentRunStatus,
    AuditAction,
    DataConfidence,
    DeficiencySeverity,
)
from app.models.governance_metric import GovernanceMetric
from app.models.workflow_state import WorkflowState
from app.orchestration.approval_policy import LOW_CONFIDENCE_THRESHOLD, ApprovalPolicy
from app.repositories.agent_run_repository import AgentRunRepository
from app.repositories.audit_repository import AuditRepository
from app.repositories.legal_request_repository import LegalRequestRepository
from app.services.audit_service import REQUIRED_EVENTS_FOR_FINALIZATION


class AgentActivity(CaseFlowModel):
    """Per-agent activity for the RFP Agent Coverage module."""

    agent_id: str
    agent_name: str
    runs_total: int = 0
    runs_completed: int = 0
    runs_blocked: int = 0
    runs_needs_review: int = 0
    runs_failed: int = 0
    audit_events: int = 0
    average_confidence: float | None = None
    requests_covered: list[str] = []
    data_confidence: DataConfidence = DataConfidence.FULLY_TRACKED


class AttentionItem(CaseFlowModel):
    legal_request_id: str
    workflow_state: WorkflowState
    reasons: list[str] = []
    priority: int = 0
    related_agent_run_ids: list[str] = []


class AuditReadinessReport(CaseFlowModel):
    requests_total: int
    requests_with_all_required_events: int
    coverage_percent: float
    missing_events_by_request: dict[str, list[str]] = {}
    finalization_blocked_events: int = 0
    data_confidence: DataConfidence = DataConfidence.FULLY_TRACKED


class GovernanceMetricsService:
    def __init__(
        self,
        legal_request_repository: LegalRequestRepository,
        audit_repository: AuditRepository,
        approval_policy: ApprovalPolicy,
        agent_run_repository: AgentRunRepository | None = None,
    ) -> None:
        self._requests = legal_request_repository
        self._audit = audit_repository
        self._policy = approval_policy
        self._agent_runs = agent_run_repository

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

    def agent_activity(self) -> list[AgentActivity]:
        """RFP Agent Coverage: all six agents by exact official name, even
        with zero runs."""
        runs_by_agent: dict[str, list[AgentRun]] = {agent_id: [] for agent_id in RAIL_ORDER}
        if self._agent_runs is not None:
            for run in self._agent_runs.list_all():
                runs_by_agent.setdefault(run.agent_id, []).append(run)
        events_by_actor: dict[str, int] = {}
        for event in self._audit.list_all():
            events_by_actor[event.actor_id] = events_by_actor.get(event.actor_id, 0) + 1

        activity = []
        for agent_id in RAIL_ORDER:
            runs = runs_by_agent[agent_id]
            confidences = [run.confidence for run in runs if run.confidence is not None]
            activity.append(
                AgentActivity(
                    agent_id=agent_id,
                    agent_name=OFFICIAL_AGENT_NAMES[agent_id],
                    runs_total=len(runs),
                    runs_completed=sum(
                        1 for r in runs if r.status == AgentRunStatus.COMPLETE
                    ),
                    runs_blocked=sum(
                        1 for r in runs if r.status == AgentRunStatus.BLOCKED
                    ),
                    runs_needs_review=sum(
                        1 for r in runs if r.status == AgentRunStatus.NEEDS_REVIEW
                    ),
                    runs_failed=sum(1 for r in runs if r.status == AgentRunStatus.FAILED),
                    audit_events=events_by_actor.get(agent_id, 0),
                    average_confidence=(
                        round(sum(confidences) / len(confidences), 3)
                        if confidences
                        else None
                    ),
                    requests_covered=sorted({run.legal_request_id for run in runs}),
                )
            )
        return activity

    def work_needing_attention(self) -> list[AttentionItem]:
        items = []
        for request in self._requests.list_all():
            if request.workflow_state == WorkflowState.AUDIT_COMPLETE:
                continue
            reasons: list[str] = []
            priority = 0

            flags = request.special_handling.active_flags()
            if flags:
                reasons.extend(f"special_handling:{flag}" for flag in flags)
                priority = max(priority, 100)
            blocking = [
                f for f in request.deficiency_findings
                if f.severity == DeficiencySeverity.BLOCKING
            ]
            if blocking:
                reasons.extend(f"blocking_deficiency:{f.code.value}" for f in blocking)
                priority = max(priority, 90)

            related_run_ids: list[str] = []
            if self._agent_runs is not None:
                latest: dict[str, AgentRun] = {}
                for run in self._agent_runs.list_for_request(request.legal_request_id):
                    latest[run.agent_id] = run
                for run in latest.values():
                    if run.status == AgentRunStatus.BLOCKED:
                        label = "etl_blocked" if run.agent_id == ETL_AGENT else (
                            f"{run.agent_id}_blocked"
                        )
                        reasons.append(f"{label}:{run.blocked_reason}")
                        related_run_ids.append(run.agent_run_id)
                        priority = max(priority, 85 if run.agent_id == ETL_AGENT else 75)

            if any(
                event.action == AuditAction.FINALIZATION_BLOCKED
                for event in self._audit.list_for_request(request.legal_request_id)
            ):
                reasons.append("audit_exception:finalization_blocked")
                priority = max(priority, 88)

            classification = request.classification
            if (
                classification is not None
                and classification.confidence < LOW_CONFIDENCE_THRESHOLD
            ):
                reasons.append("low_confidence_classification")
                priority = max(priority, 70)

            if request.production_package is not None:
                reasons.append("response_package_awaiting_approval")
                priority = max(priority, 65)

            if request.workflow_state == WorkflowState.ANALYST_REVIEW_PENDING:
                reasons.append("awaiting_human_review")
                priority = max(priority, 50)

            if reasons:
                items.append(
                    AttentionItem(
                        legal_request_id=request.legal_request_id,
                        workflow_state=request.workflow_state,
                        reasons=reasons,
                        priority=priority,
                        related_agent_run_ids=related_run_ids,
                    )
                )
        return sorted(items, key=lambda item: (-item.priority, item.legal_request_id))

    def product_volume(self) -> list[GovernanceMetric]:
        counts: dict[str, int] = {}
        for request in self._requests.list_all():
            for domain in request.product_domains:
                counts[domain] = counts.get(domain, 0) + 1
        return [
            GovernanceMetric(
                metric_id=f"product_volume:{domain}",
                title=f"Requests touching {domain}",
                value=count,
                dimension="product_domain",
                data_confidence=DataConfidence.SYNTHETIC_MOCK,
            )
            for domain, count in sorted(counts.items())
        ]

    def processing_time_by_product(self) -> list[GovernanceMetric]:
        """Average elapsed time (hours) between first and latest audit
        event, grouped by product domain. Synthetic timing → estimated."""
        elapsed_by_domain: dict[str, list[float]] = {}
        for request in self._requests.list_all():
            events = self._audit.list_for_request(request.legal_request_id)
            if len(events) < 2:
                continue
            timestamps = sorted(event.timestamp for event in events)
            hours = (timestamps[-1] - timestamps[0]).total_seconds() / 3600
            for domain in request.product_domains:
                elapsed_by_domain.setdefault(domain, []).append(hours)
        return [
            GovernanceMetric(
                metric_id=f"processing_time:{domain}",
                title=f"Average processing time for {domain}",
                value=round(sum(values) / len(values), 4),
                unit="hours",
                dimension="product_domain",
                data_confidence=DataConfidence.ESTIMATED,
            )
            for domain, values in sorted(elapsed_by_domain.items())
        ]

    def bottlenecks(self) -> list[GovernanceMetric]:
        """Average dwell time (hours since last audit event) of open
        requests, grouped by workflow state. Synthetic timing → estimated."""
        now = datetime.now(UTC)
        dwell_by_state: dict[str, list[float]] = {}
        for request in self._requests.list_all():
            if request.workflow_state == WorkflowState.AUDIT_COMPLETE:
                continue
            events = self._audit.list_for_request(request.legal_request_id)
            if not events:
                continue
            last = max(event.timestamp for event in events)
            dwell_by_state.setdefault(request.workflow_state.value, []).append(
                (now - last).total_seconds() / 3600
            )
        metrics = [
            GovernanceMetric(
                metric_id=f"bottleneck:{state}",
                title=f"Average dwell time in {state}",
                value=round(sum(values) / len(values), 4),
                unit="hours",
                dimension="workflow_state",
                data_confidence=DataConfidence.ESTIMATED,
            )
            for state, values in dwell_by_state.items()
        ]
        return sorted(metrics, key=lambda metric: -metric.value)

    def audit_readiness(self) -> AuditReadinessReport:
        requests = self._requests.list_all()
        missing_by_request: dict[str, list[str]] = {}
        for request in requests:
            present = {
                event.action
                for event in self._audit.list_for_request(request.legal_request_id)
            }
            missing = sorted(
                action.value for action in REQUIRED_EVENTS_FOR_FINALIZATION - present
            )
            if missing:
                missing_by_request[request.legal_request_id] = missing
        complete = len(requests) - len(missing_by_request)
        blocked_events = sum(
            1
            for event in self._audit.list_all()
            if event.action == AuditAction.FINALIZATION_BLOCKED
        )
        return AuditReadinessReport(
            requests_total=len(requests),
            requests_with_all_required_events=complete,
            coverage_percent=round(100 * complete / len(requests), 1) if requests else 0.0,
            missing_events_by_request=missing_by_request,
            finalization_blocked_events=blocked_events,
        )

    def response_package_status(self) -> list[GovernanceMetric]:
        requests = self._requests.list_all()
        by_status: dict[str, int] = {}
        without_package = 0
        for request in requests:
            if request.production_package is None:
                without_package += 1
            else:
                key = request.production_package.status.value
                by_status[key] = by_status.get(key, 0) + 1
        metrics = [
            GovernanceMetric(
                metric_id=f"response_package:{status}",
                title=f"Response packages in {status}",
                value=count,
                dimension="package_status",
                data_confidence=DataConfidence.FULLY_TRACKED,
            )
            for status, count in sorted(by_status.items())
        ]
        metrics.append(
            GovernanceMetric(
                metric_id="response_package:none",
                title="Requests without a drafted package",
                value=without_package,
                dimension="package_status",
                data_confidence=DataConfidence.FULLY_TRACKED,
            )
        )
        return metrics
