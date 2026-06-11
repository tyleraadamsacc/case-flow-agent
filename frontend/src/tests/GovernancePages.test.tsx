import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { governanceApi } from "../api/client";
import type {
  AgentActivity,
  AuditEvent,
  GovernanceMetric,
} from "../api/types";
import AuditPage from "../pages/AuditPage";
import GovernanceInsightsPage from "../pages/GovernanceInsightsPage";
import WorkNeedingAttentionPage from "../pages/WorkNeedingAttentionPage";
import { AGENT_RAIL_ORDER, AGENT_THEME } from "../theme/agentTheme";

const OFFICIAL_NAMES = AGENT_RAIL_ORDER.map((id) => AGENT_THEME[id].officialName);

function metric(overrides: Partial<GovernanceMetric>): GovernanceMetric {
  return {
    metric_id: "metric:test",
    title: "Test metric",
    value: 1,
    unit: "count",
    dimension: null,
    period: null,
    data_confidence: "synthetic_mock",
    evidence_ids: [],
    ...overrides,
  };
}

function activity(overrides: Partial<AgentActivity>): AgentActivity {
  return {
    agent_id: "indexing_agent",
    agent_name: "Indexing Agent",
    runs_total: 3,
    runs_completed: 3,
    runs_blocked: 0,
    runs_needs_review: 0,
    runs_failed: 0,
    audit_events: 3,
    average_confidence: 0.93,
    requests_covered: ["LER-2026-004812"],
    data_confidence: "fully_tracked",
    ...overrides,
  };
}

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
  it("renders the RFP Agent Coverage module with all six official agents", async () => {
    vi.spyOn(governanceApi, "summary").mockResolvedValue({
      metrics: [metric({ metric_id: "metric:backlog", title: "Open backlog", value: 7 })],
    });
    vi.spyOn(governanceApi, "agentActivity").mockResolvedValue({
      agents: AGENT_RAIL_ORDER.map((id) =>
        activity({ agent_id: id, agent_name: AGENT_THEME[id].officialName }),
      ),
    });
    vi.spyOn(governanceApi, "productVolume").mockResolvedValue({
      metrics: [
        metric({
          metric_id: "product_volume:Maps / Location",
          title: "Requests touching Maps / Location",
          dimension: "product_domain",
          value: 5,
        }),
      ],
    });
    vi.spyOn(governanceApi, "processingTimeByProduct").mockResolvedValue({
      metrics: [],
    });
    vi.spyOn(governanceApi, "bottlenecks").mockResolvedValue({ metrics: [] });
    vi.spyOn(governanceApi, "responsePackageStatus").mockResolvedValue({
      metrics: [],
    });
    vi.spyOn(governanceApi, "auditReadiness").mockResolvedValue({
      requests_total: 8,
      requests_with_all_required_events: 1,
      coverage_percent: 12.5,
      missing_events_by_request: {},
      finalization_blocked_events: 0,
      data_confidence: "fully_tracked",
    });
    vi.spyOn(governanceApi, "workNeedingAttention").mockResolvedValue({
      items: [],
    });

    render(
      <MemoryRouter>
        <GovernanceInsightsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("RFP Agent Coverage")).toBeInTheDocument();
    for (const name of OFFICIAL_NAMES) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    // Data confidence is labeled, and the metric strip renders.
    expect(screen.getByText("Open backlog")).toBeInTheDocument();
    expect(screen.getAllByText("Synthetic / mock").length).toBeGreaterThan(0);
    expect(screen.getByText(/Executive view of request volume/)).toBeInTheDocument();
  });

  it("renders product-domain charts as a top-five ranked view first", async () => {
    vi.spyOn(governanceApi, "summary").mockResolvedValue({ metrics: [] });
    vi.spyOn(governanceApi, "agentActivity").mockResolvedValue({ agents: [] });
    vi.spyOn(governanceApi, "productVolume").mockResolvedValue({
      metrics: Array.from({ length: 6 }, (_, index) =>
        metric({
          metric_id: `product_volume:Domain ${index + 1}`,
          title: `Requests touching Domain ${index + 1}`,
          dimension: "product_domain",
          value: 6 - index,
        }),
      ),
    });
    vi.spyOn(governanceApi, "processingTimeByProduct").mockResolvedValue({
      metrics: [],
    });
    vi.spyOn(governanceApi, "bottlenecks").mockResolvedValue({ metrics: [] });
    vi.spyOn(governanceApi, "responsePackageStatus").mockResolvedValue({
      metrics: [],
    });
    vi.spyOn(governanceApi, "auditReadiness").mockResolvedValue({
      requests_total: 0,
      requests_with_all_required_events: 0,
      coverage_percent: 0,
      missing_events_by_request: {},
      finalization_blocked_events: 0,
      data_confidence: "fully_tracked",
    });
    vi.spyOn(governanceApi, "workNeedingAttention").mockResolvedValue({
      items: [],
    });

    render(
      <MemoryRouter>
        <GovernanceInsightsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Top product domains")).toBeInTheDocument();
    expect(screen.getByText("Domain 1")).toBeInTheDocument();
    expect(screen.getByText("Domain 5")).toBeInTheDocument();
    expect(screen.queryByText("Domain 6")).not.toBeInTheDocument();
    expect(screen.getByText("Show all 6 (1 more)")).toBeInTheDocument();
    expect(screen.getByText("Top 5 shown first")).toBeInTheDocument();
  });

  it("always shows all six agents even if the backend omits some", async () => {
    vi.spyOn(governanceApi, "summary").mockResolvedValue({ metrics: [] });
    vi.spyOn(governanceApi, "agentActivity").mockResolvedValue({
      agents: [activity({})], // only Indexing Agent reported
    });
    vi.spyOn(governanceApi, "productVolume").mockResolvedValue({ metrics: [] });
    vi.spyOn(governanceApi, "processingTimeByProduct").mockResolvedValue({
      metrics: [],
    });
    vi.spyOn(governanceApi, "bottlenecks").mockResolvedValue({ metrics: [] });
    vi.spyOn(governanceApi, "responsePackageStatus").mockResolvedValue({
      metrics: [],
    });
    vi.spyOn(governanceApi, "auditReadiness").mockResolvedValue({
      requests_total: 0,
      requests_with_all_required_events: 0,
      coverage_percent: 0,
      missing_events_by_request: {},
      finalization_blocked_events: 0,
      data_confidence: "fully_tracked",
    });
    vi.spyOn(governanceApi, "workNeedingAttention").mockResolvedValue({
      items: [],
    });

    render(
      <MemoryRouter>
        <GovernanceInsightsPage />
      </MemoryRouter>,
    );

    await screen.findByText("RFP Agent Coverage");
    for (const name of OFFICIAL_NAMES) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
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
