import pytest

from app.errors import InvalidStateTransitionError
from app.models.legal_request import LegalRequest
from app.models.workflow_state import WorkflowState
from app.orchestration.workflow_state_machine import TRANSITIONS, WorkflowStateMachine

_S = WorkflowState

LEGAL_PR1_PATH = [
    _S.REQUEST_RECEIVED,
    _S.REQUEST_EXTRACTED,
    _S.REQUEST_VALIDATED,
    _S.ANALYST_REVIEW_PENDING,
    _S.ANALYST_APPROVED,
    _S.AUDIT_COMPLETE,
]


def test_legal_pr1_path_passes():
    machine = WorkflowStateMachine()
    request = LegalRequest(legal_request_id="LER-TEST-1")
    for state in LEGAL_PR1_PATH[1:]:
        before = machine.transition(request, state)
        assert request.workflow_state == state
        assert before != state


@pytest.mark.parametrize(
    ("from_state", "to_state"),
    [
        (_S.REQUEST_RECEIVED, _S.ANALYST_APPROVED),
        (_S.REQUEST_RECEIVED, _S.AUDIT_COMPLETE),
        (_S.REQUEST_EXTRACTED, _S.ANALYST_REVIEW_PENDING),
        (_S.AUDIT_COMPLETE, _S.REQUEST_RECEIVED),
        (_S.ANALYST_REVIEW_PENDING, _S.AUDIT_COMPLETE),
    ],
)
def test_invalid_transitions_fail_loudly(from_state, to_state):
    machine = WorkflowStateMachine()
    request = LegalRequest(legal_request_id="LER-TEST-1", workflow_state=from_state)
    with pytest.raises(InvalidStateTransitionError):
        machine.transition(request, to_state)
    assert request.workflow_state == from_state


def test_review_loop_states_return_to_pending():
    machine = WorkflowStateMachine()
    for loop_state in (_S.CHANGES_REQUESTED, _S.ESCALATED, _S.SENT_TO_QA):
        request = LegalRequest(
            legal_request_id="LER-TEST-1", workflow_state=_S.ANALYST_REVIEW_PENDING
        )
        machine.transition(request, loop_state)
        machine.transition(request, _S.ANALYST_REVIEW_PENDING)
        assert request.workflow_state == _S.ANALYST_REVIEW_PENDING


def test_audit_complete_is_only_reachable_from_analyst_approved():
    machine = WorkflowStateMachine()
    for state in WorkflowState:
        can = machine.can_transition(state, _S.AUDIT_COMPLETE)
        assert can == (state == _S.ANALYST_APPROVED)


def test_audit_complete_is_terminal():
    assert TRANSITIONS[_S.AUDIT_COMPLETE] == frozenset()
