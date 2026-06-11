import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import type { AuditEvent } from "../api/types";
import RequestDetailPage from "../pages/RequestDetailPage";
import {
  makeAgentRun,
  makeLegalRequest,
  makeProductionPackage,
} from "./fixtures";

const OFFICIAL_NAMES = [
  "Indexing Agent",
  "Triaging Agent",
  "ETL Agent",
  "Note Taking and Data Entry Agent",
  "Text Content Agent",
  "Automation Agent",
];

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/requests/${id}`]}>
      <Routes>
        <Route path="/requests/:id" element={<RequestDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const AUDIT_EVENT: AuditEvent = {
  audit_event_id: "evt_test0001",
  legal_request_id: "LER-2026-004812",
  timestamp: "2026-06-10T08:43:01Z",
  actor_type: "agent",
  actor_id: "indexing_agent",
  action: "request_indexed",
  before_state: "request_validated",
  after_state: "request_validated",
  summary: "Indexing Agent labeled the request.",
  evidence_ids: [],
  confidence: 0.95,
  approval_id: null,
  correlation_id: null,
};

afterEach(() => vi.restoreAllMocks());

describe("RequestDetailPage", () => {
  it("renders the rail with all six official agents and live run data", async () => {
    const request = makeLegalRequest({
      agent_runs: {
        indexing_agent: makeAgentRun(),
        etl_agent: makeAgentRun({
          agent_id: "etl_agent",
          agent_name: "ETL Agent",
          status: "blocked",
          blocked_reason: "Missing date range blocks mock retrieval.",
          output_summary: "Mock retrieval halted pending clarification.",
          confidence: null,
          audit_event_id: "evt_test0002",
        }),
      },
    });
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(request);
    vi.spyOn(api, "auditTimeline").mockResolvedValue([AUDIT_EVENT]);

    renderDetail(request.legal_request_id);

    const rail = await screen.findByRole("list", {
      name: "Six-Agent Workflow Rail",
    });
    for (const name of OFFICIAL_NAMES) {
      expect(within(rail).getByText(name)).toBeInTheDocument();
    }
    // Live run data flows onto the cards; agents without runs are waiting.
    expect(within(rail).getByText("Labeled the request.")).toBeInTheDocument();
    expect(
      within(rail).getByText(/Missing date range blocks mock retrieval\./),
    ).toBeInTheDocument();
    expect(within(rail).getAllByText("Waiting")).toHaveLength(4);
    // The audit link resolves the event id to its action name.
    expect(
      within(rail).getByText("Audit: request_indexed"),
    ).toBeInTheDocument();
  });

  it("offers the five human review actions and no agent-side approval", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(makeLegalRequest());
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    expect(
      await screen.findByRole("button", { name: "Approve route" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request changes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Escalate to SME" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send to QA" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Finalize request" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("All decisions are made by a person"),
    ).toBeInTheDocument();
  });

  it("renders the response package with section provenance and pending statuses", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(
      makeLegalRequest({ production_package: makeProductionPackage() }),
    );
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    expect(
      await screen.findByText("PROD-LER-2026-004812-01"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Draft, pending analyst review · synthetic \/ mock data/),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft pending analyst review")).toBeInTheDocument();
    // Section provenance chips (scoped to the package — the rail also
    // shows the agents by name).
    const pkg = document.querySelector(".cf-package") as HTMLElement;
    expect(within(pkg).getByText("ETL Agent")).toBeInTheDocument();
    expect(within(pkg).getAllByText("Text Content Agent").length).toBeGreaterThan(0);
    // Synthetic record labeling on every record row.
    expect(within(pkg).getAllByText("synthetic_mock")).toHaveLength(2);
    expect(within(pkg).getByText("Draft pending approval")).toBeInTheDocument();
  });

  it("disables package drafting and explains why when a blocking deficiency exists", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(
      makeLegalRequest({
        agent_runs: { indexing_agent: makeAgentRun() },
        deficiency_findings: [
          {
            code: "missing_date_range",
            severity: "blocking",
            message: "Requested period missing.",
            requires_human_review: true,
            suggested_resolution: "Request a date range from the agency.",
            evidence_ids: [],
          },
        ],
      }),
    );
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    const draftButton = await screen.findByRole("button", {
      name: "Draft response package",
    });
    expect(draftButton).toBeDisabled();
    expect(
      screen.getByText("Package drafting blocked by deficiency"),
    ).toBeInTheDocument();
  });
});
