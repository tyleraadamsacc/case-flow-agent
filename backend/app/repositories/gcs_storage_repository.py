"""Cloud Storage artifact repository — skeleton (plan §19 PR 10).

URIs map ``local://...`` paths onto ``gs://{bucket}/...`` objects behind
the same StorageRepository interface. Full wiring is post-MVP.
"""

from app.gcp import GcpAdapterNotReadyError, require_gcp_package, require_setting
from app.repositories.storage_repository import StorageRepository

_NOT_WIRED = (
    "GcsStorageRepository is a post-MVP skeleton: the object layout is "
    "defined, but live Cloud Storage wiring is not enabled in the prototype."
)


class GcsStorageRepository(StorageRepository):
    def __init__(self, *, bucket: str | None) -> None:
        require_gcp_package("google.cloud.storage")
        self._bucket = require_setting(bucket, "CASEFLOW_GCS_BUCKET")

    def load_text(self, uri: str) -> str | None:
        raise GcpAdapterNotReadyError(_NOT_WIRED)

    def save_text(self, uri: str, text: str) -> None:
        raise GcpAdapterNotReadyError(_NOT_WIRED)
