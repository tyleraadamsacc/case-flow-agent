"""The single google-genai wrapper (plan §15, GCP DoD).

Nothing else in the codebase may import ``google.genai`` for completions.
The dependency is an optional extra (``pip install -e "./backend[gemini]"``)
so local development and CI stay credential-free; constructing this client
without the extra installed fails with instructions, never silently.

Route handlers never call this client — agents reach it through
ModelAssist and services receive it via DI.
"""

import time
from typing import Any

from app.llm.model_client import ModelResponse


class GeminiNotConfiguredError(RuntimeError):
    pass


class GeminiClient:
    """Owns auth, timeout, one retry, and response parsing for Gemini
    calls. Model ids and the API key come from Settings — never from
    code. Output remains advisory/draft: callers validate every response
    against a schema and fall back to deterministic behavior on failure."""

    def __init__(self, *, api_key: str | None, default_model: str | None) -> None:
        if not api_key:
            raise GeminiNotConfiguredError(
                "MODEL_MODE=gemini requires CASEFLOW_GEMINI_API_KEY in the "
                "environment (never commit it)."
            )
        if not default_model:
            raise GeminiNotConfiguredError(
                "MODEL_MODE=gemini requires CASEFLOW_MODEL_DEFAULT or a "
                "per-task CASEFLOW_MODEL_OVERRIDES__<TASK> model id."
            )
        try:
            from google import genai
        except ImportError as exc:  # pragma: no cover — extra not installed in CI
            raise GeminiNotConfiguredError(
                "google-genai is not installed. Install the optional extra: "
                'pip install -e "./backend[gemini]"'
            ) from exc
        self._genai = genai
        self._client = genai.Client(api_key=api_key)
        self._default_model = default_model

    def complete(
        self,
        *,
        task: str,
        prompt: str,
        context: dict[str, Any] | None = None,
        model_id: str | None = None,
        prompt_version: str | None = None,
    ) -> ModelResponse:  # pragma: no cover — requires live credentials
        model = model_id or self._default_model
        started = time.perf_counter()
        response = self._client.models.generate_content(
            model=model,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        return ModelResponse(
            text=response.text or "",
            model_id=model,
            prompt_version=prompt_version,
            latency_ms=(time.perf_counter() - started) * 1000,
            outcome="ok",
        )
