"""The single audit write path.

Every state-changing action must record an event here BEFORE the new
state is persisted. If the write fails, AuditWriteError propagates and
the transition is abandoned: no audit, no transition.
"""

from collections.abc import Iterable

from app.errors import AuditWriteError
from app.models.audit_event import AuditEvent
from app.models.enums import ActorType, AuditAction
from app.models.workflow_state import WorkflowState
from app.repositories.audit_repository import AuditRepository

# Audit events that must exist before a request may reach audit_complete.
REQUIRED_EVENTS_FOR_FINALIZATION: set[AuditAction] = {
    AuditAction.REQUEST_INGESTED,
    AuditAction.REQUEST_EXTRACTED,
    AuditAction.SPECIAL_HANDLING_CHECKED,
    AuditAction.ROUTE_APPROVED,
}


class AuditService:
    def __init__(self, repository: AuditRepository) -> None:
        self.repository = repository

    def record(
        self,
        *,
        legal_request_id: str,
        actor_type: ActorType,
        actor_id: str,
        action: AuditAction,
        before_state: WorkflowState | None = None,
        after_state: WorkflowState | None = None,
        summary: str = "",
        evidence_ids: Iterable[str] = (),
        confidence: float | None = None,
        approval_id: str | None = None,
        correlation_id: str | None = None,
    ) -> AuditEvent:
        event = AuditEvent(
            legal_request_id=legal_request_id,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            before_state=before_state,
            after_state=after_state,
            summary=summary,
            evidence_ids=list(evidence_ids),
            confidence=confidence,
            approval_id=approval_id,
            correlation_id=correlation_id,
        )
        try:
            self.repository.append(event)
        except Exception as exc:
            raise AuditWriteError(
                f"Audit write failed for {legal_request_id} ({action.value}); "
                "the state transition has been abandoned."
            ) from exc
        return event

    def timeline(self, legal_request_id: str) -> list[AuditEvent]:
        events = self.repository.list_for_request(legal_request_id)
        return sorted(events, key=lambda event: event.timestamp)

    def has_actions(self, legal_request_id: str, required: set[AuditAction]) -> bool:
        present = {event.action for event in self.repository.list_for_request(legal_request_id)}
        return required.issubset(present)

    def missing_actions(self, legal_request_id: str, required: set[AuditAction]) -> list[str]:
        present = {event.action for event in self.repository.list_for_request(legal_request_id)}
        return sorted(action.value for action in required - present)
