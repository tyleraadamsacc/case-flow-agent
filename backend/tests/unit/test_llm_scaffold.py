"""Gemini-preparation scaffolding: ModelRouter resolves everything to
deterministic/mock (never live), the MockModelClient is the only client,
structured-output validation enforces the repair-then-block discipline,
and no model IDs are hardcoded outside configuration."""

from pathlib import Path

from app.config import Settings
from app.llm.model_client import MockModelClient, ModelResponse
from app.llm.model_router import ALWAYS_DETERMINISTIC, MODEL_TASKS, ModelRouter
from app.llm.output_validation import (
    repair_prompt,
    validate_structured_output,
)
from app.models.note_draft import NoteDraft

APP_DIR = Path(__file__).resolve().parents[2] / "app"


def test_router_is_deterministic_by_default_for_every_task():
    router = ModelRouter(Settings())
    for task in MODEL_TASKS:
        assert router.mode_for(task) == "deterministic"
        assert router.client_for(task) is None


def test_router_mock_mode_never_touches_safety_critical_tasks():
    router = ModelRouter(Settings(model_mode="mock_model"))
    for task in MODEL_TASKS:
        assert router.mode_for(task) == "mock_model"
        assert isinstance(router.client_for(task), MockModelClient)
    for task in ALWAYS_DETERMINISTIC:
        assert router.mode_for(task) == "deterministic"
        assert router.client_for(task) is None


def test_mock_client_returns_canned_response_and_records_calls():
    client = MockModelClient({"note_drafting": '{"note": "x"}'})
    response = client.complete(task="note_drafting", prompt="draft a note")
    assert isinstance(response, ModelResponse)
    assert response.model_id == "mock-model"
    assert client.calls[0]["task"] == "note_drafting"


def test_output_validation_valid_invalid_and_repair_path():
    valid_payload = (
        '{"note_type": "request_intake_note", "body": "Synthetic note."}'
    )
    model, result = validate_structured_output(valid_payload, NoteDraft)
    assert result.valid is True
    assert model.body == "Synthetic note."

    model, result = validate_structured_output('{"note_type": "bogus"}', NoteDraft)
    assert model is None and result.valid is False
    assert any("note_type" in error for error in result.errors)

    model, result = validate_structured_output("not json", NoteDraft)
    assert model is None and "invalid JSON" in result.errors[0]

    prompt = repair_prompt("original", result.errors)
    assert "original" in prompt and "failed schema validation" in prompt


def test_prompt_placeholders_exist_with_versioned_front_matter():
    prompts_dir = APP_DIR / "prompts" / "caseflow"
    files = sorted(path.name for path in prompts_dir.glob("*.md"))
    assert "triage_classification.md" in files
    assert "production_package_draft.md" in files
    for path in prompts_dir.glob("*.md"):
        text = path.read_text()
        assert text.startswith("---")
        assert "version:" in text and "task:" in text and "output_schema:" in text


def test_no_hardcoded_model_ids_and_genai_is_optional_only():
    import tomllib

    for path in APP_DIR.rglob("*.py"):
        source = path.read_text()
        assert "gemini-" not in source, f"hardcoded model id in {path}"
    pyproject = tomllib.loads((APP_DIR.parent / "pyproject.toml").read_text())
    core = " ".join(pyproject["project"]["dependencies"])
    assert "google-genai" not in core, "google-genai must stay an optional extra"
    extras = pyproject["project"]["optional-dependencies"]
    assert any("google-genai" in dep for dep in extras.get("gemini", []))
