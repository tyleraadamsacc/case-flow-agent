from abc import ABC, abstractmethod

from app.models.responsive_record import ResponsiveRecord


class ResponseRecordRepository(ABC):
    """Read-only access to mock responsive records. The ETL Agent consumes
    this in PR 2; no production data source ever sits behind it."""

    @abstractmethod
    def records_for_request(self, legal_request_id: str) -> list[ResponsiveRecord]: ...

    @abstractmethod
    def source_for_request(self, legal_request_id: str) -> str | None:
        """Stable reference to the mock record source backing this
        request, or None when no source is mapped."""
