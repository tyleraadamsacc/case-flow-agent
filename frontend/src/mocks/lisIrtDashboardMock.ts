import type {
  AnalystProductivityPoint,
  DashboardFilterOptions,
  DashboardRiskLevel,
  DashboardSlaStatus,
  DailyOpsPoint,
  LeadershipHealth,
  LeadershipKpi,
  LisIrtDashboardFilters,
  LisIrtDashboardResponse,
  RegionalBreakdown,
  RiskDriver,
  SlaStatusBreakdown,
  WorkAttentionItem,
  WorkflowBreakdown,
} from "../api/types";

export interface LisIrtWorkflowBaseline {
  silo: string;
  workflow: string;
  tat: string;
  ahtMinutes: number | null;
  projectedWeeklyVolume: number;
  category: string;
}

export const lisIrtWorkflowBaselines: LisIrtWorkflowBaseline[] = [
  { silo: "Domestic Criminal", workflow: "Delayed User Notice", tat: "3 business days", ahtMinutes: 5, projectedWeeklyVolume: 1300, category: "Notice" },
  { silo: "Domestic Criminal", workflow: "Non Disclosure Order Extensions", tat: "1 business day", ahtMinutes: 10, projectedWeeklyVolume: 104, category: "Legal Process Review" },
  { silo: "Domestic Criminal", workflow: "LERS Creation", tat: "3 business days", ahtMinutes: 6, projectedWeeklyVolume: 25, category: "LERS" },
  { silo: "Domestic Criminal", workflow: "LERS Admin", tat: "3 business days", ahtMinutes: 4, projectedWeeklyVolume: 189, category: "LERS" },
  { silo: "Domestic Criminal", workflow: "LERS Help", tat: "3 business days", ahtMinutes: 4, projectedWeeklyVolume: 53, category: "LERS" },
  { silo: "Domestic Criminal", workflow: "Cases Routing", tat: "1 business day", ahtMinutes: 4, projectedWeeklyVolume: 850, category: "Routing" },
  { silo: "Domestic Criminal", workflow: "AB1242 Sweep", tat: "1 business day", ahtMinutes: 2, projectedWeeklyVolume: 50, category: "Notice" },
  { silo: "Domestic Criminal", workflow: "Uncategorized Matter Routing", tat: "4 business hours", ahtMinutes: 2, projectedWeeklyVolume: 186, category: "Routing" },
  { silo: "Domestic Criminal", workflow: "Proactive Comms", tat: "1 business day", ahtMinutes: 3, projectedWeeklyVolume: 50, category: "Comms" },
  { silo: "International Criminal non-Brazil", workflow: "Queue Scanning - non-India, non-Indonesia", tat: "24 hours", ahtMinutes: 2, projectedWeeklyVolume: 520, category: "Queue Scanning" },
  { silo: "International Criminal non-Brazil", workflow: "Matter Cleanup - Non-Urgent - Uncategorized Routing", tat: "5 days", ahtMinutes: 1, projectedWeeklyVolume: 200, category: "Matter Cleanup" },
  { silo: "International Criminal non-Brazil", workflow: "Matter Cleanup - Urgent - Uncategorized Routing", tat: "24 hours", ahtMinutes: 1, projectedWeeklyVolume: 150, category: "Matter Cleanup" },
  { silo: "International Criminal non-Brazil", workflow: "Matter Cleanup - Non-Urgent - Stale Matters", tat: "5 days", ahtMinutes: 10, projectedWeeklyVolume: 30, category: "Matter Cleanup" },
  { silo: "International Criminal non-Brazil", workflow: "Matter Cleanup - Non-Urgent - Stale Cases", tat: "5 days", ahtMinutes: 10, projectedWeeklyVolume: 175, category: "Matter Cleanup" },
  { silo: "International Criminal non-Brazil", workflow: "Workflow Segmentation Indexing", tat: "24 hours", ahtMinutes: 15, projectedWeeklyVolume: 35, category: "Indexing" },
  { silo: "International Criminal non-Brazil", workflow: "LERS Creation Self-Signup", tat: "24 hours", ahtMinutes: 27, projectedWeeklyVolume: 45, category: "LERS" },
  { silo: "International Criminal non-Brazil", workflow: "LERS Setup", tat: "24 hours", ahtMinutes: 6, projectedWeeklyVolume: 500, category: "LERS" },
  { silo: "International Criminal non-Brazil", workflow: "LERS Creation Manual", tat: "24 hours", ahtMinutes: 5, projectedWeeklyVolume: 150, category: "LERS" },
  { silo: "International Criminal non-Brazil", workflow: "LERS Help", tat: "24 hours", ahtMinutes: 3, projectedWeeklyVolume: 311, category: "LERS" },
  { silo: "International Criminal non-Brazil", workflow: "Preservations End-to-End", tat: "7 days", ahtMinutes: 28, projectedWeeklyVolume: 50, category: "Preservation" },
  { silo: "International Criminal non-Brazil", workflow: "Production End-to-End - Urgent", tat: "3 days", ahtMinutes: 18, projectedWeeklyVolume: 100, category: "Production" },
  { silo: "International Criminal non-Brazil", workflow: "Production End-to-End - Non-Urgent", tat: "14 days", ahtMinutes: 28, projectedWeeklyVolume: 90, category: "Production" },
  { silo: "International Criminal non-Brazil", workflow: "Waze Product Data Pulls", tat: "3 days", ahtMinutes: 36, projectedWeeklyVolume: 130, category: "Data Pull" },
  { silo: "International Criminal non-Brazil", workflow: "Non-Waze Product Data Pulls", tat: "3 days", ahtMinutes: 10, projectedWeeklyVolume: 9, category: "Data Pull" },
  { silo: "Brazil", workflow: "Cases Scanning and Indexing WFS", tat: "1 business day", ahtMinutes: 4, projectedWeeklyVolume: 198, category: "Indexing" },
  { silo: "Brazil", workflow: "NC E2E", tat: "Due date or 10 days", ahtMinutes: 9, projectedWeeklyVolume: 207, category: "Production" },
  { silo: "Brazil", workflow: "C E2E", tat: "Due date or 10 days", ahtMinutes: 34, projectedWeeklyVolume: 325, category: "Production" },
  { silo: "Brazil", workflow: "RLH", tat: "Due date or 10 days", ahtMinutes: 9, projectedWeeklyVolume: 18, category: "Production" },
  { silo: "Brazil", workflow: "Preservation E2E", tat: "Due date or 10 days", ahtMinutes: 8, projectedWeeklyVolume: 17, category: "Preservation" },
  { silo: "Brazil", workflow: "IntCiv E2E", tat: "Due date or 10 days", ahtMinutes: 7, projectedWeeklyVolume: 44, category: "Civil" },
  { silo: "Brazil", workflow: "Proxy Matters", tat: "1 business day", ahtMinutes: 9, projectedWeeklyVolume: 35, category: "Matter Split" },
  { silo: "Brazil", workflow: "Stale Cases", tat: "1 business day", ahtMinutes: 10, projectedWeeklyVolume: 125, category: "Matter Cleanup" },
  { silo: "Brazil", workflow: "LERS Admin", tat: "1 business day", ahtMinutes: 6, projectedWeeklyVolume: 110, category: "LERS" },
  { silo: "CPERT", workflow: "Queue Scanning - India/Indonesia", tat: "6 hours", ahtMinutes: 3, projectedWeeklyVolume: 850, category: "Queue Scanning" },
  { silo: "CPERT", workflow: "Waze Product Data Pulls - Emergency Requests", tat: "1 hour", ahtMinutes: 36, projectedWeeklyVolume: 5, category: "Emergency Data Pull" },
  { silo: "CPERT", workflow: "Non-Waze Product Data Pulls - Emergency Requests", tat: "1 hour", ahtMinutes: 10, projectedWeeklyVolume: 1, category: "Emergency Data Pull" },
  { silo: "CPERT", workflow: "Emergency Response Requests E2E", tat: "1 hour", ahtMinutes: 10, projectedWeeklyVolume: 570, category: "Emergency Response" },
  { silo: "CPERT", workflow: "PrOps Queue Scanning - non-Spam", tat: "24 hours", ahtMinutes: 2, projectedWeeklyVolume: 800, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Indexing - non-Spam", tat: "24 hours", ahtMinutes: 5, projectedWeeklyVolume: 289, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Queue Scanning - Spam", tat: "24 hours", ahtMinutes: 1, projectedWeeklyVolume: 250, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Account Recovery Requests", tat: "5 days", ahtMinutes: 4, projectedWeeklyVolume: 15, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Simple SARs", tat: "5 days", ahtMinutes: null, projectedWeeklyVolume: 125, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Complex SARs", tat: "5 days", ahtMinutes: 7, projectedWeeklyVolume: 103, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Removal Requests", tat: "5 days", ahtMinutes: 4, projectedWeeklyVolume: 9, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Erasure Requests", tat: "5 days", ahtMinutes: 2, projectedWeeklyVolume: 377, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Sale Opt Out Requests", tat: "5 days", ahtMinutes: 2, projectedWeeklyVolume: 0.5, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Support Requests", tat: "5 days", ahtMinutes: 3, projectedWeeklyVolume: 13, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Privacy Inquiry Requests", tat: "5 days", ahtMinutes: 8, projectedWeeklyVolume: 15, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Data Privacy Framework", tat: "5 days", ahtMinutes: 1, projectedWeeklyVolume: 0.5, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Data Protection Officer Requests", tat: "5 days", ahtMinutes: 1, projectedWeeklyVolume: 0.5, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "PrOps Call Recordings & Chat Transcripts", tat: "25 days", ahtMinutes: 13, projectedWeeklyVolume: 9, category: "Privacy Ops" },
  { silo: "CPERT", workflow: "DomCiv Indexing", tat: "24 hours", ahtMinutes: 37, projectedWeeklyVolume: 48, category: "Domestic Civil" },
  { silo: "CPERT", workflow: "DomCiv Routing", tat: "24 hours", ahtMinutes: 3, projectedWeeklyVolume: 429, category: "Domestic Civil" },
  { silo: "CPERT", workflow: "DomCiv Deceased", tat: "24 hours", ahtMinutes: 17, projectedWeeklyVolume: 110, category: "Domestic Civil" },
  { silo: "CPERT", workflow: "DomCiv Deceased Court Orders", tat: "24 hours", ahtMinutes: 25, projectedWeeklyVolume: 8, category: "Domestic Civil" },
  { silo: "CPERT", workflow: "DomCiv Litigation Preservations", tat: "24 hours", ahtMinutes: 5, projectedWeeklyVolume: 8, category: "Domestic Civil" },
  { silo: "CPERT", workflow: "DomCiv StreetView", tat: "24 hours", ahtMinutes: 180, projectedWeeklyVolume: 5, category: "Domestic Civil" },
  { silo: "CPERT", workflow: "IntCiv Queue Scanning & Indexing", tat: "24 hours", ahtMinutes: 12, projectedWeeklyVolume: 115, category: "International Civil" },
  { silo: "CPERT", workflow: "IntCiv Attorney Letters E2E", tat: "24 hours", ahtMinutes: 17, projectedWeeklyVolume: 10, category: "International Civil" },
  { silo: "CPERT", workflow: "IntCiv Inquiries E2E", tat: "24 hours", ahtMinutes: 2, projectedWeeklyVolume: 20, category: "International Civil" },
];

