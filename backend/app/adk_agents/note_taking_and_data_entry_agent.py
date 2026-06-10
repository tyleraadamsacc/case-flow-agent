from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import NOTE_TAKING_AND_DATA_ENTRY_AGENT, OFFICIAL_AGENT_NAMES


class NoteTakingAndDataEntryAgent(CaseFlowAgent):
    """Drafts structured internal notes and fields to update; nothing is
    applied without human approval."""


def create_note_taking_and_data_entry_agent() -> NoteTakingAndDataEntryAgent:
    return NoteTakingAndDataEntryAgent(
        name=NOTE_TAKING_AND_DATA_ENTRY_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[NOTE_TAKING_AND_DATA_ENTRY_AGENT],
        description=(
            "Drafts structured internal notes and the fields to update on "
            "the case record (human approval required)."
        ),
    )
