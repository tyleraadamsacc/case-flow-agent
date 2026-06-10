from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import OFFICIAL_AGENT_NAMES, TEXT_CONTENT_AGENT


class TextContentAgent(CaseFlowAgent):
    """Drafts the response package, deficiency response, SME notification,
    or production summary.

    Drafts only: never sends, never certifies final, never releases.
    """


def create_text_content_agent() -> TextContentAgent:
    return TextContentAgent(
        name=TEXT_CONTENT_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[TEXT_CONTENT_AGENT],
        description=(
            "Drafts response package, deficiency response, SME "
            "notification, or production summary (draft-only, human "
            "approval required)."
        ),
    )
