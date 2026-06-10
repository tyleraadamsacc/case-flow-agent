import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AgentRunCard from "../components/agents/AgentRunCard";

describe("AgentRunCard", () => {
  it("shows name, status, summary, confidence, evidence, audit, and review chip", () => {
    render(
      <AgentRunCard
        agentId="triaging_agent"
        agentName="Triaging Agent"
        ordinal={2}
        status="complete"
        roleDescription="Classifies the request and recommends a route for human approval."
        outputSummary="Classified as Location Data Production. Route: Location Response Review."
        confidence={0.94}
        evidenceIds={["ROUTE-LOC-001", "SOP-LOC-002"]}
        auditEventId="evt_abc123"
        auditAction="request_classified"
        requiresHumanReview
      />,
    );

    expect(screen.getByText("Triaging Agent")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(
      screen.getByText(/Classified as Location Data Production/),
    ).toBeInTheDocument();
    expect(screen.getByText("94% confidence")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAccessibleName("Confidence 94%");
    expect(screen.getByText("Evidence: 2")).toBeInTheDocument();
    expect(screen.getByText("Audit: request_classified")).toBeInTheDocument();
    expect(screen.getByText("Human review required")).toBeInTheDocument();
  });

  it("renders the blocked reason prominently when blocked", () => {
    render(
      <AgentRunCard
        agentId="etl_agent"
        agentName="ETL Agent"
        ordinal={3}
        status="blocked"
        blockedReason="Missing date range blocks mock retrieval."
      />,
    );
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(
      screen.getByText(/Missing date range blocks mock retrieval\./),
    ).toBeInTheDocument();
  });

  it("says so when there is no confidence score", () => {
    render(
      <AgentRunCard
        agentId="automation_agent"
        agentName="Automation Agent"
        ordinal={6}
        status="complete"
        confidence={null}
        outputSummary="Prepared approval task — pending analyst approval."
      />,
    );
    // confidence={null} renders nothing rather than a misleading 0% bar.
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("accepts confidence on the 0-100 scale", () => {
    render(
      <AgentRunCard
        agentId="indexing_agent"
        agentName="Indexing Agent"
        ordinal={1}
        status="complete"
        confidence={95}
      />,
    );
    expect(screen.getByText("95% confidence")).toBeInTheDocument();
  });

  it("omits evidence and audit links when there is nothing to link", () => {
    render(
      <AgentRunCard
        agentId="indexing_agent"
        agentName="Indexing Agent"
        ordinal={1}
        status="waiting"
      />,
    );
    expect(screen.queryByText(/Evidence:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Audit:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Human review required")).not.toBeInTheDocument();
  });
});
