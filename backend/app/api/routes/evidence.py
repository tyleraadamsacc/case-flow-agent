"""Evidence resolution for UI evidence expanders. Read-only, local-only:
resolves the stable evidence ids carried on agent outputs, deficiency
findings, and audit events against the synthetic corpus."""

from fastapi import APIRouter, Depends

from app.api.deps import Container, get_container
from app.errors import NotFoundError
from app.models.enums import EvidenceSourceType
from app.models.evidence import EvidenceReference

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.get("")
def search_evidence(
    source_type: EvidenceSourceType | None = None,
    query: str | None = None,
    container: Container = Depends(get_container),
) -> list[EvidenceReference]:
    return container.retrieval_service.search(source_type=source_type, query=query)


@router.get("/{evidence_id}")
def get_evidence(
    evidence_id: str, container: Container = Depends(get_container)
) -> EvidenceReference:
    reference = container.retrieval_service.get(evidence_id)
    if reference is None:
        raise NotFoundError("evidence", evidence_id)
    return reference
