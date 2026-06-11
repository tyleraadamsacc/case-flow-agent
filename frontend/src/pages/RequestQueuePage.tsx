import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { AgentRun, LegalRequest, WorkflowState } from "../api/types";
import MiniRail from "../components/agents/MiniRail";
import ConsoleShell from "../components/layout/ConsoleShell";
import Card from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import StatusBadge from "../components/ui/StatusBadge";
import {
  agencyName,
  auditStatusLabel,
  blockingDeficiencyCount,
  formatDate,
  humanizeToken,
  legalProcessLabel,
  nextAction,
  reviewRequirementLabel,
  specialHandlingBadges,
  workflowStateLabel,
} from "../lib/requestDisplay";

type QueueFilter = "all" | "intake" | "agents" | "review" | "finalized" | "blocked";

function stateGroup(
  state: WorkflowState,
): Exclude<QueueFilter, "all" | "blocked"> {
  if (state === "request_received") {
    return "intake";
  }
  if (
    state === "analyst_review_pending" ||
    state === "changes_requested" ||
    state === "escalated" ||
    state === "sent_to_qa"
  ) {
    return "review";
  }
  if (state === "analyst_approved" || state === "audit_complete") {
    return "finalized";
  }
  return "agents";
}

/** Blocked is an overlay, not a workflow state: a blocking deficiency or
 * a blocked/failed agent run, whatever the request's state. */
function isBlocked(
  request: LegalRequest,
  runs: Record<string, AgentRun> | undefined,
): boolean {
  if (blockingDeficiencyCount(request) > 0) {
    return true;
  }
  return Object.values(runs ?? request.agent_runs).some(
    (run) => run.status === "blocked" || run.status === "failed",
  );
}

function urgencyTone(tier: string): "red" | "amber" | "neutral" {
  const lowered = tier.toLowerCase();
  if (lowered.includes("emergency") || lowered.includes("expedited")) {
    return "red";
  }
  if (lowered.includes("high") || lowered.includes("priority")) {
    return "amber";
  }
  return "neutral";
}

const PULSE_TILES: Array<{ id: QueueFilter; label: string }> = [
  { id: "all", label: "All requests" },
  { id: "intake", label: "New intake" },
  { id: "agents", label: "Agent workflow" },
  { id: "review", label: "Human decision" },
  { id: "blocked", label: "Blocked" },
  { id: "finalized", label: "Review recorded" },
];

function auditStatusFor(
  request: LegalRequest,
  runs: Record<string, AgentRun>,
): string {
  return auditStatusLabel({ ...request, agent_runs: runs });
}

function reviewRequirementFor(
  request: LegalRequest,
  runs: Record<string, AgentRun>,
): string {
  if (blockingDeficiencyCount(request) > 0) {
    return reviewRequirementLabel(request);
  }
  if (Object.values(runs).some((run) => run.requires_human_review)) {
    return "Agent output review required";
  }
  return reviewRequirementLabel(request);
}

function agentProgressLabel(runs: Record<string, AgentRun>): string {
  const values = Object.values(runs);
  const complete = values.filter((run) => run.status === "complete").length;
  const review = values.filter((run) => run.requires_human_review).length;
  if (values.length === 0) {
    return "Six-agent workflow not started";
  }
  if (review > 0) {
    return `${review} agent output${review === 1 ? "" : "s"} need review`;
  }
  return `${complete} of 6 agents complete`;
}

function requestRiskLabels(request: LegalRequest): string[] {
  const labels = new Set<string>();
  for (const finding of request.deficiency_findings) {
    if (finding.severity === "blocking") {
      labels.add("Blocking deficiency");
    } else {
      labels.add("Warning deficiency");
    }
  }
  for (const finding of request.package_validation_findings) {
    labels.add(humanizeToken(finding.severity));
  }
  if (request.routing_recommendation?.sla_risk) {
    labels.add("SLA risk");
  }
  return Array.from(labels);
}

