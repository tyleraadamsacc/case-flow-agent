import type {
  AgentRun,
  AuditEvent,
  LegalRequest,
  PackageValidationFinding,
} from "../../api/types";
import { AGENT_RAIL_ORDER, AGENT_THEME, type AgentId } from "../../theme/agentTheme";
import { statusMeta, type StatusTone } from "../../theme/status";
import {
  agencyName,
  formatDate,
  formatDateTime,
  humanizeToken,
  legalProcessLabel,
  specialHandlingBadges,
} from "../../lib/requestDisplay";

export interface WorkflowStorySummary {
  requestId: string;
  agency: string;
  process: string;
  domains: string[];
  urgency: string;
  dateRange: string;
  subjectCount: number;
  deficiencyCount: number;
  riskFlags: string[];
  specialHandling: string[];
  workflowStateLabel: string;
  workflowStateTone: StatusTone;
  reviewRequired: boolean;
}

export interface WorkflowTimelineItem {
  id: string;
  label: string;
  summary: string;
  timestamp: string;
  sortTimestamp: string;
  actorLabel: string;
  actorType: AuditEvent["actor_type"] | "agent";
  agentId: AgentId | null;
  status: string;
  evidenceIds: string[];
  confidence: number | null;
}

export interface WorkflowReadinessItem {
  id: string;
  label: string;
  detail: string;
  state: "ready" | "attention" | "blocked" | "pending";
}

export interface WorkflowReadinessSummary {
  ready: number;
  attention: number;
  blocked: number;
  pending: number;
  items: WorkflowReadinessItem[];
}

const REQUIRED_AGENT_AUDIT_ACTIONS: Record<AgentId, readonly string[]> = {
  indexing_agent: ["request_indexed"],
  triaging_agent: ["request_classified"],
  etl_agent: ["etl_simulated"],
  note_taking_and_data_entry_agent: ["note_drafted"],
  text_content_agent: [
    "production_package_drafted",
    "deficiency_response_drafted",
  ],
  automation_agent: ["workflow_action_prepared"],
};

export function buildWorkflowStorySummary(
  request: LegalRequest,
): WorkflowStorySummary {
  const status = statusMeta(request.workflow_state);
  const riskFlags = collectRiskFlags(request);
  const deficiencyCount = request.deficiency_findings.length;
  const dateRange = request.requested_period
    ? `${formatDate(request.requested_period.start)} to ${formatDate(
        request.requested_period.end,
      )}`
    : "not stated";

  return {
    requestId: request.legal_request_id,
    agency: agencyName(request),
    process: legalProcessLabel(request),
    domains: request.product_domains.length
      ? request.product_domains.map(humanizeToken)
      : ["Domain pending extraction"],
    urgency: request.urgency_tier
      ? humanizeToken(request.urgency_tier)
      : "Urgency pending",
    dateRange,
    subjectCount: request.subject_identifiers.length,
    deficiencyCount,
    riskFlags,
    specialHandling: specialHandlingBadges(request.special_handling),
    workflowStateLabel: status.label,
    workflowStateTone: status.tone,
    reviewRequired:
      request.classification?.human_review_required === true ||
      Object.values(request.agent_runs).some((run) => run.requires_human_review) ||
      request.deficiency_findings.some((finding) => finding.requires_human_review),
  };
}

export function buildWorkflowTimelineItems(
  request: LegalRequest,
  auditEvents: AuditEvent[] = [],
): WorkflowTimelineItem[] {
  const eventItems = auditEvents.length
    ? auditEvents.map((event) => {
      const agentId = normalizeAgentId(event.actor_id);
      const status =
        event.after_state ?? event.before_state ?? event.action ?? "audit_complete";
      return {
        id: event.audit_event_id,
        label: humanizeToken(event.action),
        summary: event.summary,
        timestamp: formatDateTime(event.timestamp),
        sortTimestamp: event.timestamp,
        actorLabel: agentId
          ? AGENT_THEME[agentId].officialName
          : humanizeToken(event.actor_id || event.actor_type),
        actorType: agentId ? "agent" : event.actor_type,
        agentId,
        status,
        evidenceIds: event.evidence_ids,
        confidence: event.confidence,
      };
    })
    : collectRequestTimelineItems(request);

  return eventItems.sort((left, right) =>
    left.sortTimestamp.localeCompare(right.sortTimestamp),
  );
}

