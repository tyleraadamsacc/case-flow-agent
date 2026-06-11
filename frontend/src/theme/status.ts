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

/** Backend WorkflowState values → display meta. Drafted/intermediate
 * states read blue (work in progress), human-decision states read amber,
 * completed states green. */
export const WORKFLOW_STATE_META: Record<string, StatusMeta> = {
  request_received: { label: "Received", tone: "neutral" },
  request_extracted: { label: "Extracted", tone: "blue" },
  request_indexed: { label: "Indexed", tone: "blue" },
  request_classified: { label: "Classified", tone: "blue" },
  request_validated: { label: "Validated", tone: "blue" },
  route_recommended: { label: "Route recommended", tone: "blue" },
  etl_simulated: { label: "ETL simulated", tone: "blue" },
  note_drafted: { label: "Note drafted", tone: "blue" },
  response_package_drafted: { label: "Package drafted", tone: "blue" },
  deficiency_response_drafted: {
    label: "Deficiency response drafted",
    tone: "blue",
  },
  analyst_review_pending: { label: "Analyst review pending", tone: "amber" },
  analyst_approved: { label: "Analyst approved", tone: "green" },
  escalated: { label: "Escalated", tone: "amber" },
  sent_to_qa: { label: "Sent to QA", tone: "blue" },
  changes_requested: { label: "Changes requested", tone: "amber" },
  audit_complete: { label: "Audit complete", tone: "green" },
};

/** Pending-human literals the backend stamps on drafted artifacts. Every
 * one reads blue (a draft in flight) or amber (a person must decide) —
 * there is no agent-final status to map. */
export const DRAFT_STATUS_META: Record<string, StatusMeta> = {
  draft_not_final: { label: "Draft, not final", tone: "blue" },
  draft_pending_approval: { label: "Draft pending approval", tone: "blue" },
  draft_pending_analyst_review: {
    label: "Draft pending analyst review",
    tone: "blue",
  },
  recommended_pending_human: {
    label: "Recommended, pending human",
    tone: "blue",
  },
  prepared_pending_human: { label: "Prepared, pending human", tone: "blue" },
  approved_by_analyst: { label: "Approved by analyst", tone: "green" },
};

/** Resolve a status string to display meta. Unknown statuses degrade to a
 * neutral badge with a humanized label rather than crashing — future
 * backend statuses must never break the UI. */
export function statusMeta(status: string): StatusMeta {
  const known =
    STATUS_META[status as WorkflowStatusKey] ??
    WORKFLOW_STATE_META[status] ??
    DRAFT_STATUS_META[status];
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
