from abc import ABC, abstractmethod

from app.models.agent_run import AgentRun


class AgentRunRepository(ABC):
    """Source of truth for agent execution records. ADK session state is a
    scratchpad only — every API response is served from this repository.
    Firestore implementation arrives in a later PR behind this interface."""

    @abstractmethod
    def save(self, run: AgentRun) -> None: ...

    @abstractmethod
    def get(self, agent_run_id: str) -> AgentRun | None: ...

    @abstractmethod
    def list_for_request(self, legal_request_id: str) -> list[AgentRun]: ...

    @abstractmethod
    def list_all(self) -> list[AgentRun]: ...
