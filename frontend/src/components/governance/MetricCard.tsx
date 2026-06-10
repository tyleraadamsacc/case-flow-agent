import type { GovernanceMetric } from "../../api/types";
import Card from "../ui/Card";
import Chip from "../ui/Chip";

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
 * a value is never shown without saying how trustworthy it is. */
export default function MetricCard({ metric }: { metric: GovernanceMetric }) {
  return (
    <Card className="cf-metric" title={metric.title}>
      <span className="cf-metric__value">{formatValue(metric)}</span>
      <div className="cf-preview__row">
        <Chip tone="violet" title="Data confidence">
          {metric.data_confidence}
        </Chip>
      </div>
    </Card>
  );
}
