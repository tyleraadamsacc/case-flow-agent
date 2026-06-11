import type { AgentRun, AgentRunReview, AgentRunStatus } from "../../api/types";
import { AGENT_RAIL_ORDER, AGENT_THEME, type AgentId } from "../../theme/agentTheme";

export type CommandBarTarget =
  | "current_agent"
  | "downstream_agents"
  | "package_draft"
  | "classification"
  | "deficiency_analysis";

export const COMMAND_BAR_TARGET_LABELS: Record<CommandBarTarget, string> = {
  current_agent: "Current agent",
  downstream_agents: "Downstream agents",
  package_draft: "Package draft",
  classification: "Classification",
  deficiency_analysis: "Deficiency analysis",
};

export const COMMAND_BAR_TARGETS: readonly CommandBarTarget[] = [
  "current_agent",
  "downstream_agents",
  "package_draft",
  "classification",
  "deficiency_analysis",
];

export interface AgentStatusDerivation {
  status: AgentRunStatus;
  label: string;
  requiresHumanDecision: boolean;
  isBlocked: boolean;
  isStale: boolean;
  hasDependencyIssue: boolean;
  reasons: string[];
}

export interface DownstreamStaleMarker {
  agentId: string;
  agentName: string;
  stale: boolean;
  reason: string | null;
  upstreamCompletedAt: string | null;
  downstreamCompletedAt: string | null;
}

export type DiffKind = "added" | "removed" | "changed";

export interface PreviousCurrentDiff {
  path: string;
  kind: DiffKind;
  previous: string;
  current: string;
}

export function deriveAgentStatus(
  run: Pick<
    AgentRun,
    | "status"
    | "requires_human_review"
    | "review_reasons"
    | "risk_flags"
    | "blocked_reason"
  > | null | undefined,
  options: {
    stale?: boolean;
    dependencyReasons?: string[];
    latestReview?: Pick<AgentRunReview, "decision"> | null;
  } = {},
): AgentStatusDerivation {
  const status = run?.status ?? "waiting";
  const dependencyReasons = options.dependencyReasons ?? [];
  const reviewReasons = run?.review_reasons ?? [];
  const riskFlags = run?.risk_flags ?? [];
  const hasDependencyIssue = dependencyReasons.length > 0;
  const requiresHumanDecision = Boolean(
    run?.requires_human_review ||
      status === "needs_review" ||
      status === "blocked" ||
      status === "failed",
  );
  const isBlocked = status === "blocked" || status === "failed";
  const reasons = [
    run?.blocked_reason,
    ...dependencyReasons,
    ...reviewReasons,
    ...riskFlags,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    status,
    label: statusLabel(status, {
      stale: Boolean(options.stale),
      hasDependencyIssue,
      latestReview: options.latestReview?.decision ?? null,
    }),
    requiresHumanDecision,
    isBlocked,
    isStale: Boolean(options.stale),
    hasDependencyIssue,
    reasons,
  };
}

export function downstreamAgentIds(
  agentId: string,
  order: readonly string[] = AGENT_RAIL_ORDER,
): string[] {
  const index = order.indexOf(agentId);
  return index >= 0 ? order.slice(index + 1) : [];
}

export function deriveDownstreamStaleMarkers(
  changedAgentId: string,
  runs: AgentRun[] | Record<string, AgentRun>,
  options: { changedAt?: string | null } = {},
): DownstreamStaleMarker[] {
  const runMap = normalizeRuns(runs);
  const upstreamRun = runMap[changedAgentId];
  const upstreamCompletedAt = options.changedAt ?? upstreamRun?.completed_at ?? null;
  const upstreamTime = timeValue(upstreamCompletedAt);

  return downstreamAgentIds(changedAgentId).map((agentId) => {
    const downstreamRun = runMap[agentId];
    const downstreamCompletedAt = downstreamRun?.completed_at ?? null;
    const downstreamTime = timeValue(downstreamCompletedAt);
    const stale = Boolean(
      upstreamTime !== null &&
        downstreamRun &&
        downstreamRun.status !== "waiting" &&
        (downstreamTime === null || downstreamTime < upstreamTime),
    );

    return {
      agentId,
      agentName: AGENT_THEME[agentId as AgentId]?.officialName ?? agentId,
      stale,
      reason: stale
        ? `${AGENT_THEME[agentId as AgentId]?.officialName ?? agentId} was prepared before the upstream change.`
        : null,
      upstreamCompletedAt,
      downstreamCompletedAt,
    };
  });
}

export function simplePreviousCurrentDiff(
  previous: unknown,
  current: unknown,
  options: { maxDepth?: number } = {},
): PreviousCurrentDiff[] {
  const maxDepth = options.maxDepth ?? 4;
  const diffs: PreviousCurrentDiff[] = [];
  collectDiffs(previous, current, "", 0, maxDepth, diffs);
  return diffs;
}

function normalizeRuns(runs: AgentRun[] | Record<string, AgentRun>): Record<string, AgentRun> {
  if (Array.isArray(runs)) {
    return Object.fromEntries(runs.map((run) => [run.agent_id, run]));
  }
  return runs;
}

function statusLabel(
  status: AgentRunStatus,
  context: {
    stale: boolean;
    hasDependencyIssue: boolean;
    latestReview: AgentRunReview["decision"] | null;
  },
): string {
  if (context.latestReview === "accepted") {
    return context.stale ? "Accepted, downstream stale" : "Accepted by human";
  }
  if (context.latestReview === "sent_back") {
    return "Sent back for rerun";
  }
  if (context.hasDependencyIssue) {
    return "Dependency needs review";
  }
  if (context.stale) {
    return "Stale after upstream change";
  }
  return status.replace(/_/g, " ");
}

function timeValue(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function collectDiffs(
  previous: unknown,
  current: unknown,
  path: string,
  depth: number,
  maxDepth: number,
  diffs: PreviousCurrentDiff[],
) {
  if (Object.is(previous, current)) {
    return;
  }

  if (depth >= maxDepth || !isRecordLike(previous) || !isRecordLike(current)) {
    pushLeafDiff(previous, current, path || "value", diffs);
    return;
  }

  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  for (const key of [...keys].sort()) {
    const nextPath = path ? `${path}.${key}` : key;
    const previousHasKey = Object.prototype.hasOwnProperty.call(previous, key);
    const currentHasKey = Object.prototype.hasOwnProperty.call(current, key);

    if (!previousHasKey) {
      diffs.push({
        path: nextPath,
        kind: "added",
        previous: "",
        current: formatDiffValue(current[key]),
      });
      continue;
    }
    if (!currentHasKey) {
      diffs.push({
        path: nextPath,
        kind: "removed",
        previous: formatDiffValue(previous[key]),
        current: "",
      });
      continue;
    }
    collectDiffs(previous[key], current[key], nextPath, depth + 1, maxDepth, diffs);
  }
}

function pushLeafDiff(
  previous: unknown,
  current: unknown,
  path: string,
  diffs: PreviousCurrentDiff[],
) {
  if (previous === undefined) {
    diffs.push({ path, kind: "added", previous: "", current: formatDiffValue(current) });
    return;
  }
  if (current === undefined) {
    diffs.push({ path, kind: "removed", previous: formatDiffValue(previous), current: "" });
    return;
  }
  diffs.push({
    path,
    kind: "changed",
    previous: formatDiffValue(previous),
    current: formatDiffValue(current),
  });
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatDiffValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
