"""Task → model routing from configuration.

The seven model-assisted tasks (plan §15) resolve to a mode and a client
from Settings. In deterministic mode (the default) no client is ever
constructed. Safety-critical work — ETL, Automation, approval policy,
workflow state — is pinned deterministic regardless of mode. Model IDs
live in configuration only, never in agent or service code.
"""

from app.config import Settings
from app.llm.canned import canned_valid_responses
from app.llm.model_client import MockModelClient, ModelClient

MODEL_TASKS = (
    "request_extraction",
    "triage_classification",
    "note_drafting",
    "response_package_drafting",
    "deficiency_response_drafting",
    "qa_validation",
    "governance_insights",
)

# Safety-critical work stays deterministic permanently, regardless of mode.
ALWAYS_DETERMINISTIC = ("etl", "automation", "approval_policy", "workflow_state")


class ModelRouter:
    def __init__(
        self, settings: Settings, mock_client: MockModelClient | None = None
    ) -> None:
        self._settings = settings
        self._mock_client = mock_client

    def mode_for(self, task: str) -> str:
        """'deterministic', 'mock_model', or 'gemini'."""
        if task in ALWAYS_DETERMINISTIC or task not in MODEL_TASKS:
            return "deterministic"
        if self._settings.model_mode in ("mock_model", "gemini"):
            return self._settings.model_mode
        return "deterministic"

    def model_for(self, task: str) -> str | None:
        """Configured model id for the task (config/env only)."""
        if self.mode_for(task) == "mock_model":
            return "mock-model"
        return self._settings.model_for(task)

    def client_for(self, task: str) -> ModelClient | None:
        """A client only exists in model-assisted modes; deterministic
        tasks get None. The mock client ships valid canned outputs so the
        whole rail runs credential-free in mock mode."""
        mode = self.mode_for(task)
        if mode == "mock_model":
            if self._mock_client is None:
                self._mock_client = MockModelClient(canned_valid_responses())
            return self._mock_client
        if mode == "gemini":
            from app.llm.gemini_client import GeminiClient

            return GeminiClient(
                api_key=self._settings.gemini_api_key,
                default_model=self._settings.model_for(task),
            )
        return None