export function buildWorkflowReadinessSummary(
  request: LegalRequest,
  auditEvents: AuditEvent[] = [],
): WorkflowReadinessSummary {
  const events = auditEvents.length ? auditEvents : collectRequestAuditEvents(request);
  const agentRuns = Object.values(request.agent_runs);
  const blockedAgents = agentRuns.filter((run) =>
    ["blocked", "failed"].includes(run.status),
  );
  const needsReviewAgents = agentRuns.filter((run) => run.requires_human_review);
  const blockingFindings = [
    ...request.package_validation_findings,
    ...(request.production_package?.validation_findings ?? []),
  ].filter(isBlockingFinding);
  const missingAgentEvents = AGENT_RAIL_ORDER.filter(
    (agentId) =>
      !hasRequiredAgentAuditEvidence(agentId, agentRuns, events, auditEvents.length > 0),
  );
  const packageStatus = request.production_package?.status;
  const reviewCount =
    request.reviews.length +
    request.approvals.length +
    request.agent_run_reviews.length +
    request.attestations.length;

  const items: WorkflowReadinessItem[] = [
    {
      id: "all-agents-visible",
      label: "Six agents represented",
      detail:
        agentRuns.length >= AGENT_RAIL_ORDER.length
          ? "All six RFP agent runs are present."
          : `${agentRuns.length} of 6 agent runs are present.`,
      state: agentRuns.length >= AGENT_RAIL_ORDER.length ? "ready" : "pending",
    },
    {
      id: "agent-blockers",
      label: "Agent blockers",
      detail:
        blockedAgents.length === 0
          ? "No blocked or failed agent run is open."
          : blockedAgents
              .map((run) => agentNameFromRun(run))
              .join(", "),
      state: blockedAgents.length === 0 ? "ready" : "blocked",
    },
    {
      id: "human-review",
      label: "Human review",
      detail:
        needsReviewAgents.length === 0
          ? "No agent run is currently marked for review."
          : `${needsReviewAgents.length} agent output${
              needsReviewAgents.length === 1 ? "" : "s"
            } require human review.`,
      state: needsReviewAgents.length === 0 ? "ready" : "attention",
    },
    {
      id: "package-validation",
      label: "Package validation",
      detail:
        blockingFindings.length === 0
          ? "No blocking package validation finding is recorded."
          : blockingFindings.map((finding) => finding.message).join("; "),
      state: blockingFindings.length === 0 ? "ready" : "blocked",
    },
    {
      id: "audit-coverage",
      label: "Audit coverage",
      detail:
        missingAgentEvents.length === 0
          ? "Required agent audit events are present."
          : `Missing required events for ${missingAgentEvents
              .map((agentId) => AGENT_THEME[agentId].officialName)
              .join(", ")}.`,
      state: missingAgentEvents.length === 0 ? "ready" : "attention",
    },
    {
      id: "approval-state",
      label: "Approval state",
      detail: packageStatus
        ? statusMeta(packageStatus).label
        : "Response package draft not yet recorded.",
      state:
        packageStatus === "approved_by_analyst"
          ? "ready"
          : packageStatus
            ? "attention"
            : "pending",
    },
    {
      id: "review-records",
      label: "Review records",
      detail:
        reviewCount > 0
          ? `${reviewCount} human review, approval, or attestation record${
              reviewCount === 1 ? "" : "s"
            } found.`
          : "No human review record has been captured yet.",
      state: reviewCount > 0 ? "ready" : "pending",
    },
  ];

  return {
    ready: items.filter((item) => item.state === "ready").length,
    attention: items.filter((item) => item.state === "attention").length,
    blocked: items.filter((item) => item.state === "blocked").length,
    pending: items.filter((item) => item.state === "pending").length,
    items,
  };
}

