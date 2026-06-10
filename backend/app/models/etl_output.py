from typing import Literal

from pydantic import Field

from app.models.base import CaseFlowModel


class EtlOutput(CaseFlowModel):
    """ETL Agent output payload. Mock-only and read-only by construction:
    ``data_confidence`` is type-constrained to synthetic_mock, and the
    record source is always the local mock record store."""

    schema_version: str = "1.0"
    query_type: str
    data_sources_checked: list[str] = []
    total_responsive_records: int = Field(default=0, ge=0)
    records_ref: str | None = None
    data_confidence: Literal["synthetic_mock"] = "synthetic_mock"
    limitations: list[str] = []