interface WorkflowOpsRecord extends LisIrtWorkflowBaseline {
  region: string;
  country: string;
  manager_region: string;
  manager_name: string;
  owner: string;
  platform: string;
  source: string;
  legal_process_type: string;
  nature_of_case: string;
  ticket_type: string;
  tags: string[];
  current_volume_in: number;
  current_volume_out: number;
  slo_compliance_percent: number;
  median_tat_hours: number;
  aging_hours: number;
  escalation_rate_percent: number;
  qa_score_percent: number;
  audit_rate_percent: number;
  risk_level: DashboardRiskLevel;
  sla_status: DashboardSlaStatus;
}

const VOLUME_IN_TARGET = 8532;
const VOLUME_OUT_TARGET = 8478;
const LATEST_COMPLETE_DAY = "2026-06-10";
const GENERATED_AT = "2026-06-11T14:30:00Z";

const SEEDED_RISKS: Record<
  string,
  Pick<WorkflowOpsRecord, "risk_level" | "slo_compliance_percent" | "aging_hours"> & {
    reason: string;
    action: string;
  }
> = {
  "Emergency Response Requests E2E": {
    risk_level: "critical",
    slo_compliance_percent: 92.4,
    aging_hours: 1.3,
    reason: "One-hour emergency TAT with elevated inbound pressure.",
    action: "Keep live manager monitoring until hourly queue clears.",
  },
  "Queue Scanning - India/Indonesia": {
    risk_level: "at_risk",
    slo_compliance_percent: 94.2,
    aging_hours: 5.7,
    reason: "High-volume six-hour queue is close to its TAT boundary.",
    action: "Rebalance first-pass scanning capacity for the next shift.",
  },
  "DomCiv StreetView": {
    risk_level: "at_risk",
    slo_compliance_percent: 91.8,
    aging_hours: 22.4,
    reason: "Low volume, but very high AHT creates specialist bottleneck risk.",
    action: "Assign specialist backup before additional StreetView work lands.",
  },
  "Production End-to-End - Urgent": {
    risk_level: "at_risk",
    slo_compliance_percent: 95.1,
    aging_hours: 34.6,
    reason: "Urgent production work has complex handling inside a three-day TAT.",
    action: "Review production owner capacity and expedite aging matters.",
  },
  "PrOps Erasure Requests": {
    risk_level: "watch",
    slo_compliance_percent: 96.2,
    aging_hours: 17.8,
    reason: "High-volume privacy workflow is trending above normal backlog.",
    action: "Add privacy queue coverage if backlog keeps rising tomorrow.",
  },
  "Cases Routing": {
    risk_level: "watch",
    slo_compliance_percent: 96.7,
    aging_hours: 9.4,
    reason: "Large routing queue is driving net inflow for Domestic Criminal.",
    action: "Move available routing analysts to intake during peak window.",
  },
};

