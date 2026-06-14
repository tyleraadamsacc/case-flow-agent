/** The Six-Agent Workflow Rail is the product's hard requirement: all six
 * RFP agents, by exact official name, in fixed order, always visible. */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Missing date range — clarification draft prepared\./),
    ).toBeInTheDocument();
  });

  it("uses the exact official names from the agent theme registry", () => {
    render(<SixAgentWorkflowRail />);
    const rail = screen.getByRole("list", { name: "Six-Agent Workflow Rail" });
    for (const name of OFFICIAL_NAMES_IN_ORDER) {
      expect(within(rail).getByText(name)).toBeInTheDocument();
    }
  });

  it("uses one focused command bar for rerun instructions", () => {
    const onRerunAgent = vi.fn();
    const runs: AgentRunLike[] = [
      {
        agentId: "triaging_agent",
        status: "complete",
        outputSummary: "Classified as Location Data Production.",
      },
    ];

    render(<SixAgentWorkflowRail runs={runs} onRerunAgent={onRerunAgent} />);

    fireEvent.click(screen.getByRole("button", { name: /Triaging Agent/ }));
    fireEvent.click(screen.getByRole("button", { name: "Request redraft" }));
    fireEvent.change(screen.getByLabelText(/Ask an agent to revise/i), {
      target: { value: "Re-check date range against request text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request redraft" }));

    expect(onRerunAgent).toHaveBeenCalledWith(
      "triaging_agent",
      "Re-check date range against request text",
    );
  });

  it("opens the command bar immediately when the guided step recommends it", () => {
    const runs: AgentRunLike[] = [
      {
        agentId: "triaging_agent",
        status: "complete",
        outputSummary: "Classified as Location Data Production.",
      },
    ];

    render(<SixAgentWorkflowRail runs={runs} agentCommandMode="recommended" />);

    expect(
      screen.getByRole("form", { name: "Agent review command bar" }),
    ).toBeInTheDocument();
  });
});
