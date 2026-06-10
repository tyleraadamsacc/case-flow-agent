"""Guardrail tests: no send/release paths, no PR 2+ agent endpoints, no
production write-back adapters, no Gemini integration, no credentials."""

from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[2] / "app"

FORBIDDEN_PATH_FRAGMENTS = ("send-final", "send_final", "release", "disclose", "transmit")
PR2_PATHS = ("/agents/run", "/agent-runs", "/governance/agent-activity")


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


def test_pr2_agent_endpoints_are_not_implemented_yet(app):
    for path in all_route_paths(app):
        for pr2_fragment in PR2_PATHS:
            assert pr2_fragment not in path


def test_no_production_write_back_adapters_exist():
    repository_modules = {p.name for p in (APP_DIR / "repositories").glob("*.py")}
    for forbidden in ("firestore", "cloud_storage", "bigquery", "lers", "cases"):
        assert not any(forbidden in name for name in repository_modules), repository_modules


def test_no_gemini_integration_in_pr1():
    # ADK's event plumbing legitimately uses google.genai content types in
    # the placeholder agents; what must not exist yet is model invocation.
    forbidden_call_markers = ("generate_content", "GenerativeModel", "gemini-")
    for path in APP_DIR.rglob("*.py"):
        source = path.read_text()
        for marker in forbidden_call_markers:
            assert marker not in source, f"{marker} found in {path}"
    pyproject = (APP_DIR.parent / "pyproject.toml").read_text()
    assert "google-genai" not in pyproject


def test_app_starts_with_no_credential_env_vars(monkeypatch, tmp_path):
    for variable in ("GEMINI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT"):
        monkeypatch.delenv(variable, raising=False)
    from app.config import Settings
    from app.main import create_app

    application = create_app(Settings())
    assert application.state.container is not None