const SILO_METADATA: Record<
  string,
  { region: string; country: string; manager_region: string; managers: string[] }
> = {
  "Domestic Criminal": {
    region: "North America",
    country: "United States",
    manager_region: "Americas",
    managers: ["Maya Chen", "Jordan Rivera", "Priya Shah"],
  },
  "International Criminal non-Brazil": {
    region: "EMEA / APAC",
    country: "Multi-country",
    manager_region: "International",
    managers: ["Noah Patel", "Avery Singh", "Elena Novak"],
  },
  Brazil: {
    region: "LATAM",
    country: "Brazil",
    manager_region: "Americas",
    managers: ["Luisa Costa", "Rafael Almeida"],
  },
  CPERT: {
    region: "Global Response",
    country: "Global",
    manager_region: "Global",
    managers: ["Samir Khan", "Tessa Morgan", "Camila Ortiz"],
  },
};

const CATEGORY_PROCESS_MAP: Record<string, string> = {
  Notice: "User notice",
  "Legal Process Review": "Court order",
  LERS: "LERS support",
  Routing: "Routing",
  Comms: "Communications",
  "Queue Scanning": "Queue triage",
  "Matter Cleanup": "Matter cleanup",
  Indexing: "Indexing",
  Preservation: "Preservation",
  Production: "Production",
  "Data Pull": "Data pull",
  Civil: "Civil process",
  "Matter Split": "Matter split",
  "Emergency Data Pull": "Emergency request",
  "Emergency Response": "Emergency request",
  "Privacy Ops": "Privacy request",
  "Domestic Civil": "Civil process",
  "International Civil": "Civil process",
};

const ALL_RECORDS = buildWorkflowRecords();
const ALL_DAILY_TRENDS = buildDailyTrends();

export function buildLisIrtDashboard(
  filters: LisIrtDashboardFilters = {},
): LisIrtDashboardResponse {
  const activeFilters = normalizeFilters(filters);
  const filteredRecords = filterRecords(ALL_RECORDS, activeFilters);
  const selectedShare =
    sumBy(filteredRecords, (record) => record.current_volume_in) /
    Math.max(sumBy(ALL_RECORDS, (record) => record.current_volume_in), 1);
  const dailyTrends = filterDailyTrends(ALL_DAILY_TRENDS, activeFilters).map(
    (point) => scaleDailyPoint(point, selectedShare),
  );
  const kpis = buildKpis(filteredRecords, dailyTrends);
  const riskDrivers = buildRiskDrivers(filteredRecords);

  return {
    freshness: {
      generated_at: GENERATED_AT,
      latest_complete_day: LATEST_COMPLETE_DAY,
      current_period_label: periodLabel(activeFilters.date_range),
      comparison_period_label: "Prior comparable period",
      source_label: "Synthetic LIS / IRT vendor analytics demo",
      data_confidence: "synthetic_mock",
      is_synthetic: true,
    },
    active_filters: activeFilters,
    filter_options: buildFilterOptions(ALL_RECORDS),
    health: buildHealth(kpis, riskDrivers),
    kpis,
    daily_trends: dailyTrends,
    sla_status_breakdown: buildSlaBreakdown(filteredRecords),
    workflow_breakdown: buildWorkflowBreakdown(filteredRecords),
    analyst_productivity: buildAnalystProductivity(filteredRecords, activeFilters),
    regional_breakdown: buildRegionalBreakdown(filteredRecords),
    work_attention: buildAttentionItems(filteredRecords),
  };
}

