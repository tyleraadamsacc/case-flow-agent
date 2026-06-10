"""ADK smoke tests: the six RFP agents exist as named Google ADK agents,
carry the exact official RFP names, and execute under CaseFlowRootAgent
with zero credentials."""

import asyncio

from google.adk.agents import BaseAgent
from google.adk.workflow import Workflow
from google.genai import types

from app.adk_agents.registry import OFFICIAL_AGENT_NAMES, RAIL_ORDER
from app.adk_agents.root_agent import CaseFlowRootAgent, create_caseflow_root_agent

# Official RFP agent names — exact spelling is a hard product requirement.
OFFICIAL_RFP_NAMES = {
    "Text Content Agent",
    "Automation Agent",
    "ETL Agent",
    "Note Taking and Data Entry Agent",
    "Triaging Agent",
    "Indexing Agent",
}


def test_registry_has_exactly_the_six_official_rfp_names():
    assert set(OFFICIAL_AGENT_NAMES.values()) == OFFICIAL_RFP_NAMES
    assert len(OFFICIAL_AGENT_NAMES) == 6
    assert set(OFFICIAL_AGENT_NAMES.keys()) == set(RAIL_ORDER)


def test_root_agent_instantiates_with_six_adk_agents_in_rail_order():
    root = create_caseflow_root_agent()
    assert isinstance(root, CaseFlowRootAgent)
    assert isinstance(root, Workflow)
    assert [agent.name for agent in root.rail_agents] == list(RAIL_ORDER)
    assert all(isinstance(agent, BaseAgent) for agent in root.rail_agents)


def test_each_agent_carries_its_exact_official_display_name():
    root = create_caseflow_root_agent()
    display_names = [agent.display_name for agent in root.rail_agents]
    assert display_names == [OFFICIAL_AGENT_NAMES[agent_id] for agent_id in RAIL_ORDER]
    assert set(display_names) == OFFICIAL_RFP_NAMES


def test_no_agent_uses_a_generic_placeholder_name():
    root = create_caseflow_root_agent()
    for agent in root.rail_agents:
        assert "ai_agent" not in agent.name
        assert agent.display_name in OFFICIAL_RFP_NAMES


def test_root_agent_executes_all_six_agents_without_credentials():
    from google.adk.runners import InMemoryRunner

    async def run_rail() -> list[str]:
        runner = InMemoryRunner(node=create_caseflow_root_agent(), app_name="caseflow")
        session = await runner.session_service.create_session(
            app_name="caseflow", user_id="smoke-test"
        )
        return [
            event.author
            async for event in runner.run_async(
                user_id="smoke-test",
                session_id=session.id,
                new_message=types.Content(role="user", parts=[types.Part(text="run")]),
            )
        ]

    authors = asyncio.run(run_rail())
    agent_authors = [author for author in authors if author in RAIL_ORDER]
    assert agent_authors == list(RAIL_ORDER)
