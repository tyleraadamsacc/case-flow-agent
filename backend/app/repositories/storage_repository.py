from abc import ABC, abstractmethod


class StorageRepository(ABC):
    """Artifact text storage. Cloud Storage implementation arrives in a
    later PR behind this same interface."""

    @abstractmethod
    def load_text(self, uri: str) -> str | None: ...

    @abstractmethod
    def save_text(self, uri: str, text: str) -> None: ...
