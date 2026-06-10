"""Single source of truth for the six RFP agents.

ADK requires agent names to be valid Python identifiers, so each agent's ADK
``name`` is its snake_case id. The official RFP display name is carried
separately and must be used verbatim in UI, audit, and governance surfaces.
"""

INDEXING_AGENT = "indexing_agent"
TRIAGING_AGENT = "triaging_agent"
ETL_AGENT = "etl_agent"
NOTE_TAKING_AND_DATA_ENTRY_AGENT = "note_taking_and_data_entry_agent"
TEXT_CONTENT_AGENT = "text_content_agent"
AUTOMATION_AGENT = "automation_agent"

# Official RFP agent names — exact spelling is a hard product requirement.
OFFICIAL_AGENT_NAMES: dict[str, str] = {
    INDEXING_AGENT: "Indexing Agent",
    TRIAGING_AGENT: "Triaging Agent",
    ETL_AGENT: "ETL Agent",
    NOTE_TAKING_AND_DATA_ENTRY_AGENT: "Note Taking and Data Entry Agent",
    TEXT_CONTENT_AGENT: "Text Content Agent",
    AUTOMATION_AGENT: "Automation Agent",
}

# Six-Agent Workflow Rail order (handoff doc 16).
RAIL_ORDER: tuple[str, ...] = (
    INDEXING_AGENT,
    TRIAGING_AGENT,
    ETL_AGENT,
    NOTE_TAKING_AND_DATA_ENTRY_AGENT,
    TEXT_CONTENT_AGENT,
    AUTOMATION_AGENT,
)
