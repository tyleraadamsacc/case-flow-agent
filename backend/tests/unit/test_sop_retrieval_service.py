"""Local evidence retrieval: stable ids, source-type filtering, and the
hardening guarantee that every evidence id any agent or service emits
resolves against the local corpus."""

from app.mock_data.seed import MOCK_DATA_DIR
from app.models.enums import EvidenceSourceType
from app.services.sop_retrieval_service import LocalSopRetrievalService

SCENARIOS = (
    "LER-2026-004812",
    "LER-2026-004821",
    "LER-2026-004835",
    "LER-2026-004842",
    "LER-2026-004850",
    "LER-2026-004863",
    "LER-2026-004871",
    "LER-2026-004888",
)


def service() -> LocalSopRetrievalService:
    return LocalSopRetrievalService(MOCK_DATA_DIR)


def test_known_evidence_ids_resolve_with_stable_content():
    retrieval = service()
    sop = retrieval.get("SOP-REQUEST-INTAKE-LOCATION")
    assert sop is not None
    assert sop.source_type == EvidenceSourceType.SOP
    assert "Location" in sop.title

    route = retrieval.get("ROUTE-LOCATION-P1")
    assert route.source_type == EvidenceSourceType.ROUTING_RULE
    assert "Location Response Review" in route.title

    deficiency = retrieval.get("DEF-MISSING-DATE-RANGE")
    assert deficiency.source_type == EvidenceSourceType.DEFICIENCY_RULE

    registry = retrieval.get("REG-SENSITIVE-001")
    assert registry.source_type == EvidenceSourceType.REGISTRY

    assert retrieval.get("EV-DOES-NOT-EXIST") is None


def test_search_filters_by_source_type_and_query():
    retrieval = service()
    rules = retrieval.search(source_type=EvidenceSourceType.ROUTING_RULE)
    assert {ref.evidence_id for ref in rules} >= {"ROUTE-LOCATION-P1", "ROUTE-DEFAULT"}
    assert all(ref.source_type == EvidenceSourceType.ROUTING_RULE for ref in rules)

    pen = retrieval.search(query="pen register")
    assert any(ref.evidence_id == "SOP-PEN-REGISTER-TT" for ref in pen)


def test_every_evidence_id_emitted_by_the_rail_resolves(client, advance_to_review, container):
    """Evidence hardening: run the rail on all eight scenarios and resolve
    every evidence id from runs, audit events, classifications, findings,
    and drafts against the local corpus."""
    retrieval = service()
    for legal_request_id in SCENARIOS:
        advance_to_review(legal_request_id)
        response = client.post(f"/api/legal-requests/{legal_request_id}/agents/run")
        assert response.status_code == 200, response.text

    emitted: set[str] = set()
    for run in container.agent_run_repository.list_all():
        emitted.update(run.evidence_ids)
    for event in container.audit_repository.list_all():
        emitted.update(event.evidence_ids)
    for legal_request_id in SCENARIOS:
        request = container.legal_request_repository.get(legal_request_id)
        for finding in request.deficiency_findings:
            emitted.update(finding.evidence_ids)
        if request.classification is not None:
            emitted.update(request.classification.evidence_ids)
        if request.routing_recommendation is not None:
            emitted.update(request.routing_recommendation.evidence_ids)
        for draft in request.text_drafts:
            emitted.update(draft.evidence_ids)

    assert emitted, "the rail must emit evidence references"
    unresolved = sorted(eid for eid in emitted if retrieval.get(eid) is None)
    assert unresolved == [], f"unresolvable evidence ids: {unresolved}"


def test_classifications_and_drafts_carry_evidence_ids(client, advance_to_review, container):
    advance_to_review("LER-2026-004812")
    client.post("/api/legal-requests/LER-2026-004812/agents/run")
    request = container.legal_request_repository.get("LER-2026-004812")
    assert request.classification.evidence_ids
    assert request.routing_recommendation.evidence_ids
    assert all(draft.evidence_ids for draft in request.text_drafts)


def test_evidence_endpoints_resolve_and_404(client):
    reference = client.get("/api/evidence/SOP-REQUEST-INTAKE-LOCATION")
    assert reference.status_code == 200
    assert reference.json()["source_type"] == "sop"

    assert client.get("/api/evidence/EV-NOPE").status_code == 404

    routing = client.get("/api/evidence", params={"source_type": "routing_rule"}).json()
    assert routing and all(ref["source_type"] == "routing_rule" for ref in routing)
