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

const VISIBLE_DEFAULT = 6;

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
}: {
  title: string;
  subtitle?: string;
  metrics: GovernanceMetric[];
  unit?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...metrics].sort((a, b) => b.value - a.value);
  const visible = showAll ? sorted : sorted.slice(0, VISIBLE_DEFAULT);
  const hidden = sorted.length - visible.length;
  const max = Math.max(...metrics.map((metric) => metric.value), 1);
  const confidence = metrics[0]?.data_confidence;

  return (
    <Card title={title} subtitle={subtitle}>
      {metrics.length === 0 ? (
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          No data yet. Process a request to populate this view.
        </p>
      ) : (
        <ul className="cf-barlist">
          {visible.map((metric) => (
            <li key={metric.metric_id} className="cf-barlist__item">
              <span className="cf-barlist__label" title={metric.title}>
                {metricLabel(metric)}
              </span>
              <span className="cf-barlist__track">
                <span
                  className="cf-barlist__fill"
                  style={{ width: `${Math.max((metric.value / max) * 100, 2)}%` }}
                />
              </span>
              <span className="cf-barlist__value">
                {Number.isInteger(metric.value)
                  ? metric.value
                  : metric.value.toFixed(1)}
                {unit ? ` ${unit}` : ""}
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
        <div style={{ marginTop: "var(--space-3)" }}>
          <Chip tone="violet" title="Data confidence">
            {confidence}
          </Chip>
        </div>
      ) : null}
    </Card>
  );
}
