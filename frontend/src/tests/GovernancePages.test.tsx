import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { governanceApi } from "../api/client";
import { lisIrtDashboardApi } from "../api/lisIrtDashboard";
import type { AuditEvent } from "../api/types";
import { buildLisIrtDashboard } from "../mocks/lisIrtDashboardMock";
import AuditPage from "../pages/AuditPage";
import GovernanceInsightsPage from "../pages/GovernanceInsightsPage";
import WorkNeedingAttentionPage from "../pages/WorkNeedingAttentionPage";
import { AGENT_RAIL_ORDER, AGENT_THEME } from "../theme/agentTheme";

const OFFICIAL_NAMES = AGENT_RAIL_ORDER.map((id) => AGENT_THEME[id].officialName);

const AUDIT_EVENT: AuditEvent = {
  audit_event_id: "evt_g1",
  legal_request_id: "LER-2026-004812",
  timestamp: "2026-06-10T08:43:01Z",
  actor_type: "agent",
  actor_id: "triaging_agent",
  action: "request_classified",
  before_state: "request_validated",
  after_state: "request_validated",
  summary: "Triaging Agent classified the request.",
  evidence_ids: ["ROUTE-LOC-001"],
  confidence: 0.94,
  approval_id: null,
  correlation_id: null,
};

afterEach(() => vi.restoreAllMocks());

