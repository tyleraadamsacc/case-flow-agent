from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_MOCK_DATA_DIR = Path(__file__).parent / "mock_data"


class Settings(BaseSettings):
    """Application settings. Local mode needs zero credentials; GCP and
    Gemini modes arrive in later PRs behind these same knobs."""

    model_config = SettingsConfigDict(env_prefix="CASEFLOW_")

    app_mode: str = "local"
    model_mode: str = "deterministic"
    log_level: str = "INFO"
    seed_on_startup: bool = True
    mock_data_dir: Path = _DEFAULT_MOCK_DATA_DIR
