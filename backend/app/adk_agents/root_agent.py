from pathlib import Path

from google.adk.agents import BaseAgent
from google.adk.workflow import START, Edge, Workflow

from app.adk_agents.automation_agent import create_automation_agent
from app.adk_agents.etl_agent import create_etl_agent
from app.adk_agents.indexing_agent import create_indexing_agent
from app.adk_agents.note_taking_and_data_entry_agent import (
    create_note_taking_and_data_entry_agent,
)
from app.adk_agents.text_content_agent import create_text_content_agent
from app.adk_agents.triaging_agent import create_triaging_agent
from app.mock_data.seed import MOCK_DATA_DIR


class CaseFlowRootAgent(Workflow):
    """ADK root workflow orchestrating the six RFP agents in rail order.

    Uses the ADK ``Workflow`` graph API (``SequentialAgent`` is deprecated
    in ADK 2.x); the six agents remain named ADK agents wired as graph
    nodes START -> Indexing -> Triaging -> ETL -> Note Taking and Data
    Entry -> Text Content -> Automation.

    Execution layer only: workflow state, approval policy, audit, and
    persistence remain in the FastAPI application layer. ADK session state
    is an execution scratchpad; persisted AgentRun records are the source
    of truth. The root agent cannot finalize route, response package,
    production, release, or send actions.
    """

    @property
    def rail_agents(self) -> list[BaseAgent]:
        """The six RFP agents in rail order, derived from the workflow edges."""
        next_node = {edge.from_node.name: edge.to_node for edge in self.edges}
        agents: list[BaseAgent] = []
        node = next_node.get(START.name)
        while node is not None:
            assert isinstance(node, BaseAgent)
            agents.append(node)
            node = next_node.get(node.name)
        return agents


def create_caseflow_root_agent(mock_data_dir: Path = MOCK_DATA_DIR) -> CaseFlowRootAgent:
    rail = [
        create_indexing_agent(mock_data_dir),
        create_triaging_agent(mock_data_dir),
        create_etl_agent(),
        create_note_taking_and_data_entry_agent(),
        create_text_content_agent(mock_data_dir),
        create_automation_agent(),
    ]
    edges = [Edge(from_node=START, to_node=rail[0])]
    edges += [Edge(from_node=a, to_node=b) for a, b in zip(rail, rail[1:])]
    return CaseFlowRootAgent(
        name="caseflow_root_agent",
        description=(
            "Orchestrates the six RFP agents in rail order: Indexing Agent, "
            "Triaging Agent, ETL Agent, Note Taking and Data Entry Agent, "
            "Text Content Agent, Automation Agent."
        ),
        edges=edges,
    )