describe("GovernanceInsightsPage", () => {
  it("renders Trends by default and keeps Overview available for KPIs and attention preview", async () => {
    vi.spyOn(lisIrtDashboardApi, "getDashboard").mockResolvedValue(
      buildLisIrtDashboard(),
    );

    render(
      <MemoryRouter>
        <GovernanceInsightsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "LIS / IRT Vendor Analytics",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Trends" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    for (const tab of ["Overview", "Workload", "People", "Attention"]) {
      expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
    }
    expect(screen.getByRole("img", { name: "Median TAT trend" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Backlog and risk trend" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: /Volume In: 8,532/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Volume Out: 8,478/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Volume in versus volume out trend" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "SLO compliance trend" })).toBeInTheDocument();
    expect(screen.getByText("Attention Preview")).toBeInTheDocument();
    expect(screen.getAllByText("Emergency Response Requests E2E").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Queue Scanning - India/Indonesia").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Synthetic / mock data").length).toBeGreaterThan(0);
  });

  it("switches between Trends, Workload, People, and Attention sections", async () => {
    vi.spyOn(lisIrtDashboardApi, "getDashboard").mockResolvedValue(
      buildLisIrtDashboard(),
    );

    render(
      <MemoryRouter>
        <GovernanceInsightsPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", {
      name: "LIS / IRT Vendor Analytics",
    });

    expect(screen.getByRole("tab", { name: "Trends" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("img", { name: "Median TAT trend" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Backlog and risk trend" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Workload" }));
    expect(screen.getByText("SLO Boundary Status")).toBeInTheDocument();
    expect(screen.getByText("Workflow / Silo Distribution")).toBeInTheDocument();
    expect(screen.getByText("Workflow Category Mix")).toBeInTheDocument();
    expect(screen.getByText("Regional Breakdown")).toBeInTheDocument();
    expect(screen.getAllByText("At risk, not breached").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "People" }));
    expect(screen.getByText("Analyst Productivity")).toBeInTheDocument();
    expect(screen.getByText("Capacity Signals")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tickets \/ Analyst \/ Day:/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Attention" }));
    expect(screen.getAllByText("Work Needing Attention").length).toBeGreaterThan(1);
    expect(screen.getByText("Risk Drivers")).toBeInTheDocument();
    expect(screen.getAllByText("Emergency Response Requests E2E").length).toBeGreaterThan(0);
  });

  it("reloads visible data when a leadership filter changes", async () => {
    const spy = vi
      .spyOn(lisIrtDashboardApi, "getDashboard")
      .mockImplementation(async (filters) => buildLisIrtDashboard(filters));

    render(
      <MemoryRouter>
        <GovernanceInsightsPage />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Silo"), {
      target: { value: "Brazil" },
    });

    await waitFor(() =>
      expect(spy).toHaveBeenLastCalledWith(
        expect.objectContaining({ silo: "Brazil" }),
      ),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Workload" }));
    expect(
      await screen.findByRole("button", {
        name: (name) => name.startsWith("C E2E") && name.includes("Brazil"),
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Emergency Response Requests E2E/ }),
    ).not.toBeInTheDocument();
  });

  it("renders loading, error, and empty states", async () => {
    vi.spyOn(lisIrtDashboardApi, "getDashboard").mockReturnValueOnce(
      new Promise(() => undefined),
    );
    const { unmount } = render(
      <MemoryRouter>
        <GovernanceInsightsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("status", { name: "Loading LIS / IRT dashboard" }),
    ).toBeInTheDocument();
    unmount();

    vi.restoreAllMocks();
    vi.spyOn(lisIrtDashboardApi, "getDashboard").mockRejectedValueOnce(
      new Error("adapter unavailable"),
    );
    const errorRender = render(
      <MemoryRouter>
        <GovernanceInsightsPage />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText(/Could not load LIS \/ IRT governance data/),
    ).toBeInTheDocument();
    expect(screen.getByText(/adapter unavailable/)).toBeInTheDocument();
    errorRender.unmount();

    vi.restoreAllMocks();
    vi.spyOn(lisIrtDashboardApi, "getDashboard").mockResolvedValueOnce(
      buildLisIrtDashboard({ silo: "No matching silo" }),
    );
    render(
      <MemoryRouter>
        <GovernanceInsightsPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Overview" }));
    expect(
      await screen.findByText("No work needing attention matches selected filters."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Workload" }));
    expect(
      screen.getByText("No workflows match the selected filters."),
    ).toBeInTheDocument();
  });
});

describe("WorkNeedingAttentionPage", () => {
  it("renders prioritized attention cards with reason chips", async () => {
    vi.spyOn(governanceApi, "workNeedingAttention").mockResolvedValue({
      items: [
        {
          legal_request_id: "LER-2026-004835",
          workflow_state: "analyst_review_pending",
          reasons: ["pen_register", "sme_escalation_prepared"],
          priority: 100,
          related_agent_run_ids: ["run_a", "run_b"],
        },
      ],
    });

    render(
      <MemoryRouter>
        <WorkNeedingAttentionPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("LER-2026-004835")).toBeInTheDocument();
    expect(screen.getByText("Pen register")).toBeInTheDocument();
    expect(screen.getByText("Sme escalation prepared")).toBeInTheDocument();
    expect(screen.getByText("P100")).toBeInTheDocument();
    expect(screen.getByText("Responsible owner")).toBeInTheDocument();
    expect(screen.getAllByText("Triaging Agent").length).toBeGreaterThan(0);
    expect(screen.getByText("Review the prepared SME escalation")).toBeInTheDocument();
    expect(screen.getByText("Evidence: open request")).toBeInTheDocument();
    expect(screen.getByText("Audit: inspect trail")).toBeInTheDocument();
    expect(screen.getByText(/2 related agent runs/)).toBeInTheDocument();
  });
});

describe("AuditPage", () => {
  it("offers all six official agents as filters and queries the API with the selection", async () => {
    const spy = vi
      .spyOn(governanceApi, "auditEvents")
      .mockResolvedValue([
        {
          ...AUDIT_EVENT,
          summary:
            "Triaging Agent classified the request with a longer audit summary that should remain compact in the timeline card.",
          after_state: "route_recommended",
        },
      ]);

    render(
      <MemoryRouter>
        <AuditPage />
      </MemoryRouter>,
    );

    const select = await screen.findByLabelText("Filter by agent");
    for (const name of OFFICIAL_NAMES) {
      expect(
        within(select).getByRole("option", { name }),
      ).toBeInTheDocument();
    }
    expect(spy).toHaveBeenCalledWith({
      agent: undefined,
      actor_type: undefined,
      legal_request_id: undefined,
    });
    expect(
      await screen.findByText(/Triaging Agent classified the request/),
    ).toBeInTheDocument();
    expect(screen.getByText("Visible events")).toBeInTheDocument();
    expect(screen.getByText("Agent actions")).toBeInTheDocument();
    expect(screen.getByText("Request classified")).toBeInTheDocument();
    expect(screen.getAllByText("Triaging Agent").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Request validated to Route recommended"),
    ).toBeInTheDocument();
    expect(screen.getByText("Evidence: ROUTE-LOC-001")).toBeInTheDocument();

    const summary = screen.getByText(/longer audit summary/);
    expect(summary.className).toContain("cf-timeline__summary--clamp");

    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    expect(screen.getByText("Event id")).toBeInTheDocument();
    expect(
      screen.getAllByText("Request validated to Route recommended").length,
    ).toBeGreaterThan(1);
  });
});
