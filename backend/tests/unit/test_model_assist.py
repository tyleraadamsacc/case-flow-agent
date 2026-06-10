"""Model assistance (plan §15): prompt loading, the validate → repair →
fallback discipline, metadata stamping, and the gemini-mode configuration
guards. Everything runs credential-free."""

from typing import Any

from app.config import Settings
from app.llm.model_assist import (
    VALIDATION_FAILED_REASON,
    VALIDATION_FAILED_STATUS,
    ModelAssist,
)
from app.llm.model_client import MockModelClient, ModelResponse
from app.llm.model_router import ALWAYS_DETERMINISTIC, ModelRouter
from app.llm.prompt_loader import PromptLoader
from app.models.agent_run import AgentRunDraft
from app.models.enums import AgentRunStatus


class ScriptedClient(MockModelClient):
    """Returns a scripted sequence of responses — used to drive the
    repair path with a deliberately invalid first answer."""

    def __init__(self, responses: list[str]) -> None:
        super().__init__()
        self._responses = responses

    def complete(
        self, *, task: str, prompt: str, context: dict[str, Any] | None = None
    ) -> ModelResponse:
        self.calls.append({"task": task, "prompt": prompt, "context": context or {}})
        return ModelResponse(text=self._responses.pop(0), model_id="mock-model")


def make_draft() -> AgentRunDraft:
    return AgentRunDraft(
        agent_id="triaging_agent",
        agent_name="Triaging Agent",
        status=AgentRunStatus.COMPLETE,
        output_summary="Classified deterministically.",
        output={
            "classification": {
                "legal_process_type": "search_warrant",
                "request_category": "deterministic_category",
                "product_domains": ["Maps / Location"],
                "sensitivity": "high",
                "missing_fields": [],
                "confidence": 0.94,
                "human_review_required": False,
                "review_reasons": [],
                "evidence_ids": ["ROUTE-LOCATION-P1"],
            }
        },
        confidence=0.94,
        evidence_ids=["ROUTE-LOCATION-P1"],
    )


def assist_with(client: MockModelClient) -> ModelAssist:
    router = ModelRouter(Settings(model_mode="mock_model"), mock_client=client)
    return ModelAssist(router, PromptLoader())


def test_prompt_loader_indexes_all_model_tasks():
    loader = PromptLoader()
    for task in (
        "request_extraction",
        "triage_classification",
        "note_drafting",
        "response_package_drafting",
        "deficiency_response_drafting",
        "qa_validation",
        "governance_insights",
    ):
        prompt = loader.get(task)
        assert prompt.version
        assert prompt.output_schema
    rendered = loader.get("triage_classification").render({"x": 1})
    assert "INPUT (synthetic data):" in rendered


def test_valid_model_output_replaces_payload_and_stamps_metadata():
    assist = ModelAssist(
        ModelRouter(Settings(model_mode="mock_model")), PromptLoader()
    )
    draft = assist.apply(
        task="triage_classification", draft=make_draft(), context={"legal_request": {}}
    )
    classification = draft.output["classification"]
    assert classification["request_category"] == "mock_model_classification"
    assert draft.model_id == "mock-model"
    assert draft.prompt_version
    assert draft.retry_count == 0
    assert draft.validation_status == "valid"
    # Deterministic evidence references survive the re-draft.
    assert "ROUTE-LOCATION-P1" in classification["evidence_ids"]
    assert "ROUTE-LOCATION-P1" in draft.evidence_ids
    # Canned output demands review — the obligation is adopted, never dropped.
    assert draft.requires_human_review is True


def test_invalid_then_valid_uses_the_single_repair_attempt():
    from app.llm.canned import canned_valid_responses

    valid = canned_valid_responses()["triage_classification"]
    client = ScriptedClient(["not json", valid])
    draft = assist_with(client).apply(
        task="triage_classification", draft=make_draft(), context={}
    )
    assert draft.retry_count == 1
    assert draft.validation_status == "valid"
    assert len(client.calls) == 2
    assert "failed schema validation" in client.calls[1]["prompt"]


def test_invalid_twice_falls_back_to_deterministic_and_requires_review():
    client = ScriptedClient(["not json", '{"legal_process_type": "bogus"}'])
    draft = assist_with(client).apply(
        task="triage_classification", draft=make_draft(), context={}
    )
    # Deterministic output stands; the failure is visible and audited via
    # the run's summary; a human must review.
    assert draft.output["classification"]["request_category"] == "deterministic_category"
    assert draft.validation_status == VALIDATION_FAILED_STATUS
    assert draft.requires_human_review is True
    assert VALIDATION_FAILED_REASON in draft.review_reasons
    assert draft.retry_count == 1
    assert "failed schema validation" in draft.output_summary
    assert len(client.calls) == 2  # never a third attempt


def test_deterministic_mode_never_touches_a_draft():
    assist = ModelAssist(ModelRouter(Settings()), PromptLoader())
    original = make_draft()
    draft = assist.apply(
        task="triage_classification", draft=original.model_copy(deep=True), context={}
    )
    assert draft.output == original.output
    assert draft.model_id is None and draft.prompt_version is None


def test_gemini_mode_requires_configuration_and_never_silently_runs():
    from app.llm.gemini_client import GeminiNotConfiguredError

    router = ModelRouter(Settings(model_mode="gemini"))
    try:
        router.client_for("triage_classification")
        raise AssertionError("expected GeminiNotConfiguredError")
    except GeminiNotConfiguredError as exc:
        assert "GEMINI_API_KEY" in str(exc)

    # Safety-critical tasks stay deterministic even in gemini mode.
    for task in ALWAYS_DETERMINISTIC:
        assert router.mode_for(task) == "deterministic"
        assert router.client_for(task) is None
