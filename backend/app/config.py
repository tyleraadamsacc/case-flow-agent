from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_MOCK_DATA_DIR = Path(__file__).parent / "mock_data"


class Settings(BaseSettings):
    """Application settings. Local mode needs zero credentials; GCP and
    Gemini modes are opt-in behind these same knobs.

    Model IDs live here and only here (plan §15): nothing in agent or
    service code names a model. Per-task overrides come from the
    environment, e.g. ``CASEFLOW_MODEL_OVERRIDES__TRIAGE_CLASSIFICATION``.
    """

    model_config = SettingsConfigDict(
        env_prefix="CASEFLOW_", env_nested_delimiter="__"
    )

    app_mode: str = "local"
    model_mode: str = "deterministic"  # deterministic | mock_model | gemini
    log_level: str = "INFO"
    seed_on_startup: bool = True
    mock_data_dir: Path = _DEFAULT_MOCK_DATA_DIR
    # "demo" seeds only the two-document LERS scenario (the UI dataset);
    # "full" seeds the eight test scenarios. Tests run "full".
    seed_dataset: str = "full"  # full | demo

    # Gemini mode only — never required locally. The API key is read from
    # the environment and must never be committed.
    gemini_api_key: str | None = None
    # Default model id for all model-assisted tasks in gemini mode.
    model_default: str | None = None
    # Per-task model id overrides, keyed by ModelRouter task name.
    model_overrides: dict[str, str] = {}

    # GCP mode (CASEFLOW_APP_MODE=gcp) — adapter selection is config-only.
    # All adapters are post-MVP skeletons; local mode never reads these.
    gcp_project: str | None = None
    firestore_collection_prefix: str = "caseflow"
    gcs_bucket: str | None = None
    agent_search_datastore: str | None = None

    # When set (the container image sets it), the API also serves the
    # built SPA from this directory.
    static_dir: Path | None = None

    def model_for(self, task: str) -> str | None:
        """The configured model id for a task, or None if unconfigured."""
        return self.model_overrides.get(task) or self.model_default
