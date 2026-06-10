"""Typed application errors mapped to HTTP responses in main.py."""

from app.models.workflow_state import WorkflowState


class CaseFlowError(Exception):
    """Base class for typed application errors."""


class NotFoundError(CaseFlowError):
    def __init__(self, resource: str, resource_id: str):
        self.resource = resource
        self.resource_id = resource_id
        super().__init__(f"{resource} '{resource_id}' not found")


class InvalidStateTransitionError(CaseFlowError):
    def __init__(self, from_state: WorkflowState, to_state: WorkflowState):
        self.from_state = from_state
        self.to_state = to_state
        super().__init__(
            f"Invalid workflow state transition: {from_state.value} -> {to_state.value}"
        )


class AgentExecutionStateError(CaseFlowError):
    """Raised when agent execution is requested in a workflow state where
    the rail may not run (e.g., un-extracted intake or after approval)."""

    def __init__(self, legal_request_id: str, state: WorkflowState):
        self.legal_request_id = legal_request_id
        self.state = state
        super().__init__(
            f"Agent execution is not allowed for {legal_request_id} in state "
            f"'{state.value}'. Run extraction first; agents never run after approval."
        )


class AuditWriteError(CaseFlowError):
    """Raised when an audit event cannot be persisted. Any state change in
    flight must be abandoned: no audit, no transition."""


class FinalizationBlockedError(CaseFlowError):
    def __init__(self, legal_request_id: str, reasons: list[str]):
        self.legal_request_id = legal_request_id
        self.reasons = reasons
        super().__init__(
            f"Finalization blocked for {legal_request_id}: {', '.join(reasons) or 'unspecified'}"
        )
