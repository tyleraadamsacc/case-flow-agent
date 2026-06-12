import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { lisIrtDashboardApi } from "../api/lisIrtDashboard";
import type {
  DashboardFilterOptions,
  DashboardRiskLevel,
  DashboardSlaStatus,
  LeadershipHealthStatus,
  LeadershipKpi,
  LisIrtDashboardFilters,
  LisIrtDashboardResponse,
  RiskDriver,
  WorkAttentionItem,
} from "../api/types";
import {
  AnalystProductivityDistribution,
  formatCompact,
  formatHours,
  formatPercent,
  RegionalBreakdownCard,
  riskLabel,
  riskTone,
  SlaStatusDistribution,
  TrendChart,
  WorkflowCategoryBreakdown,
  WorkflowDistribution,
} from "../components/governance/LisIrtDashboardVisuals";
import ConsoleShell from "../components/layout/ConsoleShell";
import Card from "../components/ui/Card";
import Chip, { type ChipTone } from "../components/ui/Chip";
import StatusBadge from "../components/ui/StatusBadge";

type DashboardTab = "overview" | "trends" | "workload" | "people" | "attention";

interface DrilldownDetail {
  title: string;
  description: string;
  meta?: string;
}

const DEFAULT_TAB: DashboardTab = "trends";

const DEFAULT_FILTERS: LisIrtDashboardFilters = {
  date_range: "last_30_days",
  silo: "all",
  workflow_category: "all",
  workflow: "all",
  region: "all",
  manager_name: "all",
  sla_status: "all",
  risk_level: "all",
  platform: "all",
  source: "all",
  legal_process_type: "all",
  nature_of_case: "all",
  ticket_type: "all",
  country: "all",
  tags: "all",
  manager_region: "all",
  owner: "all",
};

const TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "trends", label: "Trends" },
  { id: "workload", label: "Workload" },
  { id: "people", label: "People" },
  { id: "attention", label: "Attention" },
];

const DATE_RANGE_OPTIONS: Array<{
  value: NonNullable<LisIrtDashboardFilters["date_range"]>;
  label: string;
}> = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_14_days", label: "Last 14 days" },
  { value: "last_30_days", label: "Last 30 days" },
];

const OVERVIEW_KPI_IDS = [
  "volume_in",
  "volume_out",
  "net_flow",
  "slo_compliance",
  "median_tat",
  "median_triage_time",
  "partner_controllable_backlog",
  "escalation_rate",
  "tickets_per_analyst",
  "qa_score",
];

const PEOPLE_KPI_IDS = [
  "tickets_per_analyst",
  "analysts_per_ticket",
  "median_claim_time",
  "median_triage_time",
];

const ATTENTION_KPI_IDS = [
  "partner_controllable_backlog",
  "escalation_rate",
  "audit_rate",
  "qa_score",
];

