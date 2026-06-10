import { confidenceThresholds } from "../../theme/tokens";

export interface ConfidenceBarProps {
  /** Accepts 0–1 or 0–100; values above 1 are treated as percentages.
   * null/undefined renders "No confidence score". */
  value?: number | null;
  className?: string;
}

export default function ConfidenceBar({ value, className }: ConfidenceBarProps) {
  if (value === null || value === undefined) {
    return <span className="cf-confidence__none">No confidence score</span>;
  }

  const normalized = Math.min(Math.max(value > 1 ? value / 100 : value, 0), 1);
  const percent = Math.round(normalized * 100);
  const tone =
    normalized >= confidenceThresholds.green
      ? "green"
      : normalized >= confidenceThresholds.amber
        ? "amber"
        : "red";

  return (
    <div
      className={["cf-confidence", className].filter(Boolean).join(" ")}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`Confidence ${percent}%`}
    >
      <span className="cf-confidence__track">
        <span
          className={`cf-confidence__fill cf-confidence__fill--${tone}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="cf-confidence__label">{percent}% confidence</span>
    </div>
  );
}
