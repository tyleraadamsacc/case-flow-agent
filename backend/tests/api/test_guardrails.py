"""Guardrail tests: no send/release paths, no PR 2+ agent endpoints, no
production write-back adapters, no Gemini integration, no credentials."""

from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[2] / "app"

FORBIDDEN_PATH_FRAGMENTS = ("send-final", "send_final", "release", "disclose", "transmit")


def all_route_paths(app) -> list[str]:
    return [route.path for route in app.routes]


def test_no_route_implies_send_or_release(app):
    for path in all_route_paths(app):
        for fragment in FORBIDDEN_PATH_FRAGMENTS:
            assert fragment not in path, f"forbidden route fragment '{fragment}' in {path}"
    assert "/api/legal-requests/{legal_request_id}/send-to-qa" in all_route_paths(app)


def test_explicitly_forbidden_endpoints_do_not_exist(app):
    paths = all_route_paths(app)
    assert "/send-final-response" not in paths
    assert "/release-production" not in paths


def test_agent_visibility_endpoints_exist(app):
    paths = all_route_paths(app)
    assert "/api/legal-requests/{legal_request_id}/agent-runs" in paths
    assert "/api/legal-requests/{legal_request_id}/agents/run" in paths
    assert "/api/governance/agent-activity" in paths


def test_no_production_write_back_adapters_exist():
    # §4 guardrail 6: no adapters that write to production Google systems
    # (LERS, Cases, email, production data stores). The prototype's OWN
    # persistence skeletons (Firestore/GCS, plan §19 PR 10) are allowed —
    # but they must be inert: every method raises until post-MVP wiring.
    repository_modules = {p.name for p in (APP_DIR / "repositories").glob("*.py")}
    for forbidden in ("lers", "cases", "email", "bigquery", "write_back"):
        assert not any(forbidden in name for name in repository_modules), repository_modules

    from app.gcp import GcpAdapterNotReadyError
    from app.repositories.firestore_legal_request_repository import (
        FirestoreLegalRequestRepository,
    )

    skeleton = FirestoreLegalRequestRepository.__new__(FirestoreLegalRequestRepository)
    with pytest.raises(GcpAdapterNotReadyError):
        skeleton.save(None)  # type: ignore[arg-type] — inert before any validation


def test_model_invocation_only_inside_the_single_wrapper():
    # Plan §15 / GCP DoD: Gemini is reachable only through the one
    # google-genai wrapper. No other module may invoke a model, and no
    # model id may be hardcoded anywhere — ids come from configuration.
    wrapper = APP_DIR / "llm" / "gemini_client.py"
    for path in APP_DIR.rglob("*.py"):
        source = path.read_text()
        assert "gemini-" not in source, f"hardcoded model id in {path}"
        if path != wrapper:
            for marker in ("generate_content", "GenerativeModel"):
                assert marker not in source, f"{marker} found outside wrapper: {path}"


def test_app_starts_with_no_credential_env_vars(monkeypatch, tmp_path):
    for variable in ("GEMINI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT"):
        monkeypatch.delenv(variable, raising=False)
    from app.config import Settings
    from app.main import create_app

    application = create_app(Settings())
    assert application.state.container is not None
