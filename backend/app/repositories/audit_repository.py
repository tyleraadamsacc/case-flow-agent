from abc import ABC, abstractmethod

from app.models.audit_event import AuditEvent


class AuditRepository(ABC):
    """Append-only by design: the interface exposes no update or delete.
    Firestore + Cloud Logging implementations arrive in a later PR."""

    @abstractmethod
    def append(self, event: AuditEvent) -> None: ...

    @abstractmethod
    def list_for_request(self, legal_request_id: str) -> list[AuditEvent]: ...

    @abstractmethod
    def list_all(self) -> list[AuditEvent]: ...

    @abstractmethod
    def count(self) -> int: ...
