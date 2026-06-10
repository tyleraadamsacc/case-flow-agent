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

/** Horizontal bar list for dimensioned metrics (product volume,
 * processing time, bottleneck dwell) — calm CSS bars, no chart library. */
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
  const max = Math.max(...metrics.map((metric) => metric.value), 1);
  const confidence = metrics[0]?.data_confidence;

  return (
    <Card title={title} subtitle={subtitle}>
      {metrics.length === 0 ? (
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          No data yet — process a request to populate this view.
        </p>
      ) : (
        <ul className="cf-barlist">
          {metrics.map((metric) => (
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
