"""Human review, approval, escalation, and internal QA handoff.

Finalization is structurally human-only: this approve endpoint is the
single path to analyst_approved / audit_complete. Blocking deficiencies
and missing audit events both block finalization with a
finalization_blocked audit event.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Container, CurrentActor, get_container, get_current_actor
from app.api.schemas import (
    ActionResponse,
    ApproveBody,
    ApproveResponse,
    AttestBody,
    AttestResponse,
    EscalateBody,
    FinalizationStatus,
    OverrideBody,
    OverrideResponse,
    ReviewBody,
    ReviewResponse,
    SendToQaBody,
)
from app.errors import FinalizationBlockedError, NotFoundError
from app.models.approval_decision import ApprovalDecision
from app.models.attestation import Attestation
from app.models.audit_event import AuditEvent
from app.models.enums import (
    ActorType,
    AgentRunStatus,
    ApprovalDecisionType,
    AuditAction,
    ReviewAction,
    Role,
)
from app.models.human_override import HumanOverride
from app.models.human_review import HumanReview
from app.models.legal_request import LegalRequest
from app.models.workflow_state import WorkflowState
from app.orchestration.authz import require_role
from app.services.audit_service import REQUIRED_EVENTS_FOR_FINALIZATION

router = APIRouter(prefix="/api/legal-requests", tags=["review"])


def _load(container: Container, legal_request_id: str) -> LegalRequest:
    request = container.legal_request_repository.get(legal_request_id)
    if request is None:
        raise NotFoundError("legal_request", legal_request_id)
    return request


def _refresh_package_validation(container: Container, request: LegalRequest) -> None:
    if request.production_package is None:
        request.package_validation_findings = []
        return
    findings = container.response_package_service.validate_package(
        request.production_package
    )
    request.production_package.validation_findings = findings
    request.package_validation_findings = findings


@router.post("/{legal_request_id}/review")
def review(
    legal_request_id: str,
    body: ReviewBody,
    container: Container = Depends(get_container),
    actor: CurrentActor = Depends(get_current_actor),
) -> ReviewResponse:
    if body.action not in (ReviewAction.APPROVE, ReviewAction.REQUEST_CHANGES):
        raise HTTPException(
            status_code=422,
            detail="Use the dedicated /escalate and /send-to-qa endpoints for those actions.",
        )
    request = _load(container, legal_request_id)
    before = request.workflow_state
    if body.action == ReviewAction.REQUEST_CHANGES:
        before = container.state_machine.transition(request, WorkflowState.CHANGES_REQUESTED)
    elif request.workflow_state != WorkflowState.ANALYST_REVIEW_PENDING:
        # An approving review only makes sense while review is pending.
        container.state_machine.assert_can_transition(
            request.workflow_state, WorkflowState.ANALYST_APPROVED
        )

    human_review = HumanReview(
        legal_request_id=legal_request_id,
        target_type=body.target_type,
        reviewer_id=actor.actor_id,
        role=actor.role,
        action=body.action,
        edits=body.edits,
        comments=body.comments,
    )
    request.reviews.append(human_review)

    event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.HUMAN,
        actor_id=actor.actor_id,
        action=AuditAction.ANALYST_REVIEWED,
        before_state=before,
        after_state=request.workflow_state,
        summary=(
            f"Analyst review recorded: {body.action.value} on {body.target_type.value}"
            f"{' with edits' if body.edits else ''}."
        ),
    )
    container.legal_request_repository.save(request)
    return ReviewResponse(legal_request=request, review=human_review, audit_event=event)


@router.get("/{legal_request_id}/finalization-status")
def finalization_status(
    legal_request_id: str, container: Container = Depends(get_container)
) -> FinalizationStatus:
    """The human-review surface's single source of truth for finalization
    readiness: the attestation checklist, the dual-control count, and any
    remaining blockers (theme B + E). Read-only."""
    request = _load(container, legal_request_id)
    _refresh_package_validation(container, request)
    policy = container.approval_policy.evaluate(request)
    required = container.approval_policy.required_attestations(request)
    attested = [a.item for a in request.attestations]
    attested_set = set(attested)
    missing = [item for item in required if item not in attested_set]

    latest_runs: dict[str, object] = {}
    for run in container.agent_run_repository.list_for_request(legal_request_id):
        latest_runs[run.agent_id] = run
    blocked_agents = sorted(
        run.agent_name
        for run in latest_runs.values()
        if run.status in (AgentRunStatus.BLOCKED, AgentRunStatus.FAILED)
    )
    approved = [a for a in request.approvals if a.decision == ApprovalDecisionType.APPROVED]
    senior_present = any(a.role == Role.SENIOR_ANALYST.value for a in approved)

    blocking = list(policy.blocking_reasons)
    if blocked_agents:
        blocking.append("blocked_agent_runs: " + ", ".join(blocked_agents))
    if missing:
        blocking.append(
            "missing_attestations: " + ", ".join(item.value for item in missing)
        )
    return FinalizationStatus(
        workflow_state=request.workflow_state.value,
        required_attestations=required,
        attested=attested,
        missing_attestations=missing,
        approvals_recorded=len({a.decided_by for a in approved}),
        approvals_required=policy.required_approvals,
        requires_senior_approval=policy.requires_senior_approval,
        senior_approval_present=senior_present,
        blocked_agent_runs=blocked_agents,
        blocking_reasons=blocking,
        ready_for_approval=not blocking,
    )


@router.post("/{legal_request_id}/approve")
def approve(
    legal_request_id: str,
    body: ApproveBody,
    container: Container = Depends(get_container),
    actor: CurrentActor = Depends(get_current_actor),
) -> ApproveResponse:
    request = _load(container, legal_request_id)
    _refresh_package_validation(container, request)
    container.state_machine.assert_can_transition(
        request.workflow_state, WorkflowState.ANALYST_APPROVED
    )

    policy = container.approval_policy.evaluate(request)

    # Gate 1 — unfinished agent work: a blocked or failed latest agent run
    # must be resolved (approve the route and re-run, or request changes)
    # before finalization.
    latest_runs: dict[str, object] = {}
    for run in container.agent_run_repository.list_for_request(legal_request_id):
        latest_runs[run.agent_id] = run
    blocked_agents = [
        run.agent_name
        for run in latest_runs.values()
        if run.status in (AgentRunStatus.BLOCKED, AgentRunStatus.FAILED)
    ]

    # Gate 2 — pre-finalization attestations (theme E): every required check
    # must be confirmed by a human before any approval is recorded.
    required_attestations = container.approval_policy.required_attestations(request)
    attested = {item.value for item in (a.item for a in request.attestations)}
    missing_attestations = [
        item.value for item in required_attestations if item.value not in attested
    ]

    blocking = list(policy.blocking_reasons)
    if blocked_agents:
        blocking.append("blocked_agent_runs: " + ", ".join(sorted(blocked_agents)))
    if missing_attestations:
        blocking.append("missing_attestations: " + ", ".join(missing_attestations))
    if blocking:
        container.audit_service.record(
            legal_request_id=legal_request_id,
            actor_type=ActorType.SERVICE,
            actor_id="approval_policy",
            action=AuditAction.FINALIZATION_BLOCKED,
            before_state=request.workflow_state,
            after_state=request.workflow_state,
            summary=("Approval refused — blocking reasons: " f"{', '.join(blocking)}."),
        )
        raise FinalizationBlockedError(legal_request_id, blocking)

    # Dual control (theme B): a high-sensitivity request needs two distinct
    # human approvers, at least one senior. The same actor cannot approve
    # twice, and the approval that meets the count finalizes.
    prior = [a for a in request.approvals if a.decision == ApprovalDecisionType.APPROVED]
    prior_approvers = {a.decided_by for a in prior}
    if actor.actor_id in prior_approvers:
        raise HTTPException(
            status_code=409,
            detail=(
                "You have already approved this request. A different reviewer "
                "must provide the remaining approval."
            ),
        )
    required = policy.required_approvals
    distinct_after = len(prior_approvers) + 1
    would_finalize = distinct_after >= required
    senior_present = actor.role == Role.SENIOR_ANALYST or any(
        a.role == Role.SENIOR_ANALYST.value for a in prior
    )
    if would_finalize and policy.requires_senior_approval and not senior_present:
        require_role(
            actor.role,
            {Role.SENIOR_ANALYST},
            "provide the finalizing approval for a high-sensitivity request "
            "without a senior co-signer",
        )

    decision = ApprovalDecision(
        legal_request_id=legal_request_id,
        target_type=body.target_type,
        decision=ApprovalDecisionType.APPROVED,
        decided_by=actor.actor_id,
        role=actor.role,
        policy_reasons=policy.review_reasons,
        comments=body.comments,
    )
    events: list[AuditEvent] = []

    if not would_finalize:
        # Interim approval: stay pending, await the co-signer.
        interim_event = container.audit_service.record(
            legal_request_id=legal_request_id,
            actor_type=ActorType.HUMAN,
            actor_id=actor.actor_id,
            action=AuditAction.ROUTE_APPROVED,
            before_state=request.workflow_state,
            after_state=request.workflow_state,
            summary=(
                f"Approval {distinct_after} of {required} recorded for "
                f"{body.target_type.value}; awaiting an additional reviewer"
                + (
                    " (a senior analyst must co-sign)"
                    if policy.requires_senior_approval and not senior_present
                    else ""
                )
                + "."
            ),
            approval_id=decision.approval_id,
        )
        events.append(interim_event)
        decision.audit_event_id = interim_event.audit_event_id
        request.approvals.append(decision)
        container.legal_request_repository.save(request)
        return ApproveResponse(
            legal_request=request,
            approval_decision=decision,
            finalized=False,
            audit_events=events,
            approvals_recorded=distinct_after,
            approvals_required=required,
            awaiting_approval=True,
        )

    before = container.state_machine.transition(request, WorkflowState.ANALYST_APPROVED)
    cosign_note = (
        f" ({distinct_after} of {required} approvals; dual control satisfied)"
        if required > 1
        else ""
    )
    approve_event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.HUMAN,
        actor_id=actor.actor_id,
        action=AuditAction.ROUTE_APPROVED,
        before_state=before,
        after_state=request.workflow_state,
        summary=f"Human approval recorded for {body.target_type.value}{cosign_note}.",
        approval_id=decision.approval_id,
    )
    events.append(approve_event)
    decision.audit_event_id = approve_event.audit_event_id
    request.approvals.append(decision)

    missing = container.audit_service.missing_actions(
        legal_request_id, REQUIRED_EVENTS_FOR_FINALIZATION
    )
    finalized = not missing
    if finalized:
        before_final = container.state_machine.transition(
            request, WorkflowState.AUDIT_COMPLETE
        )
        events.append(
            container.audit_service.record(
                legal_request_id=legal_request_id,
                actor_type=ActorType.SYSTEM,
                actor_id="audit_completeness_check",
                action=AuditAction.AUDIT_COMPLETED,
                before_state=before_final,
                after_state=request.workflow_state,
                summary="All required audit events present; audit trail complete.",
                approval_id=decision.approval_id,
            )
        )
    else:
        events.append(
            container.audit_service.record(
                legal_request_id=legal_request_id,
                actor_type=ActorType.SERVICE,
                actor_id="audit_completeness_check",
                action=AuditAction.FINALIZATION_BLOCKED,
                before_state=request.workflow_state,
                after_state=request.workflow_state,
                summary=f"Finalization blocked — missing audit events: {', '.join(missing)}.",
            )
        )

    container.legal_request_repository.save(request)
    return ApproveResponse(
        legal_request=request,
        approval_decision=decision,
        finalized=finalized,
        audit_events=events,
        approvals_recorded=distinct_after,
        approvals_required=required,
        awaiting_approval=False,
    )


@router.post("/{legal_request_id}/override")
def override_field(
    legal_request_id: str,
    body: OverrideBody,
    container: Container = Depends(get_container),
    actor: CurrentActor = Depends(get_current_actor),
) -> OverrideResponse:
    """Record a human correction of an agent-produced field (theme A).

    The corrected value replaces the agent's, the change is audited as a
    human override, and deficiency detection re-runs — so fixing the date
    range or the legal-process type can clear a blocking deficiency.
    """
    request = _load(container, legal_request_id)
    result = container.override_service.apply(
        request,
        body.target,
        text_value=body.text_value,
        period_start=body.period_start,
        period_end=body.period_end,
    )
    cleared_note = (
        f" Cleared deficiency: {', '.join(result.cleared_deficiencies)}."
        if result.cleared_deficiencies
        else ""
    )
    event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.HUMAN,
        actor_id=actor.actor_id,
        action=AuditAction.HUMAN_OVERRIDE_APPLIED,
        before_state=request.workflow_state,
        after_state=request.workflow_state,
        summary=(
            f"Human override of {body.target.value}: "
            f"'{result.before}' -> '{result.after}'.{cleared_note}"
        ),
    )
    override = HumanOverride(
        legal_request_id=legal_request_id,
        target=body.target,
        field_path=body.target.value,
        before_value=result.before,
        after_value=result.after,
        reason=body.reason,
        overridden_by=actor.actor_id,
        role=actor.role,
        cleared_deficiencies=result.cleared_deficiencies,
        audit_event_id=event.audit_event_id,
    )
    request.human_overrides.append(override)
    container.legal_request_repository.save(request)
    return OverrideResponse(legal_request=request, override=override, audit_event=event)


@router.post("/{legal_request_id}/attest")
def attest(
    legal_request_id: str,
    body: AttestBody,
    container: Container = Depends(get_container),
    actor: CurrentActor = Depends(get_current_actor),
) -> AttestResponse:
    """Record one pre-finalization attestation (theme E). Finalization is
    blocked until every required item is attested."""
    request = _load(container, legal_request_id)
    _refresh_package_validation(container, request)
    required = container.approval_policy.required_attestations(request)
    if body.item not in required:
        raise HTTPException(
            status_code=422,
            detail=f"Attestation '{body.item.value}' is not required for this request.",
        )
    if any(existing.item == body.item for existing in request.attestations):
        raise HTTPException(
            status_code=409,
            detail=f"Attestation '{body.item.value}' is already recorded.",
        )
    event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.HUMAN,
        actor_id=actor.actor_id,
        action=AuditAction.ATTESTATION_RECORDED,
        before_state=request.workflow_state,
        after_state=request.workflow_state,
        summary=f"Attestation recorded: {body.item.value}.",
    )
    attestation = Attestation(
        item=body.item,
        attested_by=actor.actor_id,
        role=actor.role,
        audit_event_id=event.audit_event_id,
    )
    request.attestations.append(attestation)
    attested = {existing.item for existing in request.attestations}
    satisfied = all(item in attested for item in required)
    container.legal_request_repository.save(request)
    return AttestResponse(
        legal_request=request,
        attestation=attestation,
        audit_event=event,
        required_attestations=required,
        satisfied=satisfied,
    )


@router.post("/{legal_request_id}/escalate")
def escalate(
    legal_request_id: str,
    body: EscalateBody,
    container: Container = Depends(get_container),
    actor: CurrentActor = Depends(get_current_actor),
) -> ActionResponse:
    request = _load(container, legal_request_id)
    before = container.state_machine.transition(request, WorkflowState.ESCALATED)
    event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.HUMAN,
        actor_id=actor.actor_id,
        action=AuditAction.REQUEST_ESCALATED,
        before_state=before,
        after_state=request.workflow_state,
        summary=f"Escalated to {body.target}: {body.reason}",
    )
    container.legal_request_repository.save(request)
    return ActionResponse(legal_request=request, audit_event=event)


@router.post("/{legal_request_id}/send-to-qa")
def send_to_qa(
    legal_request_id: str,
    body: SendToQaBody,
    container: Container = Depends(get_container),
    actor: CurrentActor = Depends(get_current_actor),
) -> ActionResponse:
    request = _load(container, legal_request_id)
    before = container.state_machine.transition(request, WorkflowState.SENT_TO_QA)
    event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.HUMAN,
        actor_id=actor.actor_id,
        action=AuditAction.SENT_TO_QA,
        before_state=before,
        after_state=request.workflow_state,
        summary=(
            "Internal QA handoff only — nothing is sent or released externally."
            + (f" Reason: {body.reason}" if body.reason else "")
        ),
    )
    container.legal_request_repository.save(request)
    return ActionResponse(legal_request=request, audit_event=event)
