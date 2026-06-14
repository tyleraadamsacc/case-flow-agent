import type { AuditEvent, FinalizationStatus, LegalRequest } from "../api/types";
import { humanizeToken, legalProcessLabel, nextAction } from "./requestDisplay";

export type RequestWorkbenchTab =
  | "overview"
  | "evidence"
  | "agents"
  | "drafts"
  | "audit";

export type RequestGuidedStepId =
  | "intake"
  | "evidence"
  | "agents"
  | "risks"
  | "decision"
  | "drafts"
  | "audit";

export type RequestGuidedStepStatus =
  | "complete"
  | "current"
  | "blocked"
  | "pending";

export type RequestGuidedActionKind =
  | "extract"
  | "validate"
  | "runAgents"
  | "openEvidence"
  | "openAgents"
  | "openDrafts"
  | "openAudit"
  | "focusDecisionPanel"
  | "none";

export interface RequestGuidedSecondaryAction {
  label: string;
  kind: RequestGuidedActionKind;
  tab?: RequestWorkbenchTab;
}

export interface RequestGuidedBlockerTask {
  label: string;
  detail: string;
  actionLabel: string;
  actionKind: RequestGuidedActionKind;
}

export type RequestReviewPanelMode =
  | "supporting"
  | "routeDecision"
  | "finalApproval"
  | "blocked"
  | "complete";

export type RequestAgentCommandMode = "hidden" | "available" | "recommended";

export interface RequestGuidedStep {
  id: RequestGuidedStepId;
  label: string;
  description: string;
  status: RequestGuidedStepStatus;
  tab: RequestWorkbenchTab;
}

export interface RequestGuidance {
  currentStepId: RequestGuidedStepId;
  currentStepStatus: RequestGuidedStepStatus;
  recommendedTab: RequestWorkbenchTab;
  postSuccessTab: RequestWorkbenchTab;
  nextRequiredAction: string;
  nextActionReason: string;
  primaryActionLabel: string;
  primaryActionKind: RequestGuidedActionKind;
  queueActionLabel: string;
  resultExpectation: string;
  checklist: string[];
  blockers: string[];
  blockerTasks: RequestGuidedBlockerTask[];
  secondaryActions: RequestGuidedSecondaryAction[];
  disabledReasons: string[];
  reviewPanelMode: RequestReviewPanelMode;
  agentCommandMode: RequestAgentCommandMode;
  steps: RequestGuidedStep[];
  queueSummary: string;
}

type RequestGuidanceCore = Omit<
  RequestGuidance,
  | "steps"
  | "blockers"
  | "postSuccessTab"
  | "queueActionLabel"
  | "resultExpectation"
  | "blockerTasks"
  | "secondaryActions"
  | "disabledReasons"
  | "reviewPanelMode"
  | "agentCommandMode"
>;

interface BuildRequestGuidanceInput {
  request: LegalRequest;
  auditEvents?: AuditEvent[];
  finalizationStatus?: FinalizationStatus | null;
  completedAgents?: number;
  reviewFlags?: string[];
  sourceBackedIdentifiers?: number;
  blockingFindings?: number;
}

const STEP_BASE: Array<Omit<RequestGuidedStep, "status">> = [
  {
    id: "intake",
    label: "Intake",
    description: "Confirm the request was received and ready to parse.",
    tab: "overview",
  },
  {
    id: "evidence",
    label: "Evidence",
    description: "Validate extracted fields against the source document.",
    tab: "evidence",
  },
  {
    id: "agents",
    label: "Agent outputs",
    description: "Review the six-agent analysis and any redraft needs.",
    tab: "agents",
  },
  {
    id: "risks",
    label: "Risks",
    description: "Resolve deficiencies, risk flags, and authority issues.",
    tab: "agents",
  },
  {
    id: "decision",
    label: "Decision",
    description: "Approve, request changes, escalate, or send to QA.",
    tab: "overview",
  },
  {
    id: "drafts",
    label: "Draft package",
    description: "Review prepared notes, deficiency drafts, and production package.",
    tab: "drafts",
  },
  {
    id: "audit",
    label: "Audit",
    description: "Confirm the recorded trail and approval completion.",
    tab: "audit",
  },
];

const STEP_INDEX = new Map(
  STEP_BASE.map((step, index) => [step.id, index] as const),
);

