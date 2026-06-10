import { statusMeta } from "../../theme/status";

export interface StatusBadgeProps {
  /** A WorkflowStatusKey, or any backend status string — unknown values
   * degrade to a neutral badge instead of breaking. */
  status: string;
  className?: string;
}

/** Status pill with a text label always present: state is never
 * communicated by color alone. */
export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = statusMeta(status);
  const classes = ["cf-status", `cf-status--${meta.tone}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} data-status={status}>
      <span className="cf-status__dot" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
