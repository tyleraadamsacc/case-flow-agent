"""Deterministic request extraction (PR 1).

Loads pre-extracted fields from the seeded scenario fixtures, strips
LERS-template placeholder/instruction text, and populates the
LegalRequest structure. Gemini-backed extraction arrives in a later PR
behind the same output contract.
"""

import json
from pathlib import Path
from typing import Any

from app.models.base import CaseFlowModel
from app.models.legal_authority import LegalAuthority
from app.models.legal_process import LegalProcess
from app.models.legal_request import LegalRequest
from app.models.requested_data_category import RequestedDataCategory
from app.models.requested_period import RequestedPeriod
from app.models.requesting_agency import RequestingAgency
from app.models.special_handling import SpecialHandlingFlags
from app.models.subject_identifier import SubjectIdentifier

# Instruction/placeholder text from the LERS request template that must
# never survive extraction (handoff doc 02).
PLACEHOLDER_PATTERNS: tuple[str, ...] = (
    "PLEASE DELETE",
    "YOUR NAME HERE",
    "ACCOUNT NAME [IF KNOWN]",
    "DATE OF INTEREST",
    "LIST CRIMINAL OFFENSE(S)",
)


def contains_placeholder(value: str) -> bool:
    upper = value.upper()
    return any(pattern in upper for pattern in PLACEHOLDER_PATTERNS)


def _sanitize(value: Any) -> Any:
    """Recursively replace placeholder-bearing strings with None and drop
    them from lists."""
    if isinstance(value, str):
        return None if contains_placeholder(value) else value
    if isinstance(value, dict):
        return {key: _sanitize(item) for key, item in value.items()}
    if isinstance(value, list):
        sanitized = (_sanitize(item) for item in value)
        return [item for item in sanitized if item is not None]
    return value


class ExtractionResult(CaseFlowModel):
    legal_process: LegalProcess | None = None
    requesting_agency: RequestingAgency | None = None
    subject_identifiers: list[SubjectIdentifier] = []
    requested_data_categories: list[RequestedDataCategory] = []
    product_domains: list[str] = []
    requested_period: RequestedPeriod | None = None
    special_handling: SpecialHandlingFlags = SpecialHandlingFlags()
    legal_authorities: list[LegalAuthority] = []


class RequestExtractionService:
    def __init__(self, legal_requests_dir: Path) -> None:
        self._fixture_index: dict[str, Path] = {}
        for path in sorted(legal_requests_dir.glob("*.json")):
            fixture = json.loads(path.read_text())
            self._fixture_index[fixture["legal_request_id"]] = path

    def extract(self, request: LegalRequest) -> ExtractionResult:
        fixture_path = self._fixture_index.get(request.legal_request_id)
        if fixture_path is None:
            # Nothing to extract for ad-hoc requests; downstream validation
            # surfaces the missing fields as deficiencies.
            return ExtractionResult()

        raw_fields = json.loads(fixture_path.read_text()).get("extracted_fields", {})
        fields: dict[str, Any] = _sanitize(raw_fields)

        # Identifiers whose value was placeholder text are unusable.
        identifiers = [
            item
            for item in fields.get("subject_identifiers", [])
            if isinstance(item, dict) and item.get("value")
        ]

        result = ExtractionResult(
            legal_process=_validate_optional(LegalProcess, fields.get("legal_process")),
            requesting_agency=_validate_optional(
                RequestingAgency, fields.get("requesting_agency")
            ),
            subject_identifiers=[SubjectIdentifier.model_validate(i) for i in identifiers],
            requested_data_categories=[
                RequestedDataCategory.model_validate(c)
                for c in fields.get("requested_data_categories", [])
            ],
            product_domains=fields.get("product_domains", []),
            requested_period=_validate_optional(
                RequestedPeriod, fields.get("requested_period")
            ),
            special_handling=SpecialHandlingFlags.model_validate(
                fields.get("special_handling", {})
            ),
            legal_authorities=[
                LegalAuthority.model_validate(a) for a in fields.get("legal_authorities", [])
            ],
        )
        if result.requested_period is not None:
            period = result.requested_period
            period.valid = (
                period.start is not None
                and period.end is not None
                and period.start <= period.end
            )
            if not period.valid:
                period.issues = ["Requested period is missing or invalid."]
        return result

    def apply(self, request: LegalRequest, extraction: ExtractionResult) -> None:
        request.legal_process = extraction.legal_process
        request.requesting_agency = extraction.requesting_agency
        request.subject_identifiers = extraction.subject_identifiers
        request.requested_data_categories = extraction.requested_data_categories
        request.product_domains = extraction.product_domains
        request.requested_period = extraction.requested_period
        request.special_handling = extraction.special_handling
        request.legal_authorities = extraction.legal_authorities


def _validate_optional(model_type: type, payload: Any) -> Any:
    return model_type.model_validate(payload) if payload else None
