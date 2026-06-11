/** Presentation helpers for legal-request data. Pure functions — easy to
 * test, no fetch, no state. */

import type { LegalRequest, SpecialHandlingFlags, WorkflowState } from "../api/types";

const SPECIAL_HANDLING_LABELS: Array<[keyof SpecialHandlingFlags, string]> = [
  ["sealed", "Sealed"],
  ["non_disclosure_to_subscriber", "Non-disclosure"],
  ["no_adverse_action", "No adverse action"],
  ["pen_register_requested", "Pen register"],
  ["trap_and_trace_requested", "Trap and trace"],
  ["ongoing_access_requested", "Ongoing access"],
  ["location_tracking_requested", "Location tracking"],
  ["content_requested", "Content"],
  ["tombstone_requested", "Tombstone"],
];

export function specialHandlingBadges(flags: SpecialHandlingFlags): string[] {
  return SPECIAL_HANDLING_LABELS.filter(([key]) => flags[key] === true).map(
    ([, label]) => label,
  );
}

/** The next human step for a request in this state. Always a human verb —
 * never an autonomous one. */
export function nextAction(state: WorkflowState): string {
  switch (state) {
    case "request_received":
      return "Extract request";
    case "request_extracted":
      return "Validate request";
    case "request_validated":
      return "Run six-agent workflow";
    case "analyst_review_pending":
      return "Review agent output";
    case "changes_requested":
      return "Revise and re-review";
    case "analyst_approved":
      return "Send to QA";
    case "escalated":
      return "Await SME review";
    case "sent_to_qa":
      return "Await QA validation";
    case "audit_complete":
      return "No action needed";
    default:
      return "Review request";
  }
}

export function workflowStateLabel(state: WorkflowState): string {
  return humanizeToken(state);
}

export function humanizeToken(value: string): string {
  const mapped = DISPLAY_LABELS[value];
  if (mapped) {
    return mapped;
  }
  const words = value.replace(/[_-]+/g, " ").trim();
  return words.length === 0
    ? value
    : words.charAt(0).toUpperCase() + words.slice(1);
}

const DISPLAY_LABELS: Record<string, string> = {
  synthetic_mock: "Synthetic / mock",
  synthetic_mock_data: "Synthetic / mock data",
  request_received: "Request received",
  request_extracted: "Request extracted",
  request_indexed: "Request indexed",
  request_classified: "Request classified",
  request_validated: "Request validated",
  route_recommended: "Route recommended",
  etl_simulated: "ETL simulated",
  note_drafted: "Note drafted",
  response_package_drafted: "Response package drafted",
  deficiency_response_drafted: "Deficiency response drafted",
  analyst_review_pending: "Analyst review pending",
  analyst_approved: "Analyst approved",
  sent_to_qa: "Sent to QA",
  changes_requested: "Changes requested",
  audit_complete: "Audit complete",
  audit_exception: "Audit exception",
  indexing_agent: "Indexing Agent",
  triaging_agent: "Triaging Agent",
  etl_agent: "ETL Agent",
  note_taking_and_data_entry_agent: "Note Taking and Data Entry Agent",
  text_content_agent: "Text Content Agent",
  automation_agent: "Automation Agent",
  draft_pending_approval: "Draft pending approval",
  draft_pending_analyst_review: "Draft pending analyst review",
  draft_not_final: "Draft, not final",
  prepared_pending_human: "Prepared, pending human",
  recommended_pending_human: "Recommended, pending human",
};

export function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "not stated";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "not recorded";
  }
  return value.replace("T", " ").slice(0, 16) + " UTC";
}

export function agencyName(request: LegalRequest): string {
  return request.requesting_agency?.agency ?? "Agency pending extraction";
}

export function legalProcessLabel(request: LegalRequest): string {
  const type = request.legal_process?.type;
  return type ? humanizeToken(type) : "Process pending extraction";
}

export function blockingDeficiencyCount(request: LegalRequest): number {
  return request.deficiency_findings.filter(
    (finding) => finding.severity === "blocking",
  ).length;
}

export function reviewRequirementLabel(request: LegalRequest): string {
  if (request.workflow_state === "audit_complete") {
    return "No review pending";
  }
  if (blockingDeficiencyCount(request) > 0) {
    return "Blocking deficiency review";
  }
  if (
    request.classification?.human_review_required ||
    request.agent_run_reviews.length > 0 ||
    request.reviews.length > 0 ||
    specialHandlingBadges(request.special_handling).length > 0
  ) {
    return "Human review required";
  }
  return "Analyst checkpoint";
}

export function auditStatusLabel(request: LegalRequest): string {
  const auditEvents = [
    ...request.approvals.map((approval) => approval.audit_event_id),
    ...request.human_overrides.map((override) => override.audit_event_id),
    ...request.agent_run_reviews.map((review) => review.audit_event_id),
    ...request.attestations.map((attestation) => attestation.audit_event_id),
    ...Object.values(request.agent_runs).map((run) => run.audit_event_id),
  ].filter(Boolean).length;

  if (request.workflow_state === "audit_complete") {
    return "Audit complete";
  }
  if (auditEvents > 0) {
    return `${auditEvents} audit event${auditEvents === 1 ? "" : "s"} linked`;
  }
  return "Audit trail pending";
}