function buildWorkflowRecords(): WorkflowOpsRecord[] {
  const baselineTotal = sumBy(
    lisIrtWorkflowBaselines,
    (row) => row.projectedWeeklyVolume,
  );
  const inputVolumes = allocateByWeight(
    lisIrtWorkflowBaselines.map((row) => row.projectedWeeklyVolume / baselineTotal),
    VOLUME_IN_TARGET,
    1,
  );
  const initialRecords = lisIrtWorkflowBaselines.map((row, index) => {
    const meta = SILO_METADATA[row.silo];
    const manager = meta.managers[index % meta.managers.length];
    const risk = riskFor(row);
    const seeded = SEEDED_RISKS[row.workflow];
    const tatHours = estimatedTatHours(row, risk);
    const slo = seeded?.slo_compliance_percent ?? sloFor(row, risk);
    const source =
      row.silo === "Domestic Criminal"
        ? "LERS"
        : row.silo === "Brazil"
          ? "gCases"
          : row.category.includes("Privacy")
            ? "Privacy queue"
            : "IRT queue";
    return {
      ...row,
      region: meta.region,
      country: meta.country,
      manager_region: meta.manager_region,
      manager_name: manager,
      owner: `${manager.split(" ")[0].toLowerCase()}.ops`,
      platform: row.category.includes("Privacy") ? "Privacy Ops" : "LIS Console",
      source,
      legal_process_type: CATEGORY_PROCESS_MAP[row.category] ?? "Legal process",
      nature_of_case: natureFor(row),
      ticket_type: ticketTypeFor(row),
      tags: tagsFor(row),
      current_volume_in: inputVolumes[index],
      current_volume_out: 0,
      slo_compliance_percent: slo,
      median_tat_hours: tatHours,
      aging_hours: seeded?.aging_hours ?? agingFor(risk, tatHours),
      escalation_rate_percent: escalationFor(risk),
      qa_score_percent: qaFor(risk),
      audit_rate_percent: auditFor(row, risk),
      risk_level: risk,
      sla_status: slaStatusFor(slo, risk),
    };
  });
  const outputWeights = initialRecords.map((record) => {
    const efficiency =
      record.risk_level === "critical"
        ? 0.94
        : record.risk_level === "at_risk"
          ? 0.975
          : record.risk_level === "watch"
            ? 0.99
            : 1.0;
    return record.current_volume_in * efficiency;
  });
  const outputVolumes = allocateByWeight(outputWeights, VOLUME_OUT_TARGET, 0);
  return initialRecords.map((record, index) => ({
    ...record,
    current_volume_out: outputVolumes[index],
  }));
}

function buildDailyTrends(): DailyOpsPoint[] {
  const volumeIn = distributeDailyTotal(VOLUME_IN_TARGET, 30, 0.22);
  const volumeOut = distributeDailyTotal(VOLUME_OUT_TARGET, 30, 0.18).map(
    (value, index) => Math.max(0, value - (index > 22 ? 1 : 0)),
  );
  const outputAdjustment = VOLUME_OUT_TARGET - volumeOut.reduce((a, b) => a + b, 0);
  volumeOut[volumeOut.length - 1] += outputAdjustment;

  return volumeIn.map((value, index) => {
    const date = isoDateFromOffset(index);
    const netFlow = value - volumeOut[index];
    const latePeriodPressure = index > 22 ? 0.55 : 0;
    return {
      date,
      volume_in: value,
      volume_out: volumeOut[index],
      net_flow: netFlow,
      slo_compliance_percent: round1(98.2 - latePeriodPressure + Math.sin(index / 4) * 0.35),
      median_tat_hours: round2(11.7 + latePeriodPressure + Math.sin(index / 3) * 0.5),
      median_triage_hours: round2(1.72 + Math.cos(index / 5) * 0.16),
      backlog: Math.round(610 + index * 2.4 + Math.sin(index / 3) * 26),
      partner_controllable_backlog_percent: round1(7.4 + latePeriodPressure + Math.sin(index / 5) * 0.35),
      escalation_rate_percent: round1(6.9 + latePeriodPressure * 0.5 + Math.cos(index / 4) * 0.28),
      qa_score_percent: round1(93.6 - latePeriodPressure * 0.35 + Math.sin(index / 6) * 0.45),
      audit_rate_percent: round1(31.1 + Math.sin(index / 4) * 1.1),
    };
  });
}

