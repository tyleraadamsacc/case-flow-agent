from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import OFFICIAL_AGENT_NAMES, TRIAGING_AGENT


class TriagingAgent(CaseFlowAgent):
    """Classifies request type, urgency, sensitivity, queue, and SME
    review need."""


def create_triaging_agent() -> TriagingAgent:
    return TriagingAgent(
        name=TRIAGING_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[TRIAGING_AGENT],
        description=(
            "Classifies the legal request: type, urgency, sensitivity, "
            "recommended queue, and SME review need."
        ),
    )