export function buildRequestGuidance({
  request,
  auditEvents = [],
  finalizationStatus = null,
  completedAgents,
  reviewFlags,
  sourceBackedIdentifiers,
  blockingFindings,
}: BuildRequestGuidanceInput): RequestGuidance {
  const runs = Object.values(request.agent_runs ?? {});
  const runCount = runs.length;
  const completeAgentCount =
    completedAgents ?? runs.filter((run) => run.status === "complete").length;
  const allReviewFlags = reviewFlags ?? collectReviewFlags(request);
  const sourceBackedCount =
    sourceBackedIdentifiers ??
    request.subject_identifiers.filter((identifier) => Boolean(identifier.source_span))
      .length;
  const blockerCount =
    blockingFindings ??
    request.deficiency_findings.filter((finding) => finding.severity === "blocking")
      .length;
  const blockedAgents = runs.filter(
    (run) => run.status === "blocked" || run.status === "failed",
  );
  const hasRoute = Boolean(request.routing_recommendation?.target_queue);
  const hasDrafts =
    Boolean(request.production_package) ||
    request.text_drafts.length > 0 ||
    request.note_drafts.length > 0;
  const finalizationBlockers = finalizationStatus?.blocking_reasons ?? [];
  const finalizationIsCurrent = [
    "analyst_approved",
    "sent_to_qa",
    "audit_complete",
  ].includes(request.workflow_state);
  const blockers = [
    ...request.deficiency_findings
      .filter((finding) => finding.severity === "blocking")
      .map((finding) => humanizeToken(finding.code)),
    ...blockedAgents.map((run) => `${run.agent_name}: ${run.blocked_reason ?? "blocked"}`),
    ...(finalizationIsCurrent ? finalizationBlockers.map(humanizeToken) : []),
  ];

  const guidance = resolveGuidance({
    request,
    auditEvents,
    completeAgentCount,
    runCount,
    allReviewFlags,
    sourceBackedCount,
    blockerCount,
    blockers,
    hasRoute,
    hasDrafts,
    finalizationStatus,
  });

  const currentIndex = STEP_INDEX.get(guidance.currentStepId) ?? 0;
  const steps = STEP_BASE.map((step, index) => {
    const status =
      step.id === guidance.currentStepId
        ? guidance.currentStepStatus
        : index < currentIndex
          ? "complete"
          : "pending";
    return { ...step, status };
  });

  return {
    ...guidance,
    postSuccessTab: guidance.recommendedTab,
    queueActionLabel: queueActionLabel(guidance),
    resultExpectation: resultExpectation(guidance.primaryActionKind),
    blockerTasks: blockerTasksFor(unique(blockers)),
    secondaryActions: secondaryActionsFor(guidance),
    disabledReasons: disabledReasonsFor(guidance, request, finalizationStatus),
    reviewPanelMode: reviewPanelModeFor(guidance, request, finalizationStatus),
    agentCommandMode: agentCommandModeFor(guidance),
    blockers: unique(blockers).slice(0, 5),
    steps,
  };
}

