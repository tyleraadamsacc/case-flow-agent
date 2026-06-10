from app.models.legal_request import LegalRequest
from app.repositories.legal_request_repository import LegalRequestRepository


class LocalLegalRequestRepository(LegalRequestRepository):
    """In-memory repository. ``get`` returns a deep copy so callers cannot
    mutate stored state without an explicit ``save`` — this is what lets a
    failed audit write abandon an in-flight transition."""

    def __init__(self) -> None:
        self._requests: dict[str, LegalRequest] = {}

    def get(self, legal_request_id: str) -> LegalRequest | None:
        stored = self._requests.get(legal_request_id)
        return stored.model_copy(deep=True) if stored is not None else None

    def list_all(self) -> list[LegalRequest]:
        return [request.model_copy(deep=True) for request in self._requests.values()]

    def save(self, request: LegalRequest) -> None:
        self._requests[request.legal_request_id] = request.model_copy(deep=True)