function buildKpis(
  records: WorkflowOpsRecord[],
  dailyTrends: DailyOpsPoint[],
): LeadershipKpi[] {
  const volumeIn = sumBy(dailyTrends, (point) => point.volume_in);
  const volumeOut = sumBy(dailyTrends, (point) => point.volume_out);
  const netFlow = volumeIn - volumeOut;
  const slo = weightedAverage(records, (record) => record.slo_compliance_percent);
  const medianTat = median(dailyTrends.map((point) => point.median_tat_hours));
  const medianTriage = median(dailyTrends.map((point) => point.median_triage_hours));
  const claimTime = round2(8.82 * filterComplexityFactor(records));
  const productivity = round1(39 * filterProductivityFactor(records));
  const backlog = latest(dailyTrends)?.partner_controllable_backlog_percent ?? 0;
  const escalation = weightedAverage(records, (record) => record.escalation_rate_percent);
  const qaScore = weightedAverage(records, (record) => record.qa_score_percent);
  const auditRate = weightedAverage(records, (record) => record.audit_rate_percent);
  const analystsPerTicket = records.length === 0 ? 0 : 1.0;

  return [
    kpi("volume_in", "Volume In", volumeIn, "tickets", "healthy", null, null, volumeIn - 312, "Current-period intake", { title: "Volume In" }),
    kpi("volume_out", "Volume Out", volumeOut, "tickets", "healthy", null, null, volumeOut - 248, "Completed or routed out", { title: "Volume Out" }),
    kpi("net_flow", "Net Flow", netFlow, "tickets", netFlow > 0 ? "watch" : "healthy", 0, "Target: <= 0", netFlow - 106, "Inbound minus outbound", { title: "Net Flow" }),
    kpi("slo_compliance", "SLO Compliance", round1(slo), "percent", slo >= 90 ? "healthy" : "at_risk", 90, "Target >90%", round1(slo - 0.8), "Enterprise SLO compliance", { title: "SLO Compliance" }),
    kpi("median_tat", "Median TAT", round2(medianTat), "hours", medianTat <= 14 ? "healthy" : "watch", null, "12h 06m anchor", round2(medianTat + 0.4), "Median end-to-end TAT", { title: "Median TAT" }),
    kpi("median_triage_time", "Time in Triage", round2(medianTriage), "hours", "healthy", null, "1h 51m anchor", round2(medianTriage + 0.12), "Median time spent in triage", { title: "Time in Triage" }),
    kpi("median_claim_time", "Claim Time", claimTime, "hours", claimTime <= 9 ? "healthy" : "watch", null, "8h 49m anchor", round2(claimTime + 0.22), "Median claim time", { title: "Claim Time" }),
    kpi("tickets_per_analyst", "Tickets / Analyst / Day", productivity, "tickets_per_day", productivity >= 36 ? "healthy" : "watch", null, "Capacity calibration", round1(productivity - 1.4), "Median analyst productivity", { title: "Tickets / Analyst / Day" }),
    kpi("analysts_per_ticket", "Analysts / Ticket", analystsPerTicket, "ratio", "healthy", null, "Median 1.0", 1.1, "Median analysts touching a ticket", { title: "Analysts / Ticket" }),
    kpi("partner_controllable_backlog", "Partner Backlog", round1(backlog), "percent", backlog < 10 ? "healthy" : "at_risk", 10, "Target <10%", round1(backlog - 0.6), "Partner-controllable backlog", { title: "Partner Backlog" }),
    kpi("escalation_rate", "Escalation Rate", round1(escalation), "percent", escalation < 10 ? "healthy" : "at_risk", 10, "Target <10%", round1(escalation + 0.5), "Escalated work share", { title: "Escalation Rate" }),
    kpi("qa_score", "QA Score", round1(qaScore), "percent", qaScore > 90 ? "healthy" : "at_risk", 90, "Target >90%", round1(qaScore - 0.4), "Sampled quality score", { title: "QA Score" }),
    kpi("audit_rate", "Audit Coverage", round1(auditRate), "percent", auditRate >= 30 ? "healthy" : "watch", 30, "Target 30%", round1(auditRate - 1.6), "Audited ticket coverage", { title: "Audit Coverage" }),
  ];
}

function buildHealth(kpis: LeadershipKpi[], drivers: RiskDriver[]): LeadershipHealth {
  const slo = kpis.find((item) => item.metric_id === "slo_compliance")?.value ?? 0;
  const backlog =
    kpis.find((item) => item.metric_id === "partner_controllable_backlog")?.value ?? 0;
  const hasCritical = drivers.some((driver) => driver.severity === "critical");
  const status =
    slo < 90 || backlog >= 10
      ? "needs_intervention"
      : hasCritical || drivers.length > 0
        ? "at_risk"
        : "on_track";
  const narrative =
    status === "needs_intervention"
      ? "Needs intervention: at least one enterprise target is outside tolerance."
      : status === "at_risk"
        ? "At risk: headline targets are mostly healthy, but short-TAT and high-volume queues need active management."
        : "On track: core service health is inside target with no material risk drivers.";
  return {
    status,
    narrative,
    drivers: drivers.slice(0, 3),
  };
}

function buildRiskDrivers(records: WorkflowOpsRecord[]): RiskDriver[] {
  return records
    .filter((record) => record.risk_level === "critical" || record.risk_level === "at_risk")
    .sort((a, b) => riskRank(b.risk_level) - riskRank(a.risk_level) || b.current_volume_in - a.current_volume_in)
    .map((record) => ({
      driver_id: `driver:${record.workflow}`,
      title: record.workflow,
      description:
        SEEDED_RISKS[record.workflow]?.reason ??
        `${record.category} work is trending close to its ${record.tat} target.`,
      severity: record.risk_level,
      dimension: record.silo,
      value: record.current_volume_in,
      unit: "tickets",
    }));
}

function buildSlaBreakdown(records: WorkflowOpsRecord[]): SlaStatusBreakdown[] {
  const counts: Record<DashboardSlaStatus, number> = {
    met: 0,
    at_risk: 0,
    missed: 0,
    unknown: 0,
  };
  for (const record of records) {
    counts[record.sla_status] += record.current_volume_in;
  }
  const total = Math.max(Object.values(counts).reduce((sum, value) => sum + value, 0), 1);
  return (Object.keys(counts) as DashboardSlaStatus[]).map((status) => ({
    status,
    label: slaLabel(status),
    count: counts[status],
    percent: round1((counts[status] / total) * 100),
  }));
}

