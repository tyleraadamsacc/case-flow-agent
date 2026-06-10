"""GCP adapter skeletons (plan §19 PR 10): config-only selection behind
the local interfaces, loud guidance when unconfigured, zero credentials
required in local mode, and the SPA/static + structured-log plumbing."""

import json
import logging

import pytest
from fastapi.testclient import TestClient

from app.api.deps import Container
from app.config import Settings
from app.gcp import GcpAdapterNotReadyError
from app.logging_config import JsonFormatter
from app.main import create_app
from app.repositories.local_audit_repository import LocalAuditRepository
from app.repositories.local_legal_request_repository import LocalLegalRequestRepository


def test_local_mode_selects_local_adapters_by_default():
    container = Container(Settings(seed_on_startup=False))
    assert isinstance(container.legal_request_repository, LocalLegalRequestRepository)
    assert isinstance(container.audit_repository, LocalAuditRepository)


def test_gcp_mode_swap_is_config_only_and_fails_with_guidance():
    # The swap is one env var; without the optional extra installed the
    # selection fails loudly with install instructions — never silently.
    with pytest.raises(GcpAdapterNotReadyError) as exc:
        Container(Settings(app_mode="gcp", gcp_project="synthetic-project"))
    assert 'backend[gcp]' in str(exc.value)


def test_each_skeleton_demands_its_package_and_configuration():
    from app.repositories.firestore_audit_repository import FirestoreAuditRepository
    from app.repositories.firestore_legal_request_repository import (
        FirestoreLegalRequestRepository,
    )
    from app.repositories.gcs_storage_repository import GcsStorageRepository
    from app.services.agent_search_retrieval_service import AgentSearchRetrievalService

    for build in (
        lambda: FirestoreLegalRequestRepository(project="p"),
        lambda: FirestoreAuditRepository(project="p"),
        lambda: GcsStorageRepository(bucket="b"),
        lambda: AgentSearchRetrievalService(datastore="d"),
    ):
        with pytest.raises(GcpAdapterNotReadyError) as exc:
            build()
        assert 'backend[gcp]' in str(exc.value)


def test_json_formatter_carries_structured_caseflow_fields():
    record = logging.LogRecord(
        name="caseflow.agent_runs",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="agent_run_persisted",
        args=(),
        exc_info=None,
    )
    record.caseflow = {
        "legal_request_id": "LER-2026-004812",
        "agent_id": "triaging_agent",
        "model_id": None,
        "prompt_version": None,
        "evidence_ids": ["ROUTE-LOCATION-P1"],
        "confidence": 0.94,
        "latency_ms": 12.0,
    }
    payload = json.loads(JsonFormatter().format(record))
    assert payload["legal_request_id"] == "LER-2026-004812"
    assert payload["agent_id"] == "triaging_agent"
    assert payload["evidence_ids"] == ["ROUTE-LOCATION-P1"]


def test_container_image_mode_serves_the_spa_next_to_the_api(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("// synthetic bundle")
    (tmp_path / "index.html").write_text("<html><body>caseflow spa</body></html>")

    client = TestClient(
        create_app(Settings(static_dir=tmp_path, log_level="WARNING"))
    )
    assert client.get("/healthz").status_code == 200
    assert client.get("/api/legal-requests").status_code == 200
    assert "caseflow spa" in client.get("/requests").text  # SPA fallback
    assert "synthetic bundle" in client.get("/assets/app.js").text
