from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import ETL_AGENT, OFFICIAL_AGENT_NAMES


class EtlAgent(CaseFlowAgent):
    """Simulates an approved responsive data pull from the mock repository.

    Mock-only and read-only in MVP: no production backend is ever
    connected, and all results are labeled synthetic.
    """


def create_etl_agent() -> EtlAgent:
    return EtlAgent(
        name=ETL_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[ETL_AGENT],
        description=(
            "Simulates an approved responsive data pull from the mock "
            "repository (mock-only, read-only, synthetic data)."
        ),
    )