function buildWorkflowBreakdown(records: WorkflowOpsRecord[]): WorkflowBreakdown[] {
  const total = Math.max(sumBy(records, (record) => record.current_volume_in), 1);
  return records
    .map((record) => ({
      silo: record.silo,
      workflow: record.workflow,
      category: record.category,
      volume: record.current_volume_in,
      share_percent: round1((record.current_volume_in / total) * 100),
      slo_compliance_percent: record.slo_compliance_percent,
      median_tat_hours: record.median_tat_hours,
      risk_level: record.risk_level,
    }))
    .sort((a, b) => b.volume - a.volume);
}

function buildAnalystProductivity(
  records: WorkflowOpsRecord[],
  filters: LisIrtDashboardFilters,
): AnalystProductivityPoint[] {
  const managers = unique(records.map((record) => record.manager_name));
  const points = managers.map((manager, index) => {
    const managerRecords = records.filter((record) => record.manager_name === manager);
    const riskPressure = weightedAverage(managerRecords, (record) => riskRank(record.risk_level));
    const volume = sumBy(managerRecords, (record) => record.current_volume_in);
    const ticketsPerDay = round1(34 + (volume % 13) * 0.8 + (index % 3) * 1.6 - riskPressure * 1.1);
    const region = managerRecords[0]?.region ?? "Global Response";
    const riskLevel: DashboardRiskLevel =
      ticketsPerDay < 35 || riskPressure >= 3 ? "at_risk" : ticketsPerDay < 38 ? "watch" : "low";
    return {
      analyst_id: `analyst:${manager.toLowerCase().replace(/\s+/g, ".")}`,
      analyst_name: `${manager.split(" ")[0]} team`,
      manager_name: manager,
      region,
      tickets_per_day: ticketsPerDay,
      median_claim_hours: round2(8.2 + riskPressure * 0.35 + (index % 4) * 0.18),
      utilization_percent: round1(78 + riskPressure * 4 + (volume % 7)),
      risk_level: riskLevel,
    };
  });
  return points.filter(
    (point) =>
      !filters.manager_name ||
      filters.manager_name === "all" ||
      point.manager_name === filters.manager_name,
  );
}

function buildRegionalBreakdown(records: WorkflowOpsRecord[]): RegionalBreakdown[] {
  const grouped = groupBy(records, (record) => `${record.region}|${record.country}`);
  return Object.entries(grouped)
    .map(([key, group]) => {
      const [region, country] = key.split("|");
      const risk = group.reduce<DashboardRiskLevel>(
        (max, record) =>
          riskRank(record.risk_level) > riskRank(max) ? record.risk_level : max,
        "low",
      );
      return {
        region,
        country,
        volume_in: sumBy(group, (record) => record.current_volume_in),
        volume_out: sumBy(group, (record) => record.current_volume_out),
        slo_compliance_percent: round1(weightedAverage(group, (record) => record.slo_compliance_percent)),
        backlog: Math.max(0, sumBy(group, (record) => record.current_volume_in - record.current_volume_out)),
        risk_level: risk,
      };
    })
    .sort((a, b) => b.volume_in - a.volume_in);
}

function buildAttentionItems(records: WorkflowOpsRecord[]): WorkAttentionItem[] {
  return records
    .filter((record) => SEEDED_RISKS[record.workflow] || record.risk_level === "critical" || record.risk_level === "at_risk")
    .sort((a, b) => riskRank(b.risk_level) - riskRank(a.risk_level) || b.current_volume_in - a.current_volume_in)
    .slice(0, 8)
    .map((record) => ({
      item_id: `attention:${record.workflow}`,
      workflow: record.workflow,
      silo: record.silo,
      manager_name: record.manager_name,
      owner: record.owner,
      region: record.region,
      country: record.country,
      risk_level: record.risk_level,
      aging_hours: record.aging_hours,
      sla_status: record.sla_status,
      current_volume: record.current_volume_in,
      reason:
        SEEDED_RISKS[record.workflow]?.reason ??
        `${record.workflow} is carrying elevated aging against ${record.tat}.`,
      recommended_action:
        SEEDED_RISKS[record.workflow]?.action ??
        "Review staffing coverage and clear the oldest in-flight work first.",
    }));
}

function buildFilterOptions(records: WorkflowOpsRecord[]): DashboardFilterOptions {
  return {
    silos: unique(records.map((record) => record.silo)),
    workflow_categories: unique(records.map((record) => record.category)),
    workflows: unique(records.map((record) => record.workflow)),
    regions: unique(records.map((record) => record.region)),
    countries: unique(records.map((record) => record.country)),
    manager_regions: unique(records.map((record) => record.manager_region)),
    manager_names: unique(records.map((record) => record.manager_name)),
    owners: unique(records.map((record) => record.owner)),
    sla_statuses: ["met", "at_risk", "missed", "unknown"],
    risk_levels: ["low", "watch", "at_risk", "critical"],
    platforms: unique(records.map((record) => record.platform)),
    sources: unique(records.map((record) => record.source)),
    legal_process_types: unique(records.map((record) => record.legal_process_type)),
    nature_of_case: unique(records.map((record) => record.nature_of_case)),
    ticket_types: unique(records.map((record) => record.ticket_type)),
    tags: unique(records.flatMap((record) => record.tags)),
  };
}

function filterRecords(
  records: WorkflowOpsRecord[],
  filters: LisIrtDashboardFilters,
): WorkflowOpsRecord[] {
  return records.filter((record) => {
    return (
      matches(filters.silo, record.silo) &&
      matches(filters.workflow_category, record.category) &&
      matches(filters.workflow, record.workflow) &&
      matches(filters.region, record.region) &&
      matches(filters.manager_name, record.manager_name) &&
      matches(filters.sla_status, record.sla_status) &&
      matches(filters.risk_level, record.risk_level) &&
      matches(filters.platform, record.platform) &&
      matches(filters.source, record.source) &&
      matches(filters.legal_process_type, record.legal_process_type) &&
      matches(filters.nature_of_case, record.nature_of_case) &&
      matches(filters.ticket_type, record.ticket_type) &&
      matches(filters.country, record.country) &&
      matches(filters.manager_region, record.manager_region) &&
      matches(filters.owner, record.owner) &&
      (!filters.tags || filters.tags === "all" || record.tags.includes(filters.tags))
    );
  });
}

