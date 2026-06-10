"""Task → model routing from configuration.

The seven model-assisted tasks (plan §15) resolve to handler names from
Settings; in deterministic mode every task resolves to "deterministic"
and no model client is ever constructed. Model IDs live in configuration
only — never in agent or service code.
"""

from app.config import Settings
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
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def mode_for(self, task: str) -> str:
        """'deterministic' or 'mock_model'. A 'gemini' mode arrives in a
        later PR; nothing here can reach a live model today."""
        if task in ALWAYS_DETERMINISTIC or task not in MODEL_TASKS:
            return "deterministic"
        if self._settings.model_mode == "mock_model":
            return "mock_model"
        return "deterministic"

    def client_for(self, task: str) -> ModelClient | None:
        """A client only exists in mock mode; deterministic tasks get None."""
        if self.mode_for(task) == "mock_model":
            return MockModelClient()
        return None