export function normalizeAgentId(value: string | null | undefined): AgentId | null {
  if (!value) {
    return null;
  }
  return AGENT_RAIL_ORDER.includes(value as AgentId) ? (value as AgentId) : null;
}

function collectRiskFlags(request: LegalRequest): string[] {
  const flags = new Set<string>();
  request.deficiency_findings.forEach((finding) => flags.add(finding.message));
  request.package_validation_findings.forEach((finding) =>
    flags.add(finding.message),
  );
  Object.values(request.agent_runs).forEach((run) => {
    run.risk_flags.forEach((flag) => flags.add(flag));
    run.review_reasons.forEach((reason) => flags.add(reason));
  });
  return [...flags];
}

function collectRequestAuditEvents(request: LegalRequest): AuditEvent[] {
  const approvalEvents = request.approvals.flatMap((approval) =>
    approval.audit_event_id
      ? [
          {
            audit_event_id: approval.audit_event_id,
            legal_request_id: approval.legal_request_id,
            timestamp: approval.timestamp,
            actor_type: "human" as const,
            actor_id: approval.decided_by,
            action: approval.decision,
            before_state: null,
            after_state: request.workflow_state,
            summary: approval.comments ?? approval.policy_reasons.join(", "),
            evidence_ids: [],
            confidence: null,
            approval_id: approval.approval_id,
            correlation_id: null,
          },
        ]
      : [],
  );
  return approvalEvents;
}

function collectRequestTimelineItems(request: LegalRequest): WorkflowTimelineItem[] {
  const agentItems = Object.values(request.agent_runs).map((run) => {
    const agentId = normalizeAgentId(run.agent_id);
    return {
      id: run.audit_event_id ?? run.agent_run_id,
      label: agentId
        ? `${AGENT_THEME[agentId].officialName} output`
        : `${run.agent_name} output`,
      summary: run.output_summary || run.input_summary || "Agent output pending.",
      timestamp: formatDateTime(run.completed_at ?? run.started_at),
      sortTimestamp: run.completed_at ?? run.started_at ?? "",
      actorLabel: agentId ? AGENT_THEME[agentId].officialName : run.agent_name,
      actorType: "agent" as const,
      agentId,
      status: run.status,
      evidenceIds: run.evidence_ids,
      confidence: run.confidence,
    };
  });
  const approvalItems = collectRequestAuditEvents(request).map((event) => ({
    id: event.audit_event_id,
    label: humanizeToken(event.action),
    summary: event.summary,
    timestamp: formatDateTime(event.timestamp),
    sortTimestamp: event.timestamp,
    actorLabel: humanizeToken(event.actor_id || event.actor_type),
    actorType: event.actor_type,
    agentId: null,
    status: event.after_state ?? event.before_state ?? event.action,
    evidenceIds: event.evidence_ids,
    confidence: event.confidence,
  }));

  return [...agentItems, ...approvalItems];
}

function hasRequiredAgentAuditEvidence(
  agentId: AgentId,
  agentRuns: AgentRun[],
  events: AuditEvent[],
  hasFullAuditEvents: boolean,
): boolean {
  if (!hasFullAuditEvents) {
    return agentRuns.some(
      (run) => run.agent_id === agentId && Boolean(run.audit_event_id),
    );
  }
  return REQUIRED_AGENT_AUDIT_ACTIONS[agentId].some((action) =>
    events.some(
      (event) =>
        event.action === action &&
        (event.actor_id === agentId ||
          normalizeAgentId(event.actor_id) === agentId),
    ),
  );
}

function isBlockingFinding(
  finding: PackageValidationFinding,
): finding is PackageValidationFinding {
  return finding.severity === "blocking";
}

function agentNameFromRun(run: AgentRun): string {
  const agentId = normalizeAgentId(run.agent_id);
  return agentId ? AGENT_THEME[agentId].officialName : run.agent_name;
}