function filterDailyTrends(
  points: DailyOpsPoint[],
  filters: LisIrtDashboardFilters,
): DailyOpsPoint[] {
  const days = filters.date_range === "last_7_days" ? 7 : filters.date_range === "last_14_days" ? 14 : 30;
  return points.slice(-days);
}

function scaleDailyPoint(point: DailyOpsPoint, share: number): DailyOpsPoint {
  const safeShare = Number.isFinite(share) ? share : 0;
  return {
    ...point,
    volume_in: Math.round(point.volume_in * safeShare),
    volume_out: Math.round(point.volume_out * safeShare),
    net_flow: Math.round(point.net_flow * safeShare),
    backlog: Math.round(point.backlog * safeShare),
  };
}

function normalizeFilters(filters: LisIrtDashboardFilters): LisIrtDashboardFilters {
  return {
    date_range: filters.date_range ?? "last_30_days",
    silo: filters.silo ?? "all",
    workflow_category: filters.workflow_category ?? "all",
    workflow: filters.workflow ?? "all",
    region: filters.region ?? "all",
    manager_name: filters.manager_name ?? "all",
    sla_status: filters.sla_status ?? "all",
    risk_level: filters.risk_level ?? "all",
    platform: filters.platform ?? "all",
    source: filters.source ?? "all",
    legal_process_type: filters.legal_process_type ?? "all",
    nature_of_case: filters.nature_of_case ?? "all",
    ticket_type: filters.ticket_type ?? "all",
    country: filters.country ?? "all",
    tags: filters.tags ?? "all",
    manager_region: filters.manager_region ?? "all",
    owner: filters.owner ?? "all",
    partition_day: filters.partition_day,
    status_change_start: filters.status_change_start,
    status_change_end: filters.status_change_end,
  };
}

function kpi(
  metric_id: string,
  title: string,
  value: number,
  unit: LeadershipKpi["unit"],
  status: LeadershipKpi["status"],
  targetValue: number | null,
  targetLabel: string | null,
  previousValue: number | null,
  caption: string,
  drilldown: { title: string },
): LeadershipKpi {
  const delta = previousValue === null ? null : round2(value - previousValue);
  const deltaDirection = delta === null || Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
  return {
    metric_id,
    title,
    value,
    unit,
    status,
    target_value: targetValue,
    target_label: targetLabel,
    previous_value: previousValue,
    delta_value: delta,
    delta_direction: deltaDirection,
    caption,
    data_confidence: "synthetic_mock",
    drilldown_filter: { tags: drilldown.title },
  };
}

function estimatedTatHours(
  row: LisIrtWorkflowBaseline,
  risk: DashboardRiskLevel,
): number {
  const targetHours = parseTatHours(row.tat);
  const ahtPressure = Math.min((row.ahtMinutes ?? 6) / 45, 2.2);
  const riskPressure =
    risk === "critical" ? 1.35 : risk === "at_risk" ? 1.12 : risk === "watch" ? 0.92 : 0.68;
  return round2(Math.max(0.8, Math.min(targetHours * riskPressure + ahtPressure, 84)));
}

function parseTatHours(value: string): number {
  if (value.includes("1 hour")) {
    return 1;
  }
  if (value.includes("4 business hours")) {
    return 4;
  }
  if (value.includes("6 hours")) {
    return 6;
  }
  if (value.includes("24 hours") || value.includes("1 business day")) {
    return 24;
  }
  if (value.includes("3 business days") || value.includes("3 days")) {
    return 72;
  }
  if (value.includes("5 days")) {
    return 120;
  }
  if (value.includes("7 days")) {
    return 168;
  }
  if (value.includes("10 days") || value.includes("Due date")) {
    return 240;
  }
  if (value.includes("14 days")) {
    return 336;
  }
  if (value.includes("25 days")) {
    return 600;
  }
  return 24;
}

function riskFor(row: LisIrtWorkflowBaseline): DashboardRiskLevel {
  const seeded = SEEDED_RISKS[row.workflow]?.risk_level;
  if (seeded) {
    return seeded;
  }
  const targetHours = parseTatHours(row.tat);
  const aht = row.ahtMinutes ?? 6;
  if (targetHours <= 6 && row.projectedWeeklyVolume >= 300) {
    return "at_risk";
  }
  if (targetHours <= 24 && row.projectedWeeklyVolume >= 500) {
    return "watch";
  }
  if (aht >= 30 && row.projectedWeeklyVolume >= 40) {
    return "watch";
  }
  return "low";
}

function riskRank(value: DashboardRiskLevel): number {
  switch (value) {
    case "critical":
      return 4;
    case "at_risk":
      return 3;
    case "watch":
      return 2;
    default:
      return 1;
  }
}

function sloFor(row: LisIrtWorkflowBaseline, risk: DashboardRiskLevel): number {
  const base =
    risk === "critical"
      ? 92.5
      : risk === "at_risk"
        ? 95.2
        : risk === "watch"
          ? 96.8
          : 98.7;
  const volumeAdjustment = row.projectedWeeklyVolume > 700 ? -0.4 : 0;
  return round1(base + volumeAdjustment + ((row.workflow.length % 5) - 2) * 0.1);
}

function slaStatusFor(
  slo: number,
  risk: DashboardRiskLevel,
): DashboardSlaStatus {
  if (slo < 93 || risk === "critical") {
    return "missed";
  }
  if (slo < 97 || risk === "at_risk" || risk === "watch") {
    return "at_risk";
  }
  return "met";
}

