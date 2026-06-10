from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import AUTOMATION_AGENT, OFFICIAL_AGENT_NAMES


class AutomationAgent(CaseFlowAgent):
    """Prepares route, escalation, assignment, QA sampling, or follow-up
    actions.

    Prepares only — it never executes the actions it prepares.
    """


def create_automation_agent() -> AutomationAgent:
    return AutomationAgent(
        name=AUTOMATION_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[AUTOMATION_AGENT],
        description=(
            "Prepares route, escalation, assignment, QA sampling, or "
            "follow-up actions (prepared pending human; never executed)."
        ),
    )
