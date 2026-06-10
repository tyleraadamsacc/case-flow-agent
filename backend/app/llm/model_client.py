"""Model client protocol and the mock implementation.

Preparation only: no live model integration exists in this codebase. The
GeminiClient (google-genai) arrives in a later PR behind this same
protocol; agents will use ADK LlmAgent instead and never call a client
directly. No model IDs are hardcoded anywhere — the ModelRouter resolves
them from configuration.
"""

from typing import Any, Protocol

from app.models.base import CaseFlowModel


class ModelResponse(CaseFlowModel):
    """A structured model response plus the metadata the audit/logging
    layers require (model id, prompt version, latency, outcome)."""

    text: str
    model_id: str
    prompt_version: str | None = None
    latency_ms: float = 0.0
    outcome: str = "ok"


class ModelClient(Protocol):
    def complete(
        self, *, task: str, prompt: str, context: dict[str, Any] | None = None
    ) -> ModelResponse: ...


class MockModelClient:
    """Deterministic stand-in used by tests and MODEL_MODE=mock_model.

    Returns canned responses keyed by task so the repair/retry/block path
    can be exercised without any network or credentials.
    """

    def __init__(self, canned: dict[str, str] | None = None) -> None:
        self._canned = canned or {}
        self.calls: list[dict[str, Any]] = []

    def complete(
        self, *, task: str, prompt: str, context: dict[str, Any] | None = None
    ) -> ModelResponse:
        self.calls.append({"task": task, "prompt": prompt, "context": context or {}})
        return ModelResponse(
            text=self._canned.get(task, "{}"),
            model_id="mock-model",
            prompt_version="0",
        )
