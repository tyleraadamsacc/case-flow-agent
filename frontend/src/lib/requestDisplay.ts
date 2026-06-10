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

export function humanizeToken(value: string): string {
  const words = value.replace(/[_-]+/g, " ").trim();
  return words.length === 0
    ? value
    : words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
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
