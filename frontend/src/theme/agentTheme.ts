/** The six RFP agents — frontend mirror of
 * backend/app/adk_agents/registry.py. Agent ids and the official display
 * names must match the backend exactly; the official names are a hard
 * product requirement and must never be paraphrased, abbreviated, or
 * collapsed behind a generic "AI workflow" label. */

export type AgentId =
  | "indexing_agent"
  | "triaging_agent"
  | "etl_agent"
  | "note_taking_and_data_entry_agent"
  | "text_content_agent"
  | "automation_agent";

/** Six-Agent Workflow Rail order — fixed, always all six. */
export const AGENT_RAIL_ORDER: readonly AgentId[] = [
  "indexing_agent",
  "triaging_agent",
  "etl_agent",
  "note_taking_and_data_entry_agent",
  "text_content_agent",
  "automation_agent",
];

export interface AgentTheme {
  id: AgentId;
  /** Official RFP display name — exact spelling required. */
  officialName: string;
  /** 1-based position on the rail. */
  ordinal: number;
  /** Short role one-liner. Describes drafting/preparing work only —
   * never approval, release, send, or disclosure. */
  roleDescription: string;
  /** Restrained accent: used on the ordinal marker only, never to flood
   * the card. Six distinct calm hues, none colliding with status colors
   * in the same element. */
  accent: string;
  accentSoft: string;
}

export const AGENT_THEME: Record<AgentId, AgentTheme> = {
  indexing_agent: {
    id: "indexing_agent",
    officialName: "Indexing Agent",
    ordinal: 1,
    roleDescription: "Labels and ranks the request; matches intake SOPs.",
    accent: "#1A73E8",
    accentSoft: "#E8F0FE",
  },
  triaging_agent: {
    id: "triaging_agent",
    officialName: "Triaging Agent",
    ordinal: 2,
    roleDescription:
      "Classifies the request and recommends a route for human approval.",
    accent: "#7C4DFF",
    accentSoft: "#F0EAFE",
  },
  etl_agent: {
    id: "etl_agent",
    officialName: "ETL Agent",
    ordinal: 3,
    roleDescription:
      "Simulates a read-only responsive-records pull from mock data.",
    accent: "#00ACC1",
    accentSoft: "#E6F7FA",
  },
  note_taking_and_data_entry_agent: {
    id: "note_taking_and_data_entry_agent",
    officialName: "Note Taking and Data Entry Agent",
    ordinal: 4,
    roleDescription:
      "Drafts workflow notes and field updates pending human approval.",
    accent: "#3949AB",
    accentSoft: "#E8EAF6",
  },
  text_content_agent: {
    id: "text_content_agent",
    officialName: "Text Content Agent",
    ordinal: 5,
    roleDescription:
      "Drafts the response package or deficiency response — drafts only.",
    accent: "#00796B",
    accentSoft: "#E0F2F1",
  },
  automation_agent: {
    id: "automation_agent",
    officialName: "Automation Agent",
    ordinal: 6,
    roleDescription:
      "Prepares the next workflow action; a human always executes it.",
    accent: "#E8710A",
    accentSoft: "#FEEFE3",
  },
};

/** Official names in rail order — convenience for tests and modules. */
export const OFFICIAL_AGENT_NAMES: readonly string[] = AGENT_RAIL_ORDER.map(
  (id) => AGENT_THEME[id].officialName,
);

export function agentTheme(agentId: string): AgentTheme | undefined {
  return AGENT_THEME[agentId as AgentId];
}
