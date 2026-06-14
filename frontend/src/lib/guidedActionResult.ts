import type { AuditEvent, LegalRequest, WorkflowState } from "../api/types";
import { humanizeToken } from "./requestDisplay";

export interface GuidedActionReceipt {
  actionName: string;
  title: string;
  summary: string;
  workflowState: WorkflowState | null;
  auditSummaries: string[];
}

interface MaybeActionResult {
  legal_request?: LegalRequest;
  audit_event?: AuditEvent;
  audit_events?: AuditEvent[];
  agent_runs?: unknown[];
}

export function summarizeGuidedActionResult(
  actionName: string,
  result: unknown,
): GuidedActionReceipt {
  const shaped = isRecord(result) ? (result as MaybeActionResult) : {};
  const events = [
    ...(shaped.audit_event ? [shaped.audit_event] : []),
    ...(Array.isArray(shaped.audit_events) ? shaped.audit_events : []),
  ];
  const workflowState = shaped.legal_request?.workflow_state ?? null;
  const stateSummary = workflowState
    ? `Current state: ${humanizeToken(workflowState)}.`
    : "Request state refreshed.";
  const auditSummaries = events.map((event) => event.summary).filter(Boolean);
  const railSummary =
    actionName === "Six-agent workflow" && Array.isArray(shaped.agent_runs)
      ? ` ${shaped.agent_runs.length} agent outputs refreshed.`
      : "";

  return {
    actionName,
    title: `${actionName} complete`,
    summary: `${stateSummary}${railSummary}`,
    workflowState,
    auditSummaries,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
