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
    EscalateBody,
    ReviewBody,
    ReviewResponse,
    SendToQaBody,
)
from app.errors import FinalizationBlockedError, NotFoundError
from app.models.approval_decision import ApprovalDecision
from app.models.audit_event import AuditEvent
from app.models.enums import (
    ActorType,
    ApprovalDecisionType,
    AuditAction,
    ReviewAction,
)
from app.models.human_review import HumanReview
from app.models.legal_request import LegalRequest
from app.models.workflow_state import WorkflowState

router = APIRouter(prefix="/api/legal-requests", tags=["review"])

# Audit events that must exist before a request may reach audit_complete.
REQUIRED_EVENTS_FOR_FINALIZATION: set[AuditAction] = {
    AuditAction.REQUEST_INGESTED,
    AuditAction.REQUEST_EXTRACTED,
    AuditAction.SPECIAL_HANDLING_CHECKED,
    AuditAction.ROUTE_APPROVED,
}


def _load(container: Container, legal_request_id: str) -> LegalRequest:
    request = container.legal_request_repository.get(legal_request_id)
    if request is None:
        raise NotFoundError("legal_request", legal_request_id)
    return request


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


@router.post("/{legal_request_id}/approve")
def approve(
    legal_request_id: str,
    body: ApproveBody,
    container: Container = Depends(get_container),
    actor: CurrentActor = Depends(get_current_actor),
) -> ApproveResponse:
    request = _load(container, legal_request_id)
    container.state_machine.assert_can_transition(
        request.workflow_state, WorkflowState.ANALYST_APPROVED
    )

    policy = container.approval_policy.evaluate(request)
    if policy.blocking_reasons:
        container.audit_service.record(
            legal_request_id=legal_request_id,
            actor_type=ActorType.SERVICE,
            actor_id="approval_policy",
            action=AuditAction.FINALIZATION_BLOCKED,
            before_state=request.workflow_state,
            after_state=request.workflow_state,
            summary=(
                "Approval refused — blocking reasons: "
                f"{', '.join(policy.blocking_reasons)}."
            ),
        )
        raise FinalizationBlockedError(legal_request_id, policy.blocking_reasons)

    decision = ApprovalDecision(
        legal_request_id=legal_request_id,
        target_type=body.target_type,
        decision=ApprovalDecisionType.APPROVED,
        decided_by=actor.actor_id,
        policy_reasons=policy.review_reasons,
        comments=body.comments,
    )
    before = container.state_machine.transition(request, WorkflowState.ANALYST_APPROVED)
    events: list[AuditEvent] = []
    approve_event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.HUMAN,
        actor_id=actor.actor_id,
        action=AuditAction.ROUTE_APPROVED,
        before_state=before,
        after_state=request.workflow_state,
        summary=f"Human approval recorded for {body.target_type.value}.",
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