function resolveGuidance({
  request,
  auditEvents,
  completeAgentCount,
  runCount,
  allReviewFlags,
  sourceBackedCount,
  blockerCount,
  blockers,
  hasRoute,
  hasDrafts,
  finalizationStatus,
}: {
  request: LegalRequest;
  auditEvents: AuditEvent[];
  completeAgentCount: number;
  runCount: number;
  allReviewFlags: string[];
  sourceBackedCount: number;
  blockerCount: number;
  blockers: string[];
  hasRoute: boolean;
  hasDrafts: boolean;
  finalizationStatus: FinalizationStatus | null;
}): RequestGuidanceCore {
  const process = legalProcessLabel(request);
  const lastAuditAction =
    auditEvents.length > 0
      ? `Last audit event: ${humanizeToken(auditEvents[auditEvents.length - 1].action)}.`
      : "No audit event has been recorded yet.";

  if (request.workflow_state === "request_received") {
    return {
      currentStepId: "intake",
      currentStepStatus: "current",
      recommendedTab: "overview",
      nextRequiredAction: "Extract request",
      nextActionReason: `Start by parsing the ${process} intake into structured request fields. ${lastAuditAction}`,
      primaryActionLabel: "Extract request",
      primaryActionKind: "extract",
      checklist: [
        "Confirm the intake source is present.",
        "Extract legal process, agency, subject identifiers, and requested data.",
        "Keep the draft pending human validation.",
      ],
      queueSummary: "Ready for intake extraction",
    };
  }

  if (
    request.workflow_state === "request_extracted" ||
    request.workflow_state === "request_indexed" ||
    request.workflow_state === "request_classified"
  ) {
    return {
      currentStepId: "evidence",
      currentStepStatus: blockerCount > 0 ? "blocked" : "current",
      recommendedTab: "evidence",
      nextRequiredAction: "Validate extracted fields",
      nextActionReason:
        "Compare extracted fields with source spans before the agent rail starts.",
      primaryActionLabel: "Validate request",
      primaryActionKind: "validate",
      checklist: [
        `Confirm ${sourceBackedCount}/${request.subject_identifiers.length} subject identifiers have source support.`,
        "Review legal process, requested data categories, and special handling.",
        "Resolve blocking deficiencies before drafting work proceeds.",
      ],
      queueSummary: "Needs extracted-field validation",
    };
  }

  if (
    (request.workflow_state === "request_validated" ||
      (runCount === 0 &&
        [
          "route_recommended",
          "etl_simulated",
          "note_drafted",
          "response_package_drafted",
          "deficiency_response_drafted",
          "analyst_review_pending",
          "changes_requested",
          "escalated",
        ].includes(request.workflow_state))) &&
    blockers.length === 0 &&
    blockerCount === 0 &&
    (runCount === 0 || allReviewFlags.length === 0)
  ) {
    return {
      currentStepId: "agents",
      currentStepStatus: "current",
      recommendedTab: "agents",
      nextRequiredAction: "Run six-agent workflow",
      nextActionReason:
        "The request is validated, but agent outputs are not ready for review.",
      primaryActionLabel: "Run six-agent workflow",
      primaryActionKind: "runAgents",
      checklist: [
        "Run the official six-agent rail.",
        "Review each persisted output and evidence link.",
        "Rerun blocked or low-confidence agent work before a human decision.",
      ],
      queueSummary: "Agent workflow is next",
    };
  }

  if (
    blockerCount > 0 ||
    blockers.length > 0 ||
    allReviewFlags.length > 0 ||
    request.workflow_state === "changes_requested" ||
    request.workflow_state === "escalated"
  ) {
    const agentBlocker = blockers.find((blocker) => blocker.includes("Agent:"));
    const [agentBlockerName, agentBlockerReason] = agentBlocker
      ? agentBlocker.split(/:\s*/, 2)
      : [null, null];
    return {
      currentStepId: "risks",
      currentStepStatus: blockers.length > 0 || blockerCount > 0 ? "blocked" : "current",
      recommendedTab: allReviewFlags.length > 0 ? "agents" : "evidence",
      nextRequiredAction:
        request.workflow_state === "escalated"
          ? "Await SME review"
          : agentBlockerName
            ? `Review ${agentBlockerName} blocker`
          : "Resolve review flags",
      nextActionReason:
        agentBlockerName
          ? `${agentBlockerName} is blocked${
              agentBlockerReason ? `: ${humanizeToken(agentBlockerReason)}` : ""
            }. Decide whether to escalate, request a redraft, or inspect supporting evidence.`
          : blockers.length > 0
          ? "Approval is blocked until the listed quality, authority, or agent issues are addressed."
          : "Agent outputs have flags that need human confirmation before approval.",
      primaryActionLabel:
        request.workflow_state === "escalated"
          ? "Review decision panel"
          : agentBlockerName
            ? `Open ${agentBlockerName} output`
          : "Review agent output",
      primaryActionKind:
        request.workflow_state === "escalated" ? "focusDecisionPanel" : "openAgents",
      checklist: [
        `${completeAgentCount}/6 agents are complete.`,
        agentBlockerName
          ? `Inspect the ${agentBlockerName} output, blocker reason, and evidence.`
          : "Inspect flagged agent output and source-backed evidence.",
        "Choose one recovery action: accept, request redraft, request changes, or escalate.",
      ],
      queueSummary:
        request.workflow_state === "escalated"
          ? "SME review is pending"
          : "Review flags need action",
    };
  }

  if (
    request.workflow_state === "analyst_review_pending" ||
    request.workflow_state === "route_recommended" ||
    request.workflow_state === "etl_simulated" ||
    request.workflow_state === "note_drafted" ||
    request.workflow_state === "response_package_drafted" ||
    request.workflow_state === "deficiency_response_drafted"
  ) {
    return {
      currentStepId: "decision",
      currentStepStatus: "current",
      recommendedTab: hasRoute ? "overview" : "agents",
      nextRequiredAction: hasRoute ? "Approve route or request changes" : nextAction(request.workflow_state),
      nextActionReason: hasRoute
        ? "The route recommendation is ready for a recorded human decision."
        : "Review agent output before recording the route decision.",
      primaryActionLabel: hasRoute ? "Review decision panel" : "Review agent output",
      primaryActionKind: hasRoute ? "focusDecisionPanel" : "openAgents",
      checklist: [
        `${completeAgentCount}/6 agents are complete.`,
        hasRoute ? "Confirm the recommended queue and owner." : "Open agent outputs and confirm the route recommendation.",
        "Record approve, changes requested, escalation, or QA handoff in the decision panel.",
      ],
      queueSummary: hasRoute ? "Ready for human decision" : "Agent output review pending",
    };
  }

  if (request.workflow_state === "analyst_approved") {
    return {
      currentStepId: "drafts",
      currentStepStatus: hasDrafts ? "current" : "pending",
      recommendedTab: "drafts",
      nextRequiredAction: hasDrafts ? "Review draft package" : "Draft response package",
      nextActionReason: hasDrafts
        ? "Route approval is recorded; review prepared artifacts before QA or final approval."
        : "Route approval is recorded, but no draft package is available yet.",
      primaryActionLabel: "Open draft package",
      primaryActionKind: "openDrafts",
      checklist: [
        "Review production package, deficiency draft, and note drafts.",
        "Confirm package validation findings are resolved.",
        "Send to QA or record approval when policy allows.",
      ],
      queueSummary: "Package review is next",
    };
  }

  if (request.workflow_state === "sent_to_qa") {
    return {
      currentStepId: "audit",
      currentStepStatus:
        finalizationStatus?.ready_for_approval === false ? "blocked" : "current",
      recommendedTab: "audit",
      nextRequiredAction: "Await QA validation",
      nextActionReason:
        "QA handoff is recorded; monitor audit evidence and finalization blockers.",
      primaryActionLabel: "Open audit trail",
      primaryActionKind: "openAudit",
      checklist: [
        "Review QA-related audit events.",
        "Confirm remaining approval blockers.",
        "Record final approval only when required attestations pass.",
      ],
      queueSummary: "QA validation is pending",
    };
  }

  return {
    currentStepId: "audit",
    currentStepStatus: "complete",
    recommendedTab: "audit",
    nextRequiredAction:
      request.workflow_state === "audit_complete" ? "No action needed" : nextAction(request.workflow_state),
    nextActionReason:
      request.workflow_state === "audit_complete"
        ? "The request has a completed audit trail."
        : "Review the audit trail for the latest recorded state.",
    primaryActionLabel: "Open audit trail",
    primaryActionKind: "openAudit",
    checklist: [
      "Confirm the audit timeline is complete.",
      "Review human decisions and agent-prepared outputs.",
      "No further action is required once audit is complete.",
    ],
    queueSummary:
      request.workflow_state === "audit_complete"
        ? "Audit complete"
        : "Audit review is next",
  };
}