export default function GovernanceInsightsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const selectedTab: DashboardTab = isDashboardTab(tabParam)
    ? tabParam
    : DEFAULT_TAB;
  const [filters, setFilters] = useState<LisIrtDashboardFilters>(DEFAULT_FILTERS);
  const [data, setData] = useState<LisIrtDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    lisIrtDashboardApi
      .getDashboard(filters)
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setDrilldown(null);
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          const message =
            nextError instanceof Error
              ? nextError.message
              : "Unknown dashboard adapter failure";
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  const overviewKpis = useMemo(
    () => pickKpis(data?.kpis, OVERVIEW_KPI_IDS),
    [data?.kpis],
  );
  const peopleKpis = useMemo(
    () => pickKpis(data?.kpis, PEOPLE_KPI_IDS),
    [data?.kpis],
  );
  const attentionKpis = useMemo(
    () => pickKpis(data?.kpis, ATTENTION_KPI_IDS),
    [data?.kpis],
  );

  const handleFilterChange = (key: keyof LisIrtDashboardFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }) as LisIrtDashboardFilters);
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleTabChange = (tab: DashboardTab) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === DEFAULT_TAB) {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <ConsoleShell title="Governance">
      <div className="cf-lis-dashboard">
        {error ? (
          <Card title="Could not load LIS / IRT governance data" variant="soft">
            <p className="cf-lis-error">{error}</p>
          </Card>
        ) : null}

        {!data && isLoading ? <DashboardSkeleton /> : null}

        {data ? (
          <>
            <CommandHeader data={data} />
            <DashboardControls
              filters={filters}
              options={data.filter_options}
              selectedTab={selectedTab}
              onFilterChange={handleFilterChange}
              onReset={handleReset}
              onTabChange={handleTabChange}
            />
            <div className="cf-lis-tab-panels">
              {selectedTab === "overview" ? (
                <OverviewTab
                  data={data}
                  kpis={overviewKpis}
                  drilldown={drilldown}
                  onSelect={setDrilldown}
                />
              ) : null}
              {selectedTab === "trends" ? <TrendsTab data={data} /> : null}
              {selectedTab === "workload" ? (
                <WorkloadTab data={data} onSelect={setDrilldown} />
              ) : null}
              {selectedTab === "people" ? (
                <PeopleTab
                  data={data}
                  kpis={peopleKpis}
                  onSelect={setDrilldown}
                />
              ) : null}
              {selectedTab === "attention" ? (
                <AttentionTab
                  data={data}
                  kpis={attentionKpis}
                  onSelect={setDrilldown}
                />
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </ConsoleShell>
  );
}

function CommandHeader({ data }: { data: LisIrtDashboardResponse }) {
  const headlineKpis = pickKpis(data.kpis, [
    "slo_compliance",
    "net_flow",
    "volume_in",
    "volume_out",
    "partner_controllable_backlog",
    "escalation_rate",
  ]);

  return (
    <header
      className={`cf-lis-command-header cf-lis-command-header--${data.health.status}`}
    >
      <div className="cf-lis-command-header__main">
        <div className="cf-lis-command-header__eyebrow">
          <Chip tone={healthTone(data.health.status)} dot>
            {healthLabel(data.health.status)}
          </Chip>
          {data.freshness.is_synthetic ? (
            <Chip tone="violet">Synthetic / mock data</Chip>
          ) : null}
        </div>
        <h1>LIS / IRT Vendor Analytics</h1>
        <p>{data.health.narrative}</p>
        <div className="cf-lis-command-header__chips">
          <Chip tone="blue">{data.freshness.current_period_label}</Chip>
          <Chip tone="neutral">Data through {formatDateLong(data.freshness.latest_complete_day)}</Chip>
          <StatusBadge status={data.freshness.data_confidence} />
        </div>
        <HeaderMetricStrip kpis={headlineKpis} />
      </div>
      <div className="cf-lis-command-header__risk-card" aria-label="Top risk drivers">
        <span className="cf-lis-command-header__risk-label">Top risk drivers</span>
        {data.health.drivers.length > 0 ? (
          data.health.drivers.slice(0, 3).map((driver) => (
            <RiskDriverRow driver={driver} compact key={driver.driver_id} />
          ))
        ) : (
          <p>No material risk drivers in the selected period.</p>
        )}
      </div>
    </header>
  );
}

function HeaderMetricStrip({ kpis }: { kpis: LeadershipKpi[] }) {
  if (kpis.length === 0) {
    return null;
  }

  return (
    <div className="cf-lis-command-header__metrics" aria-label="Current operating snapshot">
      {kpis.map((kpi) => (
        <div className={`cf-lis-command-metric cf-lis-command-metric--${kpi.status}`} key={kpi.metric_id}>
          <span>{kpi.title}</span>
          <strong>{formatKpiValue(kpi)}</strong>
          <small>{kpi.target_label ?? kpi.caption}</small>
        </div>
      ))}
    </div>
  );
}

function DashboardControls({
  filters,
  options,
  selectedTab,
  onFilterChange,
  onReset,
  onTabChange,
}: {
  filters: LisIrtDashboardFilters;
  options: DashboardFilterOptions;
  selectedTab: DashboardTab;
  onFilterChange: (key: keyof LisIrtDashboardFilters, value: string) => void;
  onReset: () => void;
  onTabChange: (tab: DashboardTab) => void;
}) {
  return (
    <section className="cf-lis-controls" aria-label="Dashboard controls">
      <div className="cf-lis-controls__primary">
        <label className="cf-lis-filter">
          <span>Date range</span>
          <select
            value={filters.date_range ?? "last_30_days"}
            onChange={(event) => onFilterChange("date_range", event.target.value)}
          >
            {DATE_RANGE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <FilterSelect
          label="Silo"
          value={filters.silo}
          options={options.silos}
          onChange={(value) => onFilterChange("silo", value)}
        />
        <FilterSelect
          label="Category"
          value={filters.workflow_category}
          options={options.workflow_categories}
          onChange={(value) => onFilterChange("workflow_category", value)}
        />
        <FilterSelect
          label="Region"
          value={filters.region}
          options={options.regions}
          onChange={(value) => onFilterChange("region", value)}
        />
        <FilterSelect
          label="Manager"
          value={filters.manager_name}
          options={options.manager_names}
          onChange={(value) => onFilterChange("manager_name", value)}
        />
        <FilterSelect
          label="Risk"
          value={filters.risk_level}
          options={options.risk_levels}
          optionLabel={(value) =>
            value === "all" ? "All risks" : riskLabel(value as DashboardRiskLevel)
          }
          onChange={(value) => onFilterChange("risk_level", value)}
        />
        <button
          className="cf-lis-controls__reset"
          type="button"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
      <div className="cf-lis-controls__nav-row">
        <nav className="cf-lis-tabs" aria-label="Dashboard sections" role="tablist">
          {TABS.map((tab) => (
            <button
              aria-controls={`lis-panel-${tab.id}`}
              aria-selected={selectedTab === tab.id}
              className="cf-lis-tab"
              id={`lis-tab-${tab.id}`}
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <details className="cf-lis-controls__more">
          <summary>More filters</summary>
          <div className="cf-lis-controls__advanced">
            <FilterSelect
              label="Workflow"
              value={filters.workflow}
              options={options.workflows}
              onChange={(value) => onFilterChange("workflow", value)}
            />
            <FilterSelect
              label="SLO status"
              value={filters.sla_status}
              options={options.sla_statuses}
              optionLabel={(value) =>
                value === "all"
                  ? "All SLO states"
                  : slaStatusLabel(value as DashboardSlaStatus)
              }
              onChange={(value) => onFilterChange("sla_status", value)}
            />
            <FilterSelect
              label="Platform"
              value={filters.platform}
              options={options.platforms}
              onChange={(value) => onFilterChange("platform", value)}
            />
            <FilterSelect
              label="Source"
              value={filters.source}
              options={options.sources}
              onChange={(value) => onFilterChange("source", value)}
            />
            <FilterSelect
              label="Legal process"
              value={filters.legal_process_type}
              options={options.legal_process_types}
              onChange={(value) => onFilterChange("legal_process_type", value)}
            />
            <FilterSelect
              label="Nature of case"
              value={filters.nature_of_case}
              options={options.nature_of_case}
              onChange={(value) => onFilterChange("nature_of_case", value)}
            />
            <FilterSelect
              label="Ticket type"
              value={filters.ticket_type}
              options={options.ticket_types}
              onChange={(value) => onFilterChange("ticket_type", value)}
            />
            <FilterSelect
              label="Country"
              value={filters.country}
              options={options.countries}
              onChange={(value) => onFilterChange("country", value)}
            />
            <FilterSelect
              label="Tags"
              value={filters.tags}
              options={options.tags}
              onChange={(value) => onFilterChange("tags", value)}
            />
            <FilterSelect
              label="Manager region"
              value={filters.manager_region}
              options={options.manager_regions}
              onChange={(value) => onFilterChange("manager_region", value)}
            />
            <FilterSelect
              label="Owner"
              value={filters.owner}
              options={options.owners}
              onChange={(value) => onFilterChange("owner", value)}
            />
          </div>
        </details>
      </div>
    </section>
  );
}

function OverviewTab({
  data,
  kpis,
  drilldown,
  onSelect,
}: {
  data: LisIrtDashboardResponse;
  kpis: LeadershipKpi[];
  drilldown: DrilldownDetail | null;
  onSelect: (detail: DrilldownDetail) => void;
}) {
  return (
    <section
      aria-labelledby="lis-tab-overview"
      className="cf-lis-tab-panel"
      id="lis-panel-overview"
      role="tabpanel"
    >
      <KpiGrid kpis={kpis} onSelect={onSelect} variant="overview" />
      <div className="cf-lis-overview-grid">
        <WorkAttentionList
          items={data.work_attention}
          limit={3}
          onSelect={onSelect}
          title="Attention Preview"
          subtitle="Highest-priority workflows for leadership review."
          compact
        />
        <div className="cf-lis-overview-side">
          <TrendChart
            ariaLabel="Volume in versus volume out trend"
            compact
            points={data.daily_trends}
            series={[
              {
                id: "volume_in",
                label: "Volume In",
                color: "#1a73e8",
                value: (point) => point.volume_in,
              },
              {
                id: "volume_out",
                label: "Volume Out",
                color: "#00acc1",
                value: (point) => point.volume_out,
              },
            ]}
            subtitle="Inbound and output pace for the selected period."
            title="Volume In vs Out"
          />
          <TrendChart
            ariaLabel="SLO compliance trend"
            compact
            points={data.daily_trends}
            series={[
              {
                id: "slo",
                label: "SLO Compliance",
                color: "#34a853",
                value: (point) => point.slo_compliance_percent,
              },
            ]}
            subtitle="Enterprise target line at 90%."
            target={90}
            targetLabel="90% target"
            title="SLO Compliance"
            valueFormatter={formatPercent}
            yDomain={[90, 100]}
            yTicks={[100, 95, 90]}
          />
        </div>
      </div>
      <FocusPanel data={data} detail={drilldown} />
    </section>
  );
}

function TrendsTab({ data }: { data: LisIrtDashboardResponse }) {
  return (
    <section
      aria-labelledby="lis-tab-trends"
      className="cf-lis-tab-panel"
      id="lis-panel-trends"
      role="tabpanel"
    >
      <div className="cf-lis-section-grid">
        <TrendChart
          ariaLabel="Volume in versus volume out trend"
          points={data.daily_trends}
          series={[
            {
              id: "volume_in",
              label: "Volume In",
              color: "#1a73e8",
              value: (point) => point.volume_in,
            },
            {
              id: "volume_out",
              label: "Volume Out",
              color: "#00acc1",
              value: (point) => point.volume_out,
            },
          ]}
          subtitle="Daily intake compared with completed or routed-out work."
          title="Volume In vs Volume Out"
        />
        <TrendChart
          ariaLabel="SLO compliance trend"
          points={data.daily_trends}
          series={[
            {
              id: "slo",
              label: "SLO Compliance",
              color: "#34a853",
              value: (point) => point.slo_compliance_percent,
            },
          ]}
          subtitle="Scaled to the operational decision band instead of zero."
          target={90}
          targetLabel="90% target"
          title="SLO Compliance Trend"
          valueFormatter={formatPercent}
          yDomain={[90, 100]}
          yTicks={[100, 95, 90]}
        />
        <TrendChart
          ariaLabel="Median TAT trend"
          points={data.daily_trends}
          series={[
            {
              id: "tat",
              label: "Median TAT",
              color: "#7c4dff",
              value: (point) => point.median_tat_hours,
            },
          ]}
          subtitle="Median end-to-end turnaround time."
          target={12}
          targetLabel="12h anchor"
          title="Median TAT Trend"
          valueFormatter={formatHours}
          yDomain={[0, 16]}
          yTicks={[16, 8, 0]}
        />
        <TrendChart
          ariaLabel="Backlog and risk trend"
          points={data.daily_trends}
          series={[
            {
              id: "backlog",
              label: "Partner Backlog",
              color: "#f9ab00",
              value: (point) => point.partner_controllable_backlog_percent,
            },
            {
              id: "escalation",
              label: "Escalation Rate",
              color: "#d93025",
              value: (point) => point.escalation_rate_percent,
            },
          ]}
          subtitle="Backlog and escalation pressure against operating targets."
          target={10}
          targetLabel="10% ceiling"
          title="Backlog / Risk Trend"
          valueFormatter={formatPercent}
          yDomain={[0, 12]}
          yTicks={[12, 6, 0]}
        />
      </div>
    </section>
  );
}

function WorkloadTab({
  data,
  onSelect,
}: {
  data: LisIrtDashboardResponse;
  onSelect: (detail: DrilldownDetail) => void;
}) {
  return (
    <section
      aria-labelledby="lis-tab-workload"
      className="cf-lis-tab-panel"
      id="lis-panel-workload"
      role="tabpanel"
    >
      <div className="cf-lis-workload-grid">
        <SlaStatusDistribution
          items={data.sla_status_breakdown}
          onSelect={onSelect}
        />
        <WorkflowDistribution
          items={data.workflow_breakdown}
          onSelect={onSelect}
        />
        <WorkflowCategoryBreakdown
          items={data.workflow_breakdown}
          onSelect={onSelect}
        />
        <RegionalBreakdownCard
          items={data.regional_breakdown}
          onSelect={onSelect}
        />
      </div>
      <FocusPanel data={data} />
    </section>
  );
}

function PeopleTab({
  data,
  kpis,
  onSelect,
}: {
  data: LisIrtDashboardResponse;
  kpis: LeadershipKpi[];
  onSelect: (detail: DrilldownDetail) => void;
}) {
  return (
    <section
      aria-labelledby="lis-tab-people"
      className="cf-lis-tab-panel"
      id="lis-panel-people"
      role="tabpanel"
    >
      <KpiGrid kpis={kpis} onSelect={onSelect} variant="compact" />
      <div className="cf-lis-people-grid">
        <AnalystProductivityDistribution
          items={data.analyst_productivity}
          onSelect={onSelect}
        />
        <CapacitySignals data={data} />
      </div>
    </section>
  );
}

function AttentionTab({
  data,
  kpis,
  onSelect,
}: {
  data: LisIrtDashboardResponse;
  kpis: LeadershipKpi[];
  onSelect: (detail: DrilldownDetail) => void;
}) {
  return (
    <section
      aria-labelledby="lis-tab-attention"
      className="cf-lis-tab-panel"
      id="lis-panel-attention"
      role="tabpanel"
    >
      <KpiGrid kpis={kpis} onSelect={onSelect} variant="compact" />
      <div className="cf-lis-attention-grid">
        <WorkAttentionList
          items={data.work_attention}
          onSelect={onSelect}
          title="Work Needing Attention"
          subtitle="Full leadership worklist with recommended action."
        />
        <div className="cf-lis-attention-side">
          <RiskDriversPanel drivers={data.health.drivers} />
          <TrendChart
            ariaLabel="Backlog and risk trend"
            compact
            points={data.daily_trends}
            series={[
              {
                id: "backlog",
                label: "Partner Backlog",
                color: "#f9ab00",
                value: (point) => point.partner_controllable_backlog_percent,
              },
              {
                id: "escalation",
                label: "Escalation Rate",
                color: "#d93025",
                value: (point) => point.escalation_rate_percent,
              },
            ]}
            subtitle="Current pressure against backlog and escalation targets."
            target={10}
            targetLabel="10% ceiling"
            title="Escalation / Backlog Signal"
            valueFormatter={formatPercent}
            yDomain={[0, 12]}
            yTicks={[12, 6, 0]}
          />
        </div>
      </div>
    </section>
  );
}

function KpiGrid({
  kpis,
  onSelect,
  variant,
}: {
  kpis: LeadershipKpi[];
  onSelect: (detail: DrilldownDetail) => void;
  variant: "overview" | "compact";
}) {
  return (
    <section
      aria-label="Leadership KPIs"
      className={`cf-lis-kpi-grid cf-lis-kpi-grid--${variant}`}
    >
      {kpis.map((kpi) => (
        <KpiCard key={kpi.metric_id} kpi={kpi} onSelect={onSelect} />
      ))}
    </section>
  );
}

function KpiCard({
  kpi,
  onSelect,
}: {
  kpi: LeadershipKpi;
  onSelect: (detail: DrilldownDetail) => void;
}) {
  return (
    <button
      aria-label={`${kpi.title}: ${formatKpiValue(kpi)}`}
      className={`cf-card cf-lis-kpi cf-lis-kpi--${kpi.status}`}
      onClick={() =>
        onSelect({
          title: kpi.title,
          description: kpi.caption,
          meta: kpi.target_label ?? undefined,
        })
      }
      type="button"
    >
      <span className="cf-lis-kpi__header">
        <span>{kpi.title}</span>
        <Chip tone={kpiStatusTone(kpi.status)}>{kpiStatusLabel(kpi.status)}</Chip>
      </span>
      <strong>{formatKpiValue(kpi)}</strong>
      <p>{kpi.caption}</p>
      <span className="cf-lis-kpi__footer">
        <span>{kpi.target_label ?? "Monitor"}</span>
        <span className={`cf-lis-kpi__delta cf-lis-kpi__delta--${kpi.delta_direction}`}>
          {formatDelta(kpi)}
        </span>
      </span>
    </button>
  );
}

function WorkAttentionList({
  items,
  title,
  subtitle,
  onSelect,
  limit,
  compact = false,
}: {
  items: WorkAttentionItem[];
  title: string;
  subtitle: string;
  onSelect: (detail: DrilldownDetail) => void;
  limit?: number;
  compact?: boolean;
}) {
  const visibleItems = typeof limit === "number" ? items.slice(0, limit) : items;

  return (
    <Card
      className={`cf-lis-worklist${compact ? " cf-lis-worklist--compact" : ""}`}
      title={title}
      subtitle={subtitle}
    >
      {visibleItems.length === 0 ? (
        <div className="cf-lis-empty">
          <span className="cf-lis-empty__mark" aria-hidden="true" />
          <p>No work needing attention matches selected filters.</p>
        </div>
      ) : (
        <div className="cf-lis-worklist__items">
          {visibleItems.map((item) => (
            <button
              className={`cf-lis-workitem cf-lis-workitem--${item.risk_level}`}
              key={item.item_id}
              onClick={() =>
                onSelect({
                  title: item.workflow,
                  description: item.reason,
                  meta: item.recommended_action,
                })
              }
              type="button"
            >
              <span className="cf-lis-workitem__topline">
                <span>
                  <strong>{item.workflow}</strong>
                  <Chip tone={riskTone(item.risk_level)}>
                    {riskLabel(item.risk_level)}
                  </Chip>
                </span>
                <Chip tone={slaStatusTone(item.sla_status)}>
                  {slaStatusLabel(item.sla_status)}
                </Chip>
              </span>
              <span className="cf-lis-workitem__meta">
                {item.silo} / {item.region} / {item.country}
              </span>
              <span className="cf-lis-workitem__facts">
                <span>{formatHours(item.aging_hours)} aging</span>
                <span>{formatCompact(item.current_volume)} tickets</span>
                <span>{item.manager_name}</span>
                <span>{item.owner}</span>
              </span>
              <span className="cf-lis-workitem__reason">{item.reason}</span>
              <span className="cf-lis-workitem__action">
                {item.recommended_action}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function RiskDriversPanel({ drivers }: { drivers: RiskDriver[] }) {
  return (
    <Card
      className="cf-lis-risk-panel"
      title="Risk Drivers"
      subtitle="Drivers behind the current leadership health state."
    >
      {drivers.length === 0 ? (
        <div className="cf-lis-empty">
          <span className="cf-lis-empty__mark" aria-hidden="true" />
          <p>No active risk drivers in the selected period.</p>
        </div>
      ) : (
        <div className="cf-lis-risk-panel__list">
          {drivers.map((driver) => (
            <RiskDriverRow driver={driver} key={driver.driver_id} />
          ))}
        </div>
      )}
    </Card>
  );
}

function RiskDriverRow({
  driver,
  compact = false,
}: {
  driver: RiskDriver;
  compact?: boolean;
}) {
  return (
    <div
      className={`cf-lis-risk-driver${compact ? " cf-lis-risk-driver--compact" : ""}`}
    >
      <Chip tone={riskTone(driver.severity)}>{riskLabel(driver.severity)}</Chip>
      <strong>{driver.title}</strong>
      <span>
        {driver.description} {formatCompact(driver.value)} {unitLabel(driver.unit)}.
      </span>
    </div>
  );
}

function CapacitySignals({ data }: { data: LisIrtDashboardResponse }) {
  const ticketsPerAnalyst = findKpi(data.kpis, "tickets_per_analyst");
  const analystsPerTicket = findKpi(data.kpis, "analysts_per_ticket");
  const claimTime = findKpi(data.kpis, "median_claim_time");
  const outputCapacity = findKpi(data.kpis, "volume_out");

  return (
    <Card
      className="cf-lis-capacity-card"
      title="Capacity Signals"
      subtitle="Staffing and productivity indicators for the current demand mix."
    >
      <dl className="cf-lis-signal-list">
        <SignalRow
          label="Tickets per analyst per day"
          value={ticketsPerAnalyst ? formatKpiValue(ticketsPerAnalyst) : "0"}
          note="Current productivity anchor around 39."
        />
        <SignalRow
          label="Analysts per ticket"
          value={analystsPerTicket ? formatKpiValue(analystsPerTicket) : "0"}
          note="Lower handoff count supports cleaner cycle time."
        />
        <SignalRow
          label="Median claim time"
          value={claimTime ? formatKpiValue(claimTime) : "0h"}
          note="Claim latency before active triage."
        />
        <SignalRow
          label="Output capacity"
          value={outputCapacity ? formatKpiValue(outputCapacity) : "0"}
          note="Target calibration pending 2 to 3 months after workflow adoption."
        />
      </dl>
    </Card>
  );
}

function SignalRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="cf-lis-signal-row">
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
        <span>{note}</span>
      </dd>
    </div>
  );
}

function FocusPanel({
  data,
  detail,
}: {
  data: LisIrtDashboardResponse;
  detail?: DrilldownDetail | null;
}) {
  const fallback = data.health.drivers[0];
  const title = detail?.title ?? fallback?.title ?? "No selected focus";
  const description =
    detail?.description ??
    fallback?.description ??
    "Select a KPI, chart segment, or work item to inspect details.";
  const meta =
    detail?.meta ??
    (fallback
      ? `${fallback.dimension} / ${formatCompact(fallback.value)} ${unitLabel(fallback.unit)}`
      : data.freshness.source_label);

  return (
    <Card
      className="cf-lis-focus-panel"
      title="Selected Focus"
      subtitle="Click a metric or distribution row to update this summary."
    >
      <strong>{title}</strong>
      <p>{description}</p>
      <div className="cf-lis-drilldown__facts">
        <Chip tone="blue">{meta}</Chip>
        <Chip tone="neutral">{data.freshness.comparison_period_label}</Chip>
      </div>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  optionLabel,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (value: string) => void;
  optionLabel?: (value: string) => string;
}) {
  return (
    <label className="cf-lis-filter">
      <span>{label}</span>
      <select value={value ?? "all"} onChange={(event) => onChange(event.target.value)}>
        <option value="all">{optionLabel?.("all") ?? `All ${label.toLowerCase()}`}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel?.(option) ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DashboardSkeleton() {
  return (
    <Card>
      <div
        aria-label="Loading LIS / IRT dashboard"
        className="cf-skeleton cf-skeleton--panel"
        role="status"
      />
    </Card>
  );
}

function pickKpis(
  kpis: LeadershipKpi[] | undefined,
  ids: string[],
): LeadershipKpi[] {
  if (!kpis) {
    return [];
  }
  return ids
    .map((id) => kpis.find((kpi) => kpi.metric_id === id))
    .filter((kpi): kpi is LeadershipKpi => Boolean(kpi));
}

function findKpi(kpis: LeadershipKpi[], id: string): LeadershipKpi | undefined {
  return kpis.find((kpi) => kpi.metric_id === id);
}

function isDashboardTab(value: string | null): value is DashboardTab {
  return TABS.some((tab) => tab.id === value);
}

function healthLabel(status: LeadershipHealthStatus): string {
  switch (status) {
    case "on_track":
      return "On track";
    case "needs_intervention":
      return "Needs intervention";
    default:
      return "At risk";
  }
}

function healthTone(status: LeadershipHealthStatus): ChipTone {
  switch (status) {
    case "on_track":
      return "green";
    case "needs_intervention":
      return "red";
    default:
      return "amber";
  }
}

function kpiStatusLabel(status: LeadershipKpi["status"]): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "watch":
      return "Watch";
    default:
      return "At risk";
  }
}

function kpiStatusTone(status: LeadershipKpi["status"]): ChipTone {
  switch (status) {
    case "healthy":
      return "green";
    case "watch":
      return "blue";
    default:
      return "amber";
  }
}

function slaStatusLabel(status: DashboardSlaStatus): string {
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

function slaStatusTone(status: DashboardSlaStatus): ChipTone {
  switch (status) {
    case "met":
      return "green";
    case "at_risk":
      return "amber";
    case "missed":
      return "red";
    default:
      return "neutral";
  }
}

function formatKpiValue(kpi: LeadershipKpi): string {
  switch (kpi.unit) {
    case "percent":
      return formatPercent(kpi.value);
    case "hours":
      return formatHours(kpi.value);
    case "ratio":
      return kpi.value.toFixed(1);
    case "tickets_per_day":
      return kpi.value.toFixed(1);
    default:
      return formatCompact(kpi.value);
  }
}

function formatDelta(kpi: LeadershipKpi): string {
  if (kpi.delta_value === null) {
    return "No comparison";
  }
  const sign = kpi.delta_value > 0 ? "+" : kpi.delta_value < 0 ? "-" : "";
  const absoluteValue = Math.abs(kpi.delta_value);
  const value =
    kpi.unit === "percent"
      ? `${formatCompact(absoluteValue)} pts`
      : kpi.unit === "hours"
        ? formatHours(absoluteValue)
        : kpi.unit === "ratio" || kpi.unit === "tickets_per_day"
          ? absoluteValue.toFixed(1)
          : formatCompact(absoluteValue);
  return `${sign}${value} vs prior`;
}

function unitLabel(unit: LeadershipKpi["unit"]): string {
  switch (unit) {
    case "percent":
      return "pts";
    case "hours":
      return "hours";
    case "tickets_per_day":
      return "tickets/day";
    case "ratio":
      return "ratio";
    default:
      return "tickets";
  }
}

function formatDateLong(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
