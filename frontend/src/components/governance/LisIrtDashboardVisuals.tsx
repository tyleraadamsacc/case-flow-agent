import type {
  AnalystProductivityPoint,
  DailyOpsPoint,
  DashboardRiskLevel,
  RegionalBreakdown,
  SlaStatusBreakdown,
  WorkflowBreakdown,
} from "../../api/types";
import Card from "../ui/Card";
import Chip, { type ChipTone } from "../ui/Chip";

type TrendSeries = {
  id: string;
  label: string;
  color: string;
  value: (point: DailyOpsPoint) => number;
};

interface TrendChartProps {
  title: string;
  subtitle: string;
  ariaLabel: string;
  points: DailyOpsPoint[];
  series: TrendSeries[];
  compact?: boolean;
  target?: number;
  targetLabel?: string;
  yDomain?: [number, number];
  yTicks?: number[];
  valueFormatter?: (value: number) => string;
}

interface SelectDetail {
  title: string;
  description: string;
}

interface DistributionProps {
  onSelect?: (detail: SelectDetail) => void;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 230;
const COMPACT_CHART_HEIGHT = 170;
const CHART_PADDING = { top: 20, right: 24, bottom: 34, left: 48 };

export function TrendChart({
  title,
  subtitle,
  ariaLabel,
  points,
  series,
  compact = false,
  target,
  targetLabel,
  yDomain,
  yTicks,
  valueFormatter = formatCompact,
}: TrendChartProps) {
  const values = points.flatMap((point) => series.map((item) => item.value(point)));
  const targetValues = target === undefined ? values : [...values, target];
  const rawMin = yDomain?.[0] ?? Math.min(...targetValues, 0);
  const rawMax = yDomain?.[1] ?? Math.max(...targetValues, 1);
  const range = rawMax - rawMin || 1;
  const min = yDomain?.[0] ?? Math.max(0, rawMin - range * 0.08);
  const max = yDomain?.[1] ?? rawMax + range * 0.08;
  const gridValues = yTicks ?? [max, (max + min) / 2, min];
  const lastPoint = points[points.length - 1];
  const height = compact ? COMPACT_CHART_HEIGHT : CHART_HEIGHT;

  return (
    <Card
      className={`cf-lis-chart-card${compact ? " cf-lis-chart-card--compact" : ""}`}
      title={title}
      subtitle={subtitle}
    >
      {points.length === 0 ? (
        <EmptyChart message="No trend data matches the selected filters." />
      ) : (
        <>
          <div className="cf-lis-chart-card__summary">
            {series.map((item) => (
              <Chip key={item.id} tone="neutral" dot>
                {item.label}:{" "}
                {lastPoint ? valueFormatter(item.value(lastPoint)) : "0"}
              </Chip>
            ))}
            {target !== undefined ? (
              <Chip tone="blue">{targetLabel ?? `Target ${valueFormatter(target)}`}</Chip>
            ) : null}
          </div>
          <svg
            className="cf-lis-trend-chart"
            viewBox={`0 0 ${CHART_WIDTH} ${height}`}
            role="img"
            aria-label={ariaLabel}
          >
            <title>{title}</title>
            <desc>
              {series.map((item) => item.label).join(" and ")} for{" "}
              {points.length} daily points.
            </desc>
            {gridValues.map((gridValue) => {
              const y = yScale(gridValue, min, max, height);
              return (
                <g key={gridValue}>
                  <line
                    x1={CHART_PADDING.left}
                    x2={CHART_WIDTH - CHART_PADDING.right}
                    y1={y}
                    y2={y}
                    className="cf-lis-trend-chart__grid"
                  />
                  <text
                    x={CHART_PADDING.left - 10}
                    y={y + 4}
                    className="cf-lis-trend-chart__axis-label"
                    textAnchor="end"
                  >
                    {valueFormatter(gridValue)}
                  </text>
                </g>
              );
            })}
            {target !== undefined ? (
              <g>
                <line
                  x1={CHART_PADDING.left}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y1={yScale(target, min, max, height)}
                  y2={yScale(target, min, max, height)}
                  className="cf-lis-trend-chart__target"
                />
                <text
                  x={CHART_WIDTH - CHART_PADDING.right}
                  y={Math.max(CHART_PADDING.top + 12, yScale(target, min, max, height) - 6)}
                  className="cf-lis-trend-chart__target-label"
                  textAnchor="end"
                >
                  {targetLabel ?? `Target ${valueFormatter(target)}`}
                </text>
              </g>
            ) : null}
            {series.map((item) => (
              <path
                key={item.id}
                d={linePath(points, item.value, min, max, height)}
                fill="none"
                stroke={item.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {series.flatMap((item) =>
              points.map((point, index) => (
                <circle
                  key={`${item.id}:${point.date}`}
                  cx={xScale(index, points.length)}
                  cy={yScale(item.value(point), min, max, height)}
                  r={index === points.length - 1 ? 4 : 2.4}
                  fill={item.color}
                  className="cf-lis-trend-chart__point"
                />
              )),
            )}
            <text
              x={CHART_PADDING.left}
              y={height - 8}
              className="cf-lis-trend-chart__axis-label"
            >
              {formatDate(points[0]?.date)}
            </text>
            <text
              x={CHART_WIDTH - CHART_PADDING.right}
              y={height - 8}
              className="cf-lis-trend-chart__axis-label"
              textAnchor="end"
            >
              {formatDate(points[points.length - 1]?.date)}
            </text>
          </svg>
        </>
      )}
    </Card>
  );
}

export function SlaStatusDistribution({
  items,
  onSelect,
}: DistributionProps & { items: SlaStatusBreakdown[] }) {
  return (
    <Card
      className="cf-lis-distribution-card"
      title="SLO Boundary Status"
      subtitle="At risk means still inside SLO, but approaching the TAT boundary."
    >
      {items.length === 0 || items.every((item) => item.count === 0) ? (
        <EmptyChart message="No SLA status data matches the selected filters." />
      ) : (
        <>
          <div className="cf-lis-segmented" aria-label="SLA status distribution">
            {items.map((item) => (
              <button
                key={item.status}
                type="button"
                className={`cf-lis-segmented__item cf-lis-segmented__item--${item.status}`}
                style={{ flexBasis: `${Math.max(item.percent, 2)}%` }}
                onClick={() =>
                  onSelect?.({
                    title: item.label,
                    description: `${formatCompact(item.count)} tickets, ${item.percent}% of the selected period.`,
                  })
                }
              >
                <span>{item.label}</span>
                <strong>{item.percent}%</strong>
              </button>
            ))}
          </div>
          <ul className="cf-lis-distribution-list">
            {items.map((item) => (
              <li key={item.status}>
                <span>{item.label}</span>
                <strong>{formatCompact(item.count)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function WorkflowDistribution({
  items,
  onSelect,
}: DistributionProps & { items: WorkflowBreakdown[] }) {
  const topItems = items.slice(0, 8);
  const maxVolume = Math.max(...topItems.map((item) => item.volume), 1);

  return (
    <Card
      className="cf-lis-distribution-card"
      title="Workflow / Silo Distribution"
      subtitle="Largest demand drivers with current risk posture."
    >
      {topItems.length === 0 ? (
        <EmptyChart message="No workflows match the selected filters." />
      ) : (
        <div className="cf-lis-ranked-list" role="list">
          {topItems.map((item) => (
            <button
              key={`${item.silo}:${item.workflow}`}
              type="button"
              className="cf-lis-ranked-row"
              onClick={() =>
                onSelect?.({
                  title: item.workflow,
                  description: `${item.silo} / ${item.category}: ${formatCompact(item.volume)} tickets, ${item.slo_compliance_percent}% SLO compliance, median TAT ${formatHours(item.median_tat_hours)}.`,
                })
              }
            >
              <span className="cf-lis-ranked-row__label">
                <strong>{item.workflow}</strong>
                <small>{item.silo} / {item.category}</small>
              </span>
              <span className="cf-lis-ranked-row__track" aria-hidden="true">
                <span style={{ width: `${(item.volume / maxVolume) * 100}%` }} />
              </span>
              <span className="cf-lis-ranked-row__value">
                {formatCompact(item.volume)}
              </span>
              <Chip tone={riskTone(item.risk_level)}>{riskLabel(item.risk_level)}</Chip>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export function WorkflowCategoryBreakdown({
  items,
  onSelect,
}: DistributionProps & { items: WorkflowBreakdown[] }) {
  const grouped = items.reduce<
    Record<string, { volume: number; risk: DashboardRiskLevel; slo: number }>
  >((groups, item) => {
    const current = groups[item.category] ?? {
      volume: 0,
      risk: "low" as DashboardRiskLevel,
      slo: 0,
    };
    groups[item.category] = {
      volume: current.volume + item.volume,
      risk:
        riskRank(item.risk_level) > riskRank(current.risk)
          ? item.risk_level
          : current.risk,
      slo: current.slo + item.slo_compliance_percent * item.volume,
    };
    return groups;
  }, {});
  const rows = Object.entries(grouped)
    .map(([category, value]) => ({
      category,
      volume: value.volume,
      risk_level: value.risk,
      slo_compliance_percent:
        value.volume === 0 ? 0 : Math.round((value.slo / value.volume) * 10) / 10,
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);
  const maxVolume = Math.max(...rows.map((item) => item.volume), 1);

  return (
    <Card
      className="cf-lis-distribution-card"
      title="Workflow Category Mix"
      subtitle="Demand concentration by operating category and legal process family."
    >
      {rows.length === 0 ? (
        <EmptyChart message="No workflow categories match the selected filters." />
      ) : (
        <div className="cf-lis-ranked-list" role="list">
          {rows.map((item) => (
            <button
              key={item.category}
              type="button"
              className="cf-lis-ranked-row"
              onClick={() =>
                onSelect?.({
                  title: item.category,
                  description: `${formatCompact(item.volume)} tickets, ${item.slo_compliance_percent}% SLO compliance across matching workflows.`,
                })
              }
            >
              <span className="cf-lis-ranked-row__label">
                <strong>{item.category}</strong>
                <small>{item.slo_compliance_percent}% SLO compliance</small>
              </span>
              <span className="cf-lis-ranked-row__track" aria-hidden="true">
                <span style={{ width: `${(item.volume / maxVolume) * 100}%` }} />
              </span>
              <span className="cf-lis-ranked-row__value">
                {formatCompact(item.volume)}
              </span>
              <Chip tone={riskTone(item.risk_level)}>{riskLabel(item.risk_level)}</Chip>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AnalystProductivityDistribution({
  items,
  onSelect,
}: DistributionProps & { items: AnalystProductivityPoint[] }) {
  const maxTickets = Math.max(...items.map((item) => item.tickets_per_day), 1);

  return (
    <Card
      className="cf-lis-distribution-card"
      title="Analyst Productivity"
      subtitle="Team-level throughput and utilization signals."
    >
      {items.length === 0 ? (
        <EmptyChart message="No analyst productivity rows match the selected filters." />
      ) : (
        <div className="cf-lis-ranked-list" role="list">
          {items.map((item) => (
            <button
              key={item.analyst_id}
              type="button"
              className="cf-lis-ranked-row"
              onClick={() =>
                onSelect?.({
                  title: item.analyst_name,
                  description: `${item.manager_name} in ${item.region}: ${item.tickets_per_day} tickets per analyst per day, ${formatHours(item.median_claim_hours)} median claim time, ${item.utilization_percent}% utilization.`,
                })
              }
            >
              <span className="cf-lis-ranked-row__label">
                <strong>{item.analyst_name}</strong>
                <small>{item.manager_name} / {item.region}</small>
              </span>
              <span className="cf-lis-ranked-row__track" aria-hidden="true">
                <span style={{ width: `${(item.tickets_per_day / maxTickets) * 100}%` }} />
              </span>
              <span className="cf-lis-ranked-row__value">
                {item.tickets_per_day.toFixed(1)}
              </span>
              <Chip tone={riskTone(item.risk_level)}>{riskLabel(item.risk_level)}</Chip>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export function RegionalBreakdownCard({
  items,
  onSelect,
}: DistributionProps & { items: RegionalBreakdown[] }) {
  const maxVolume = Math.max(...items.map((item) => item.volume_in), 1);

  return (
    <Card
      className="cf-lis-distribution-card"
      title="Regional Breakdown"
      subtitle="Demand, output, backlog, and SLO health by region."
    >
      {items.length === 0 ? (
        <EmptyChart message="No regional data matches the selected filters." />
      ) : (
        <div className="cf-lis-ranked-list" role="list">
          {items.map((item) => (
            <button
              key={`${item.region}:${item.country}`}
              type="button"
              className="cf-lis-ranked-row"
              onClick={() =>
                onSelect?.({
                  title: item.region,
                  description: `${item.country}: ${formatCompact(item.volume_in)} in, ${formatCompact(item.volume_out)} out, ${formatCompact(item.backlog)} net backlog, ${item.slo_compliance_percent}% SLO compliance.`,
                })
              }
            >
              <span className="cf-lis-ranked-row__label">
                <strong>{item.region}</strong>
                <small>{item.country}</small>
              </span>
              <span className="cf-lis-ranked-row__track" aria-hidden="true">
                <span style={{ width: `${(item.volume_in / maxVolume) * 100}%` }} />
              </span>
              <span className="cf-lis-ranked-row__value">
                {formatCompact(item.volume_in)}
              </span>
              <Chip tone={riskTone(item.risk_level)}>{riskLabel(item.risk_level)}</Chip>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="cf-lis-empty">
      <span className="cf-lis-empty__mark" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function linePath(
  points: DailyOpsPoint[],
  valueFor: (point: DailyOpsPoint) => number,
  min: number,
  max: number,
  height: number,
): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${xScale(index, points.length)} ${yScale(valueFor(point), min, max, height)}`;
    })
    .join(" ");
}

function xScale(index: number, total: number): number {
  const drawable = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const denominator = Math.max(total - 1, 1);
  return CHART_PADDING.left + (index / denominator) * drawable;
}

function yScale(value: number, min: number, max: number, height: number): number {
  const drawable = height - CHART_PADDING.top - CHART_PADDING.bottom;
  const normalized = (value - min) / Math.max(max - min, 1);
  return CHART_PADDING.top + (1 - normalized) * drawable;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 100 ? 1 : 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${formatCompact(value)}%`;
}

export function formatHours(value: number): string {
  if (value <= 0) {
    return "0h";
  }
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function riskTone(value: DashboardRiskLevel): ChipTone {
  switch (value) {
    case "critical":
      return "red";
    case "at_risk":
      return "amber";
    case "watch":
      return "blue";
    default:
      return "green";
  }
}

export function riskLabel(value: DashboardRiskLevel): string {
  switch (value) {
    case "critical":
      return "Critical";
    case "at_risk":
      return "At risk";
    case "watch":
      return "Watch";
    default:
      return "Healthy";
  }
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

function formatDate(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
