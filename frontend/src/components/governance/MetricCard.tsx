import type { GovernanceMetric } from "../../api/types";
import { humanizeToken } from "../../lib/requestDisplay";
import Card from "../ui/Card";
import Chip from "../ui/Chip";
import { dataConfidenceLabel } from "./MetricBarList";

function formatValue(metric: GovernanceMetric): string {
  const rounded =
    Number.isInteger(metric.value) ? metric.value : metric.value.toFixed(1);
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

/** One governance metric with its mandatory data-confidence label —
 * a value is never shown without saying how trustworthy it is. The
 * period, when the backend reports one, becomes the caption. */
export default function MetricCard({ metric }: { metric: GovernanceMetric }) {
  return (
    <Card className="cf-metric" title={metric.title}>
      <span className="cf-metric__value">{formatValue(metric)}</span>
      {metric.period ? (
        <p className="cf-metric__caption">{humanizeToken(metric.period)}</p>
      ) : null}
      <div className="cf-preview__row">
        <Chip tone="violet" title="Data confidence">
          {dataConfidenceLabel(metric.data_confidence)}
        </Chip>
      </div>
    </Card>
  );
}
