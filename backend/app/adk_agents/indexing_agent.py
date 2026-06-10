from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import INDEXING_AGENT, OFFICIAL_AGENT_NAMES


class IndexingAgent(CaseFlowAgent):
    """Indexes the request by legal process, product/domain, identifiers,
    SOP matches, and priority."""


def create_indexing_agent() -> IndexingAgent:
    return IndexingAgent(
        name=INDEXING_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[INDEXING_AGENT],
        description=(
            "Indexes the legal request by legal process, product/domain, "
            "identifiers, SOP matches, and priority."
        ),
    )
