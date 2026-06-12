import { describe, expect, it } from "vitest";

import { buildLisIrtDashboard } from "../mocks/lisIrtDashboardMock";

function kpiValue(title: string, dashboard = buildLisIrtDashboard()): number {
  const kpi = dashboard.kpis.find((item) => item.title === title);
  if (!kpi) {
    throw new Error(`Missing KPI ${title}`);
  }
  return kpi.value;
}

describe("buildLisIrtDashboard", () => {
  it("derives headline totals from the typed workflow baseline", () => {
    const dashboard = buildLisIrtDashboard();

    expect(dashboard.freshness.is_synthetic).toBe(true);
    expect(kpiValue("Volume In", dashboard)).toBe(8532);
    expect(kpiValue("Volume Out", dashboard)).toBe(8478);
    expect(kpiValue("Net Flow", dashboard)).toBe(54);
    expect(kpiValue("SLO Compliance", dashboard)).toBeGreaterThanOrEqual(96);
    expect(kpiValue("SLO Compliance", dashboard)).toBeLessThanOrEqual(99);
    expect(kpiValue("Tickets / Analyst / Day", dashboard)).toBeGreaterThanOrEqual(36);
    expect(kpiValue("Tickets / Analyst / Day", dashboard)).toBeLessThanOrEqual(40);
    expect(dashboard.daily_trends).toHaveLength(30);
  });

  it("filters records and derived sections by silo", () => {
    const all = buildLisIrtDashboard();
    const cpert = buildLisIrtDashboard({ silo: "CPERT" });

    expect(kpiValue("Volume In", cpert)).toBeLessThan(kpiValue("Volume In", all));
    expect(cpert.workflow_breakdown.length).toBeGreaterThan(0);
    expect(cpert.workflow_breakdown.every((row) => row.silo === "CPERT")).toBe(true);
    expect(cpert.regional_breakdown.every((row) => row.region === "Global Response")).toBe(true);
  });

  it("seeds the required leadership risk examples", () => {
    const dashboard = buildLisIrtDashboard();
    const riskWorkflows = dashboard.work_attention.map((item) => item.workflow);

    expect(riskWorkflows).toEqual(
      expect.arrayContaining([
        "Emergency Response Requests E2E",
        "Queue Scanning - India/Indonesia",
        "DomCiv StreetView",
        "Production End-to-End - Urgent",
        "PrOps Erasure Requests",
        "Cases Routing",
      ]),
    );
  });

  it("labels SLO boundary states without contradicting compliance KPIs", () => {
    const dashboard = buildLisIrtDashboard();

    expect(dashboard.sla_status_breakdown.map((item) => item.label)).toEqual(
      ["Within SLO", "At risk, not breached", "Breached", "Unknown"],
    );
  });
});