function agingFor(risk: DashboardRiskLevel, tatHours: number): number {
  const pressure = riskRank(risk) / 4;
  return round1(Math.max(0.5, Math.min(tatHours * (0.12 + pressure * 0.18), 96)));
}

function escalationFor(risk: DashboardRiskLevel): number {
  return risk === "critical" ? 11.4 : risk === "at_risk" ? 8.8 : risk === "watch" ? 7.2 : 5.8;
}

function qaFor(risk: DashboardRiskLevel): number {
  return risk === "critical" ? 89.5 : risk === "at_risk" ? 91.8 : risk === "watch" ? 92.9 : 94.2;
}

function auditFor(row: LisIrtWorkflowBaseline, risk: DashboardRiskLevel): number {
  if (row.projectedWeeklyVolume > 700 && risk === "low") {
    return 27.5;
  }
  return risk === "critical" || risk === "at_risk" ? 35.2 : 31.2;
}

function natureFor(row: LisIrtWorkflowBaseline): string {
  if (row.category.includes("Emergency")) {
    return "Emergency disclosure";
  }
  if (row.category.includes("Privacy")) {
    return "Privacy rights request";
  }
  if (row.silo.includes("Criminal")) {
    return "Criminal investigation";
  }
  if (row.category.includes("Civil")) {
    return "Civil litigation";
  }
  return "Operational support";
}

function ticketTypeFor(row: LisIrtWorkflowBaseline): string {
  if (row.category.includes("Routing") || row.category.includes("Scanning")) {
    return "Triage";
  }
  if (row.category.includes("Production") || row.category.includes("Data Pull")) {
    return "Production";
  }
  if (row.category.includes("LERS")) {
    return "Account support";
  }
  return "Review";
}

function tagsFor(row: LisIrtWorkflowBaseline): string[] {
  const tags = [row.category, row.silo];
  if (row.tat.includes("1 hour") || row.tat.includes("6 hours")) {
    tags.push("short TAT");
  }
  if ((row.ahtMinutes ?? 0) >= 30) {
    tags.push("high AHT");
  }
  if (row.projectedWeeklyVolume >= 500) {
    tags.push("high volume");
  }
  return tags;
}

function distributeDailyTotal(total: number, days: number, variance: number): number[] {
  const weights = Array.from({ length: days }, (_, index) => {
    const weekdayPressure = index % 7 === 0 || index % 7 === 6 ? 0.82 : 1.05;
    const wave = 1 + Math.sin(index / 3.2) * variance + Math.cos(index / 5) * variance * 0.5;
    return Math.max(0.2, weekdayPressure * wave);
  });
  return allocateByWeight(weights, total, 0);
}

function allocateByWeight(weights: number[], total: number, minimum: number): number[] {
  const weightTotal = Math.max(weights.reduce((sum, value) => sum + value, 0), 1);
  const values = weights.map((weight) =>
    Math.max(minimum, Math.round((weight / weightTotal) * total)),
  );
  let adjustment = total - values.reduce((sum, value) => sum + value, 0);
  let index = 0;
  while (adjustment !== 0 && values.length > 0) {
    const direction = adjustment > 0 ? 1 : -1;
    const targetIndex = index % values.length;
    if (direction > 0 || values[targetIndex] > minimum) {
      values[targetIndex] += direction;
      adjustment -= direction;
    }
    index += 1;
  }
  return values;
}

function isoDateFromOffset(index: number): string {
  const date = new Date(Date.UTC(2026, 4, 12 + index));
  return date.toISOString().slice(0, 10);
}

function periodLabel(value: LisIrtDashboardFilters["date_range"]): string {
  switch (value) {
    case "last_7_days":
      return "Last 7 days ending Jun 10, 2026";
    case "last_14_days":
      return "Last 14 days ending Jun 10, 2026";
    default:
      return "Last 30 days ending Jun 10, 2026";
  }
}

function filterComplexityFactor(records: WorkflowOpsRecord[]): number {
  if (records.length === 0) {
    return 0;
  }
  const risk = weightedAverage(records, (record) => riskRank(record.risk_level));
  return Math.max(0.72, Math.min(1.32, 0.88 + risk * 0.08));
}

function filterProductivityFactor(records: WorkflowOpsRecord[]): number {
  if (records.length === 0) {
    return 0;
  }
  const highAhtShare =
    sumBy(records, (record) =>
      (record.ahtMinutes ?? 0) > 25 ? record.current_volume_in : 0,
    ) / Math.max(sumBy(records, (record) => record.current_volume_in), 1);
  return Math.max(0.78, 1 - highAhtShare * 0.28);
}

function matches(filterValue: string | undefined, value: string): boolean {
  return !filterValue || filterValue === "all" || filterValue === value;
}

function groupBy<T>(
  values: T[],
  keyFor: (value: T) => string,
): Record<string, T[]> {
  return values.reduce<Record<string, T[]>>((groups, value) => {
    const key = keyFor(value);
    groups[key] = groups[key] ?? [];
    groups[key].push(value);
    return groups;
  }, {});
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function sumBy<T>(values: T[], selector: (value: T) => number): number {
  return values.reduce((sum, value) => sum + selector(value), 0);
}

function weightedAverage(
  records: WorkflowOpsRecord[],
  selector: (record: WorkflowOpsRecord) => number,
): number {
  const denominator = sumBy(records, (record) => record.current_volume_in);
  if (denominator === 0) {
    return 0;
  }
  return round2(
    sumBy(records, (record) => selector(record) * record.current_volume_in) /
      denominator,
  );
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round2((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function latest<T>(values: T[]): T | undefined {
  return values[values.length - 1];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function slaLabel(status: DashboardSlaStatus): string {
  switch (status) {
    case "met":
      return "Within SLO";
    case "at_risk":
      return "At risk, not breached";
    case "missed":
      return "Breached";
    default:
      return "Unknown";
  }
}
