/** Status → label/tone mapping. One place defines how every workflow,
 * agent-run, draft, and audit status reads and renders.
 *
 * Copy guardrail: labels describe drafts, preparation, and pending human
 * decisions. Nothing here may ever read as an autonomous send, release,
 * disclosure, or final legal determination. */

/** Visual tone — resolved to colors by components.css. Tones map to
 * meaning: green = done, gradient = agent running, amber = human
 * attention, red = blocked/exception, blue = draft/prepared,
 * violet = synthetic/mock, neutral = idle. */
export type StatusTone =
  | "neutral"
  | "gradient"
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "violet";

/** Agent-run statuses — mirrors backend AgentRunStatus exactly. */
export type AgentRunStatus =
  | "waiting"
  | "running"
  | "complete"
  | "blocked"
  | "needs_review"
  | "failed";

/** Everything StatusBadge supports, including draft/audit statuses. */
export type WorkflowStatusKey =
  | AgentRunStatus
  | "draft"
  | "prepared"
  | "pending_approval"
  | "audit_complete"
  | "audit_exception"
  | "synthetic_mock";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

export const STATUS_META: Record<WorkflowStatusKey, StatusMeta> = {
  waiting: { label: "Waiting", tone: "neutral" },
  running: { label: "Running", tone: "gradient" },
  complete: { label: "Complete", tone: "green" },
  blocked: { label: "Blocked", tone: "red" },
  needs_review: { label: "Needs review", tone: "amber" },
  failed: { label: "Failed", tone: "red" },
  draft: { label: "Draft", tone: "blue" },
  prepared: { label: "Prepared", tone: "blue" },
  pending_approval: { label: "Pending approval", tone: "amber" },
  audit_complete: { label: "Audit complete", tone: "green" },
  audit_exception: { label: "Audit exception", tone: "red" },
  synthetic_mock: { label: "Synthetic / mock data", tone: "violet" },
};

/** Resolve a status string to display meta. Unknown statuses degrade to a
 * neutral badge with a humanized label rather than crashing — future
 * backend statuses must never break the UI. */
export function statusMeta(status: string): StatusMeta {
  const known = STATUS_META[status as WorkflowStatusKey];
  if (known) {
    return known;
  }
  return { label: humanize(status), tone: "neutral" };
}

function humanize(value: string): string {
  const words = value.replace(/[_-]+/g, " ").trim();
  return words.length === 0
    ? "Unknown"
    : words.charAt(0).toUpperCase() + words.slice(1);
}
