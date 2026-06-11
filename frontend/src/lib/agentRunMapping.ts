/** Map backend AgentRun records (snake_case wire format) onto the
 * Six-Agent Workflow Rail's card props. */

import type { AgentRun, AgentRunReview } from "../api/types";
import type { AgentRunLike } from "../components/agents/SixAgentWorkflowRail";
import { formatDateTime } from "./requestDisplay";

export function toRailRun(
  run: AgentRun,
  auditActions: Record<string, string> = {},
  reviews: AgentRunReview[] = [],
): AgentRunLike {
  const review = [...reviews].reverse().find(
    (candidate) =>
      candidate.agent_id === run.agent_id &&
      (!candidate.agent_run_id || candidate.agent_run_id === run.agent_run_id),
  );
  return {
    agentId: run.agent_id,
    status: run.status,
    inputSummary: run.input_summary || undefined,
    outputSummary: run.output_summary || undefined,
    output: run.output,
    confidence: run.confidence,
    rationale: run.rationale,
    evidenceIds: run.evidence_ids,
    auditEventId: run.audit_event_id,
    auditAction: run.audit_event_id
      ? (auditActions[run.audit_event_id] ?? null)
      : null,
    requiresHumanReview: run.requires_human_review,
    reviewReasons: run.review_reasons,
    riskFlags: run.risk_flags,
    blockedReason: run.blocked_reason,
    humanDecision: review?.decision ?? null,
    humanReviewer: review?.reviewed_by ?? null,
    humanInstruction: review?.instruction ?? null,
    timestamp: run.completed_at ? formatDateTime(run.completed_at) : null,
  };
}

export function toRailRuns(
  runs: AgentRun[] | Record<string, AgentRun>,
  auditActions: Record<string, string> = {},
  reviews: AgentRunReview[] = [],
): AgentRunLike[] {
  const list = Array.isArray(runs) ? runs : Object.values(runs);
  return list.map((run) => toRailRun(run, auditActions, reviews));
}
