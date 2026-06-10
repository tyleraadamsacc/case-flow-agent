from app.models.agent_run import AgentRun
from app.repositories.agent_run_repository import AgentRunRepository


class LocalAgentRunRepository(AgentRunRepository):
    """In-memory agent-run store. Insertion order is preserved so a
    request's runs read back in rail-execution order; deep copies keep
    stored state immutable from the caller's side."""

    def __init__(self) -> None:
        self._runs: dict[str, AgentRun] = {}

    def save(self, run: AgentRun) -> None:
        self._runs[run.agent_run_id] = run.model_copy(deep=True)

    def get(self, agent_run_id: str) -> AgentRun | None:
        stored = self._runs.get(agent_run_id)
        return stored.model_copy(deep=True) if stored is not None else None

    def list_for_request(self, legal_request_id: str) -> list[AgentRun]:
        return [
            run.model_copy(deep=True)
            for run in self._runs.values()
            if run.legal_request_id == legal_request_id
        ]

    def list_all(self) -> list[AgentRun]:
        return [run.model_copy(deep=True) for run in self._runs.values()]
