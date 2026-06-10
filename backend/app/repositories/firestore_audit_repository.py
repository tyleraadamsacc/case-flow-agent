"""Firestore-backed audit repository — skeleton (plan §19 PR 10).

Append-only like the interface demands: documents in
``{prefix}_audit_events`` are written once and never updated or deleted;
no update/delete method exists. Full wiring is post-MVP.
"""

from app.gcp import GcpAdapterNotReadyError, require_gcp_package, require_setting
from app.models.audit_event import AuditEvent
from app.repositories.audit_repository import AuditRepository

_NOT_WIRED = (
    "FirestoreAuditRepository is a post-MVP skeleton: the append-only "
    "document layout is defined, but live Firestore wiring is not enabled "
    "in the prototype."
)


class FirestoreAuditRepository(AuditRepository):
    def __init__(self, *, project: str | None, collection_prefix: str = "caseflow") -> None:
        require_gcp_package("google.cloud.firestore")
        self._project = require_setting(project, "CASEFLOW_GCP_PROJECT")
        self._collection = f"{collection_prefix}_audit_events"

    def append(self, event: AuditEvent) -> None:
        raise GcpAdapterNotReadyError(_NOT_WIRED)

    def list_for_request(self, legal_request_id: str) -> list[AuditEvent]:
        raise GcpAdapterNotReadyError(_NOT_WIRED)

    def list_all(self) -> list[AuditEvent]:
        raise GcpAdapterNotReadyError(_NOT_WIRED)

    def count(self) -> int:
        raise GcpAdapterNotReadyError(_NOT_WIRED)
