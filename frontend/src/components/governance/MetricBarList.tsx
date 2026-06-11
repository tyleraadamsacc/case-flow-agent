import { useState } from "react";

import type { GovernanceMetric } from "../../api/types";
import { humanizeToken } from "../../lib/requestDisplay";
import Card from "../ui/Card";
import Chip from "../ui/Chip";

/** The dimension value lives in the metric id ("product_volume:Maps /
 * Location" → "Maps / Location"); `dimension` only names the axis. */
export function metricLabel(metric: GovernanceMetric): string {
  const separator = metric.metric_id.indexOf(":");
  if (separator >= 0) {
    return humanizeToken(metric.metric_id.slice(separator + 1));
  }
  return metric.title;
}

export function dataConfidenceLabel(value: string): string {
  if (value === "synthetic_mock") {
    return "Synthetic / mock";
  }
  return humanizeToken(value);
}

function formatMetricValue(metric: GovernanceMetric, unit?: string): string {
  const rounded =
    Number.isInteger(metric.value) ? metric.value : metric.value.toFixed(1);
  if (unit) {
    return `${rounded} ${unit}`;
  }
  switch (metric.unit) {
    case "percent":
      return `${rounded}%`;
    case "days":
      return `${rounded}d`;
    case "hours":
      return `${rounded}h`;
    default:
      return String(rounded);
  }
}

const VISIBLE_DEFAULT = 5;

/** Horizontal bar list for dimensioned metrics (product volume,
 * processing time, bottleneck dwell) — calm CSS bars, no chart library.
 * Long tails collapse behind a show-all toggle so the card stays an
 * insight, not a data dump; the toggle always names how many rows it
 * hides. */
export default function MetricBarList({
  title,
  subtitle,
  metrics,
  unit,
  emptyMessage = "No signal yet. This view will populate as governed requests move through the workflow.",
}: {
  title: string;
  subtitle?: string;
  metrics: GovernanceMetric[];
  unit?: string;
  emptyMessage?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...metrics].sort((a, b) => b.value - a.value);
  const visible = showAll ? sorted : sorted.slice(0, VISIBLE_DEFAULT);
  const hidden = sorted.length - visible.length;
  const max = Math.max(...metrics.map((metric) => metric.value), 1);
  const confidence = metrics[0]?.data_confidence;

  return (
    <Card className="cf-governance-chart-card" title={title} subtitle={subtitle}>
      {metrics.length === 0 ? (
        <div className="cf-governance-empty">
          <span className="cf-governance-empty__mark" aria-hidden="true" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <ul className="cf-barlist">
          {visible.map((metric, index) => (
            <li key={metric.metric_id} className="cf-barlist__item">
              <span className="cf-barlist__rank" aria-label={`Rank ${index + 1}`}>
                {index + 1}
              </span>
              <span className="cf-barlist__main">
                <span className="cf-barlist__label" title={metric.title}>
                  {metricLabel(metric)}
                </span>
                <span className="cf-barlist__hint">{humanizeMetricTitle(metric.title)}</span>
              </span>
              <span className="cf-barlist__track" aria-hidden="true">
                <span
                  className="cf-barlist__fill"
                  style={{ width: `${Math.max((metric.value / max) * 100, 2)}%` }}
                />
              </span>
              <span className="cf-barlist__value">
                {formatMetricValue(metric, unit)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 || showAll ? (
        <button
          type="button"
          className="cf-agent-card__details-toggle"
          style={{ marginTop: "var(--space-2)" }}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll
            ? `Show top ${VISIBLE_DEFAULT}`
            : `Show all ${sorted.length} (${hidden} more)`}
        </button>
      ) : null}
      {confidence ? (
        <div className="cf-governance-chart-card__footer">
          <Chip tone="violet" title="Data confidence">
            {dataConfidenceLabel(confidence)}
          </Chip>
          {metrics.length > VISIBLE_DEFAULT ? (
            <span className="cf-fields__muted">
              Top {VISIBLE_DEFAULT} shown first
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function humanizeMetricTitle(value: string): string {
  return value.replace(
    /([A-Za-z]+(?:_[A-Za-z]+)+)/g,
    (token) => humanizeToken(token),
  );
}