function collectReviewFlags(request: LegalRequest): string[] {
  return [
    ...(request.classification?.review_reasons ?? []),
    ...Object.values(request.agent_runs ?? {}).flatMap((run) => run.risk_flags),
    ...request.deficiency_findings
      .filter((finding) => finding.severity === "blocking")
      .map((finding) => finding.code),
  ];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function queueActionLabel(
  guidance: RequestGuidanceCore,
): string {
  if (guidance.primaryActionKind === "none") {
    return "Open completed audit";
  }
  if (guidance.primaryActionKind === "focusDecisionPanel") {
    return "Open decision panel";
  }
  if (guidance.primaryActionKind === "openAgents") {
    return "Open agent outputs";
  }
  if (guidance.primaryActionKind === "openEvidence") {
    return "Open evidence";
  }
  if (guidance.primaryActionKind === "openDrafts") {
    return "Open draft package";
  }
  if (guidance.primaryActionKind === "openAudit") {
    return "Open audit trail";
  }
  return `Open to ${lowerFirst(guidance.primaryActionLabel)}`;
}

function resultExpectation(kind: RequestGuidedActionKind): string {
  switch (kind) {
    case "extract":
      return "Creates structured fields and records an extraction audit event.";
    case "validate":
      return "Checks extracted fields, special handling, deficiencies, and review policy.";
    case "runAgents":
      return "Runs the official six-agent workflow and refreshes agent outputs.";
    case "focusDecisionPanel":
      return "Moves focus to the human decision controls without recording a decision.";
    case "openEvidence":
    case "openAgents":
    case "openDrafts":
    case "openAudit":
      return "Opens the supporting workspace for the current step.";
    case "none":
    default:
      return "No state-changing action is required.";
  }
}

function secondaryActionsFor(
  guidance: RequestGuidanceCore,
): RequestGuidedSecondaryAction[] {
  const actionsByStep: Record<RequestGuidedStepId, RequestGuidedSecondaryAction[]> = {
    intake: [
      { label: "Inspect evidence", kind: "openEvidence", tab: "evidence" },
      { label: "Open audit trail", kind: "openAudit", tab: "audit" },
    ],
    evidence: [
      { label: "Agent outputs", kind: "openAgents", tab: "agents" },
      { label: "Open audit trail", kind: "openAudit", tab: "audit" },
    ],
    agents: [
      { label: "Inspect evidence", kind: "openEvidence", tab: "evidence" },
      { label: "Open audit trail", kind: "openAudit", tab: "audit" },
    ],
    risks: [
      { label: "Inspect evidence", kind: "openEvidence", tab: "evidence" },
      { label: "Open decision panel", kind: "focusDecisionPanel", tab: "overview" },
    ],
    decision: [
      { label: "Agent outputs", kind: "openAgents", tab: "agents" },
      { label: "Evidence", kind: "openEvidence", tab: "evidence" },
      { label: "Audit trail", kind: "openAudit", tab: "audit" },
    ],
    drafts: [
      { label: "Agent outputs", kind: "openAgents", tab: "agents" },
      { label: "Audit trail", kind: "openAudit", tab: "audit" },
    ],
    audit: [
      { label: "Draft package", kind: "openDrafts", tab: "drafts" },
      { label: "Agent outputs", kind: "openAgents", tab: "agents" },
    ],
  };
  return actionsByStep[guidance.currentStepId].filter(
    (action) => action.kind !== guidance.primaryActionKind,
  );
}

function disabledReasonsFor(
  guidance: RequestGuidanceCore,
  request: LegalRequest,
  finalizationStatus: FinalizationStatus | null,
): string[] {
  const reasons: string[] = [];
  if (guidance.primaryActionKind === "runAgents") {
    const blockedAgents = Object.values(request.agent_runs ?? {}).filter(
      (run) => run.status === "blocked" || run.status === "failed",
    );
    if (blockedAgents.length > 0) {
      reasons.push("Resolve blocked agent runs before rerunning the rail.");
    }
  }
  if (
    guidance.currentStepId === "audit" &&
    finalizationStatus?.ready_for_approval === false
  ) {
    reasons.push("Approval readiness is blocked by the listed finalization reasons.");
  }
  if (request.workflow_state === "audit_complete") {
    reasons.push("Request is already audit complete.");
  }
  return reasons;
}

function blockerTasksFor(blockers: string[]): RequestGuidedBlockerTask[] {
  return blockers.slice(0, 5).map((blocker) => {
    const agentBlocked = blocker.includes("Agent:");
    return {
      label: agentBlocked ? "Agent blocker" : "Review blocker",
      detail: blocker,
      actionLabel: agentBlocked ? "Open agent outputs" : "Inspect evidence",
      actionKind: agentBlocked ? "openAgents" : "openEvidence",
    };
  });
}

function reviewPanelModeFor(
  guidance: RequestGuidanceCore,
  request: LegalRequest,
  finalizationStatus: FinalizationStatus | null,
): RequestReviewPanelMode {
  if (request.workflow_state === "audit_complete") {
    return "complete";
  }
  if (guidance.currentStepId === "risks") {
    return "blocked";
  }
  if (guidance.currentStepId === "decision") {
    return "routeDecision";
  }
  if (guidance.currentStepId === "audit" && finalizationStatus?.ready_for_approval) {
    return "finalApproval";
  }
  return "supporting";
}

function agentCommandModeFor(
  guidance: RequestGuidanceCore,
): RequestAgentCommandMode {
  if (guidance.currentStepId === "agents" || guidance.currentStepId === "risks") {
    return "recommended";
  }
  if (guidance.currentStepId === "decision") {
    return "available";
  }
  return "hidden";
}

function lowerFirst(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toLowerCase() + value.slice(1);
}
