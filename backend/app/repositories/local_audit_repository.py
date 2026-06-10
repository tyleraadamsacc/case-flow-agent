from app.models.audit_event import AuditEvent
from app.repositories.audit_repository import AuditRepository


class LocalAuditRepository(AuditRepository):
    """In-memory append-only event log, returned in insertion order."""

    def __init__(self) -> None:
        self._events: list[AuditEvent] = []

    def append(self, event: AuditEvent) -> None:
        self._events.append(event.model_copy(deep=True))

    def list_for_request(self, legal_request_id: str) -> list[AuditEvent]:
        return [
            event.model_copy(deep=True)
            for event in self._events
            if event.legal_request_id == legal_request_id
        ]

    def list_all(self) -> list[AuditEvent]:
        return [event.model_copy(deep=True) for event in self._events]

    def count(self) -> int:
        return len(self._events)