/** Analyst worklist (plan §13): every seeded synthetic request with its
 * state, special-handling badges, six-agent status, deficiency status,
 * and next human action. The pulse strip above the queue doubles as a
 * filter — each tile answers "where does work stand" and clicks into
 * that slice. Rows navigate to Request Detail. */
export default function RequestQueuePage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LegalRequest[] | null>(null);
  const [runsByRequest, setRunsByRequest] = useState<
    Record<string, Record<string, AgentRun>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<QueueFilter>("all");

  useEffect(() => {
    api
      .listLegalRequests()
      .then((list) => {
        setRequests(list);
        // The list endpoint does not hydrate agent_runs; fetch the run
        // history per request and keep the latest run per agent so the
        // mini rail reflects persisted reality.
        return Promise.all(
          list.map((request) =>
            api
              .listAgentRuns(request.legal_request_id)
              .then((runs) => {
                const latest: Record<string, AgentRun> = {};
                for (const run of runs) {
                  latest[run.agent_id] = run;
                }
                return [request.legal_request_id, latest] as const;
              })
              .catch(
                () =>
                  [
                    request.legal_request_id,
                    request.agent_runs,
                  ] as const,
              ),
          ),
        ).then((entries) => setRunsByRequest(Object.fromEntries(entries)));
      })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  const counts = useMemo(() => {
    const result: Record<QueueFilter, number> = {
      all: requests?.length ?? 0,
      intake: 0,
      agents: 0,
      review: 0,
      blocked: 0,
      finalized: 0,
    };
    for (const request of requests ?? []) {
      result[stateGroup(request.workflow_state)] += 1;
      if (isBlocked(request, runsByRequest[request.legal_request_id])) {
        result.blocked += 1;
      }
    }
    return result;
  }, [requests, runsByRequest]);

  const filtered = useMemo(() => {
    if (!requests) {
      return null;
    }
    const needle = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (
        group === "blocked" &&
        !isBlocked(request, runsByRequest[request.legal_request_id])
      ) {
        return false;
      }
      if (
        group !== "all" &&
        group !== "blocked" &&
        stateGroup(request.workflow_state) !== group
      ) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [
        request.legal_request_id,
        agencyName(request),
        legalProcessLabel(request),
        request.product_domains.join(" "),
        request.workflow_state,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [requests, runsByRequest, query, group]);

  return (
    <ConsoleShell title="Request Queue">
      <div className="cf-page-header">
        <h1>Request Queue</h1>
        <p>
          Synthetic LERS-style requests awaiting human-led processing. Every
          action below is drafted or prepared by agents and decided by a person.
        </p>
      </div>

      {requests ? (
        <div className="cf-queue-overview">
          <div className="cf-pulse-strip">
            {PULSE_TILES.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="cf-pulse"
                aria-pressed={group === tile.id}
                onClick={() => setGroup(tile.id)}
              >
                <span className="cf-pulse__value">{counts[tile.id]}</span>
                <span className="cf-pulse__label">{tile.label}</span>
              </button>
            ))}
          </div>
          <Card variant="soft" className="cf-queue-demo">
            <span className="cf-queue-demo__eyebrow">Demo walkthrough</span>
            <h2>From intake to human decision</h2>
            <p>
              Open a request to inspect the extracted legal process, six-agent
              outputs, draft package, and audit trail. Agents prepare evidence;
              analysts decide what moves forward.
            </p>
            <div className="cf-queue-demo__steps" aria-label="Workflow walkthrough">
              <span>Intake</span>
              <span>Agent checks</span>
              <span>Human review</span>
              <span>Audit-ready</span>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="cf-toolbar">
        <input
          type="search"
          className="cf-input"
          placeholder="Filter by ID, agency, process, or domain"
          aria-label="Filter requests"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {requests ? (
          <span className="cf-toolbar__count">
            {filtered?.length ?? 0} of {requests.length} requests
          </span>
        ) : null}
      </div>

      {error ? (
        <Card variant="soft">
          <p style={{ margin: 0, color: "var(--red)" }}>
            Could not load the queue: {error}. Is the backend running
            (`make dev-backend`)?
          </p>
        </Card>
      ) : null}

      {!error && filtered === null ? (
        <div className="cf-skeleton" role="status" aria-label="Loading requests">
          <div className="cf-skeleton__row" />
          <div className="cf-skeleton__row" />
          <div className="cf-skeleton__row" />
          <div className="cf-skeleton__row" />
        </div>
      ) : null}

      {filtered && filtered.length === 0 ? (
        <Card variant="soft">
          <div className="cf-empty">
            <h3>No requests in this view</h3>
            <p>
              {requests && requests.length > 0
                ? "Clear the filter or pick another tile above to see the rest of the queue."
                : "Seeded requests appear here when the backend starts (make dev-backend)."}
            </p>
          </div>
        </Card>
      ) : null}

      <div className="cf-queue">
        {filtered?.map((request) => {
          const badges = specialHandlingBadges(request.special_handling);
          const blocking = blockingDeficiencyCount(request);
          const runs =
            runsByRequest[request.legal_request_id] ?? request.agent_runs;
          const riskLabels = requestRiskLabels(request);
          return (
            <button
              key={request.legal_request_id}
              type="button"
              className="cf-queue__row"
              onClick={() => navigate(`/requests/${request.legal_request_id}`)}
            >
              <span className="cf-queue__topline">
                <span className="cf-queue__id">{request.legal_request_id}</span>
                <StatusBadge status={request.workflow_state} />
                <Chip tone="neutral" dot>
                  Synthetic / mock
                </Chip>
              </span>

              <span className="cf-queue__body">
                <span className="cf-queue__main">
                  <span className="cf-queue__agency">{agencyName(request)}</span>
                  <span className="cf-queue__meta">
                    {legalProcessLabel(request)} · received{" "}
                    {formatDate(request.date_received)}
                  </span>
                </span>

                <span className="cf-queue__chips">
                  {request.urgency_tier ? (
                    <Chip tone={urgencyTone(request.urgency_tier)} dot>
                      {humanizeToken(request.urgency_tier)}
                    </Chip>
                  ) : null}
                  {request.product_domains.slice(0, 3).map((domain) => (
                    <Chip key={domain} tone="cyan">
                      {domain}
                    </Chip>
                  ))}
                  {badges.slice(0, 3).map((badge) => (
                    <Chip key={badge} tone="violet" dot>
                      {badge}
                    </Chip>
                  ))}
                  {badges.length > 3 ? (
                    <Chip tone="violet">+{badges.length - 3}</Chip>
                  ) : null}
                  {riskLabels.map((label) => (
                    <Chip
                      key={label}
                      tone={label.includes("Blocking") ? "red" : "amber"}
                      dot
                    >
                      {label}
                    </Chip>
                  ))}
                  {blocking > 0 ? (
                    <span className="cf-sr-only">
                      {blocking} blocking deficienc
                      {blocking === 1 ? "y" : "ies"}
                    </span>
                  ) : null}
                </span>
              </span>

              <span className="cf-queue__workflow">
                <span className="cf-queue__metric">
                  <span className="cf-queue__label">Workflow state</span>
                  <span>{workflowStateLabel(request.workflow_state)}</span>
                </span>
                <span className="cf-queue__metric">
                  <span className="cf-queue__label">Six-agent preview</span>
                  <span className="cf-queue__railcopy">
                    <MiniRail runs={runs} />
                    {agentProgressLabel(runs)}
                  </span>
                </span>
                <span className="cf-queue__metric">
                  <span className="cf-queue__label">Next human action</span>
                  <span>{nextAction(request.workflow_state)}</span>
                </span>
                <span className="cf-queue__metric">
                  <span className="cf-queue__label">Review requirement</span>
                  <span>{reviewRequirementFor(request, runs)}</span>
                </span>
                <span className="cf-queue__metric">
                  <span className="cf-queue__label">Audit status</span>
                  <span>{auditStatusFor(request, runs)}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </ConsoleShell>
  );
}
