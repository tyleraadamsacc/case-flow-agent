from abc import ABC, abstractmethod

from app.models.legal_request import LegalRequest


class LegalRequestRepository(ABC):
    """Source of truth for legal request state. Firestore implementation
    arrives in a later PR behind this same interface."""

    @abstractmethod
    def get(self, legal_request_id: str) -> LegalRequest | None: ...

    @abstractmethod
    def list_all(self) -> list[LegalRequest]: ...

    @abstractmethod
    def save(self, request: LegalRequest) -> None: ...
