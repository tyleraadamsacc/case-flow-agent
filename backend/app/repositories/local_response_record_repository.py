import json
from pathlib import Path

from app.models.responsive_record import ResponsiveRecord
from app.repositories.response_record_repository import ResponseRecordRepository


class LocalResponseRecordRepository(ResponseRecordRepository):
    """Reads synthetic records from mock_data/response_records/. An
    index.json maps legal_request_id to a record file."""

    def __init__(self, records_dir: Path) -> None:
        self._records_dir = records_dir
        index_path = records_dir / "index.json"
        self._index: dict[str, str] = (
            json.loads(index_path.read_text()) if index_path.exists() else {}
        )

    def records_for_request(self, legal_request_id: str) -> list[ResponsiveRecord]:
        filename = self._index.get(legal_request_id)
        if filename is None:
            return []
        payload = json.loads((self._records_dir / filename).read_text())
        return [ResponsiveRecord.model_validate(item) for item in payload]
