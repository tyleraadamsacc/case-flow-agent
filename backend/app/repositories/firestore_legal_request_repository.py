"""Firestore-backed legal request repository — skeleton (plan §19 PR 10).

Same interface as the local repository; the swap is config-only
(``CASEFLOW_APP_MODE=gcp``). Document layout: one document per request in
``{prefix}_legal_requests`` keyed by ``legal_request_id``, serialized via
``model_dump(mode="json")``. Full wiring is post-MVP; the skeleton proves
the boundary and fails with guidance, never silently.
"""

from app.gcp import GcpAdapterNotReadyError, require_gcp_package, require_setting
from app.models.legal_request import LegalRequest
from app.repositories.legal_request_repository import LegalRequestRepository

_NOT_WIRED = (
    "FirestoreLegalRequestRepository is a post-MVP skeleton: the document "
    "schema and queries are defined, but live Firestore wiring is not "
    "enabled in the prototype."
)


class FirestoreLegalRequestRepository(LegalRequestRepository):
    def __init__(self, *, project: str | None, collection_prefix: str = "caseflow") -> None:
        require_gcp_package("google.cloud.firestore")
        self._project = require_setting(project, "CASEFLOW_GCP_PROJECT")
        self._collection = f"{collection_prefix}_legal_requests"

    def get(self, legal_request_id: str) -> LegalRequest | None:
        raise GcpAdapterNotReadyError(_NOT_WIRED)

    def list_all(self) -> list[LegalRequest]:
        raise GcpAdapterNotReadyError(_NOT_WIRED)

    def save(self, request: LegalRequest) -> None:
        raise GcpAdapterNotReadyError(_NOT_WIRED)
