"""Legal workflow state transitions.

PR 1 supports intake, extraction, validation, review, approval,
escalation, QA handoff, and audit completion. The agent-chain states
(indexed/classified/route/etl/drafts) are added to the transition table
in PR 2 alongside the deterministic ADK workflow.

Invalid transitions fail loudly with InvalidStateTransitionError.
"""

from app.errors import InvalidStateTransitionError
from app.models.legal_request import LegalRequest
from app.models.workflow_state import WorkflowState

_S = WorkflowState

TRANSITIONS: dict[WorkflowState, frozenset[WorkflowState]] = {
    _S.REQUEST_RECEIVED: frozenset({_S.REQUEST_EXTRACTED}),
    _S.REQUEST_EXTRACTED: frozenset({_S.REQUEST_VALIDATED}),
    _S.REQUEST_VALIDATED: frozenset({_S.ANALYST_REVIEW_PENDING}),
    _S.ANALYST_REVIEW_PENDING: frozenset(
        {_S.ANALYST_APPROVED, _S.ESCALATED, _S.SENT_TO_QA, _S.CHANGES_REQUESTED}
    ),
    _S.CHANGES_REQUESTED: frozenset({_S.ANALYST_REVIEW_PENDING}),
    _S.ESCALATED: frozenset({_S.ANALYST_REVIEW_PENDING}),
    _S.SENT_TO_QA: frozenset({_S.ANALYST_REVIEW_PENDING}),
    # audit_complete is reachable only from analyst_approved, and only the
    # approval flow (human approval + audit completeness check) takes it there.
    _S.ANALYST_APPROVED: frozenset({_S.AUDIT_COMPLETE}),
    _S.AUDIT_COMPLETE: frozenset(),
}


class WorkflowStateMachine:
    def can_transition(self, from_state: WorkflowState, to_state: WorkflowState) -> bool:
        return to_state in TRANSITIONS.get(from_state, frozenset())

    def assert_can_transition(self, from_state: WorkflowState, to_state: WorkflowState) -> None:
        if not self.can_transition(from_state, to_state):
            raise InvalidStateTransitionError(from_state, to_state)

    def transition(self, request: LegalRequest, to_state: WorkflowState) -> WorkflowState:
        """Move the request to ``to_state``, returning the previous state."""
        before = request.workflow_state
        self.assert_can_transition(before, to_state)
        request.workflow_state = to_state
        return before
