from pathlib import Path

from app.repositories.storage_repository import StorageRepository

_SCHEME = "local://"


class LocalStorageRepository(StorageRepository):
    """Maps ``local://<relative-path>`` URIs onto a base directory."""

    def __init__(self, base_dir: Path) -> None:
        self._base_dir = base_dir

    def _path_for(self, uri: str) -> Path:
        if not uri.startswith(_SCHEME):
            raise ValueError(f"Unsupported storage URI (expected {_SCHEME}...): {uri}")
        relative = uri.removeprefix(_SCHEME)
        path = (self._base_dir / relative).resolve()
        if not path.is_relative_to(self._base_dir.resolve()):
            raise ValueError(f"Storage URI escapes the base directory: {uri}")
        return path

    def load_text(self, uri: str) -> str | None:
        path = self._path_for(uri)
        return path.read_text() if path.exists() else None

    def save_text(self, uri: str, text: str) -> None:
        path = self._path_for(uri)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
