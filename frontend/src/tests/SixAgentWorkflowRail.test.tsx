/** The Six-Agent Workflow Rail is the product's hard requirement: all six
 * RFP agents, by exact official name, in fixed order, always visible. */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SixAgentWorkflowRail from "../components/agents/SixAgentWorkflowRail";
import type { AgentRunLike } from "../components/agents/SixAgentWorkflowRail";

const OFFICIAL_NAMES_IN_ORDER = [
  "Indexing Agent",
  "Triaging Agent",
  "ETL Agent",
  "Note Taking and Data Entry Agent",
  "Text Content Agent",
  "Automation Agent",
];

describe("SixAgentWorkflowRail", () => {
  it("renders all six official agents in fixed order with no runs at all", () => {
    render(<SixAgentWorkflowRail runs={[]} />);
    const rail = screen.getByRole("list", { name: "Six-Agent Workflow Rail" });
    const items = within(rail).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(OFFICIAL_NAMES_IN_ORDER[index]);
    });
  });

  it("renders agents without a run as waiting, never omitted", () => {
    const runs: AgentRunLike[] = [
      { agentId: "indexing_agent", status: "complete", outputSummary: "Labeled." },
      { agentId: "triaging_agent", status: "complete", outputSummary: "Classified." },
    ];
    render(<SixAgentWorkflowRail runs={runs} />);
    const rail = screen.getByRole("list", { name: "Six-Agent Workflow Rail" });
    expect(within(rail).getAllByRole("listitem")).toHaveLength(6);
    expect(within(rail).getAllByText("Waiting")).toHaveLength(4);
    expect(within(rail).getAllByText("Complete")).toHaveLength(2);
  });

  it("keeps blocked runs visible with their reason", () => {
    const runs: AgentRunLike[] = [
      {
        agentId: "etl_agent",
        status: "blocked",
        blockedReason: "Missing date range — clarification draft prepared.",
      },
    ];
    render(<SixAgentWorkflowRail runs={runs} />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(
      screen.getByText(/Missing date range — clarification draft prepared\./),
    ).toBeInTheDocument();
  });

  it("uses the exact official names from the agent theme registry", () => {
    render(<SixAgentWorkflowRail />);
    for (const name of OFFICIAL_NAMES_IN_ORDER) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});
