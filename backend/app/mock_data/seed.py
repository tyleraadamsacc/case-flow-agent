"""Idempotent loader that seeds the synthetic scenario fixtures into the
local repositories. Re-running never duplicates requests or audit events."""

import json
from pathlib import Path

from app.models.enums import ActorType, AuditAction
from app.models.legal_request import LegalRequest
from app.repositories.legal_request_repository import LegalRequestRepository
from app.services.audit_service import AuditService

MOCK_DATA_DIR = Path(__file__).parent


def seed_legal_requests(
    repository: LegalRequestRepository,
    audit_service: AuditService,
    mock_data_dir: Path = MOCK_DATA_DIR,
) -> int:
    """Seed all scenario fixtures; returns the number newly created."""
    created = 0
    for path in sorted((mock_data_dir / "legal_requests").glob("*.json")):
        fixture = json.loads(path.read_text())
        legal_request_id = fixture["legal_request_id"]
        if repository.get(legal_request_id) is not None:
            continue
        request = LegalRequest(
            legal_request_id=legal_request_id,
            source_type=fixture.get("source_type", "lers_request_template"),
            date_received=fixture.get("date_received"),
            raw_source_uri=fixture.get("raw_source_uri"),
            raw_source_text=fixture.get("raw_source_text"),
        )
        audit_service.record(
            legal_request_id=legal_request_id,
            actor_type=ActorType.SYSTEM,
            actor_id="mock_data_seed",
            action=AuditAction.REQUEST_INGESTED,
            before_state=None,
            after_state=request.workflow_state,
            summary=f"Synthetic scenario {fixture.get('scenario', '?')} request seeded "
            "into the intake queue.",
        )
        repository.save(request)
        created += 1
    return created
