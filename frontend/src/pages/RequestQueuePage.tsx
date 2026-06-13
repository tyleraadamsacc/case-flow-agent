import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { AgentRun, LegalRequest, WorkflowState } from "../api/types";
import MiniRail from "../components/agents/MiniRail";
import ConsoleShell from "../components/layout/ConsoleShell";
import Card from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import StatusBadge from "../components/ui/StatusBadge";
import { buildRequestGuidance } from "../lib/requestGuidance";
import type { RequestGuidedStepStatus } from "../lib/requestGuidance";
import {
  agencyName,
  auditStatusLabel,
  blockingDeficiencyCount,
  formatDate,
  humanizeToken,
  legalProcessLabel,
  reviewRequirementLabel,
  specialHandlingBadges,
} from "../lib/requestDisplay";

type QueueFilter = "all" | "intake" | "agents" | "review" | "finalized" | "blocked";

type QueueStepId = "intake" | "evidence" | "agents" | "decision" | "audit";

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

const QUEUE_METRICS: Array<{
  id: QueueFilter;
  label: string;
  caption: string;
  tone: "blue" | "cyan" | "violet" | "amber" | "red" | "green";
}> = [
  {
    id: "all",
    label: "All requests",
    caption: "Visible worklist",
    tone: "blue",
  },
  {
    id: "intake",
    label: "New intake",
    caption: "Awaiting extraction",
    tone: "cyan",
  },
  {
    id: "agents",
    label: "Agent workflow",
    caption: "Draft prep in progress",
    tone: "violet",
  },
  {
    id: "review",
    label: "Ready for decision",
    caption: "Human checkpoint",
    tone: "amber",
  },
  {
    id: "blocked",
    label: "Blocked",
    caption: "Needs resolution",
    tone: "red",
  },
  {
    id: "finalized",
    label: "Review recorded",
    caption: "Audit-ready states",
    tone: "green",
  },
];

const WORKFLOW_PREVIEW_STEPS: Array<{ id: QueueStepId; label: string }> = [
  { id: "intake", label: "Intake" },
  { id: "evidence", label: "Evidence" },
  { id: "agents", label: "Agent review" },
  { id: "decision", label: "Human review" },
  { id: "audit", label: "Audit-ready" },
];

const FILTER_LABELS: Array<{ id: QueueFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "intake", label: "Awaiting intake" },
  { id: "agents", label: "Agent workflow" },
  { id: "review", label: "Ready for decision" },
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
  const blocked = values.filter(
    (run) => run.status === "blocked" || run.status === "failed",
  ).length;
  const review = values.filter((run) => run.requires_human_review).length;
  if (values.length === 0) {
    return "Six-agent workflow not started";
  }
  if (blocked > 0) {
    return `${blocked} blocked, ${complete} of 6 complete`;
  }
  if (review > 0) {
    return `${review} agent output${review === 1 ? "" : "s"} need review`;
  }
  return `${complete} of 6 agents complete`;
}

function blockerCopy(count: number): string {
  if (count === 0) {
    return "No blocking deficiencies";
  }
  return `${count} blocking deficienc${count === 1 ? "y" : "ies"}`;
}

function stepClass(status: RequestGuidedStepStatus | undefined): string {
  if (status === "current") {
    return "active";
  }
  return status ?? "pending";
}

/** Analyst worklist: every seeded synthetic request with its state, special
 * handling, six-agent status, deficiency posture, and next human action.
 * Metrics and filters answer "where does work stand" while each card hands
 * the reviewer into the guided request detail flow. */
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

  const focusRequest = filtered?.[0] ?? requests?.[0] ?? null;
  const focusRuns = focusRequest
    ? runsByRequest[focusRequest.legal_request_id] ?? focusRequest.agent_runs
    : {};
  const focusGuidance = focusRequest
    ? buildRequestGuidance({
        request: { ...focusRequest, agent_runs: focusRuns },
      })
    : null;

  return (
    <ConsoleShell title="Request Queue">
      <div className="cf-request-queue-page">
        <div className="cf-queue-hero">
          <div>
            <span className="cf-queue-hero__eyebrow">Human-led legal operations</span>
            <h1>Request Queue</h1>
            <p>
              Synthetic LERS-style requests waiting for guided review. Agents
              prepare draft work only; every route, QA, and approval action is
              recorded by a person.
            </p>
          </div>
          <div className="cf-queue-hero__badges" aria-label="Queue guardrails">
            <Chip tone="violet" dot>
              Synthetic / mock data
            </Chip>
            <Chip tone="cyan" dot>
              Human review required
            </Chip>
          </div>
        </div>

        {requests ? (
          <div className="cf-queue-metrics" aria-label="Queue status summary">
            {QUEUE_METRICS.map((metric) => (
              <button
                key={metric.id}
                type="button"
                className={`cf-queue-metric cf-queue-metric--${metric.tone}`}
                aria-pressed={group === metric.id}
                onClick={() => setGroup(metric.id)}
              >
                <span className="cf-queue-metric__label">
                  <span className="cf-queue-metric__dot" aria-hidden="true" />
                  {metric.label}
                </span>
                <strong>{counts[metric.id]}</strong>
                <small>{metric.caption}</small>
              </button>
            ))}
          </div>
        ) : null}

        <div className="cf-queue-controls">
          <label className="cf-queue-search">
            <span className="cf-sr-only">Filter requests</span>
            <input
              type="search"
              className="cf-input"
              placeholder="Search ID, agency, process, or product domain"
              aria-label="Filter requests"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {requests ? (
            <span className="cf-queue-controls__count">
              {filtered?.length ?? 0} of {requests.length} requests
            </span>
          ) : null}
          {requests ? (
            <div className="cf-queue-filters" aria-label="Queue filters">
              {FILTER_LABELS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className="cf-queue-filter"
                  aria-pressed={group === filter.id}
                  onClick={() => setGroup(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
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

        <div className="cf-queue-layout">
          <section className="cf-queue-layout__primary" aria-label="Request worklist">
            <div className="cf-queue-section-heading">
              <div>
                <h2>Requests needing review</h2>
                <p>
                  Open a request to continue the guided review path. Nothing is
                  sent, released, or disclosed from this queue.
                </p>
              </div>
              {requests ? (
                <span>{filtered?.length ?? 0} visible</span>
              ) : null}
            </div>

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
                      ? "Clear the filter or pick another status above to see the rest of the queue."
                      : "Seeded requests appear here when the backend starts (make dev-backend)."}
                  </p>
                </div>
              </Card>
            ) : null}

            <div className="cf-queue">
              {filtered?.map((request) => {
                const latestRuns =
                  runsByRequest[request.legal_request_id] ?? request.agent_runs;
                const guidedRequest: LegalRequest = {
                  ...request,
                  agent_runs: latestRuns,
                };
                const guidance = buildRequestGuidance({ request: guidedRequest });
                const badges = specialHandlingBadges(request.special_handling);
                const blocking = blockingDeficiencyCount(request);
                const progressSteps = WORKFLOW_PREVIEW_STEPS.map((step) => {
                  const derived = guidance.steps.find(
                    (guidedStep) => guidedStep.id === step.id,
                  );
                  return {
                    ...step,
                    status: derived?.status,
                  };
                });
                return (
                  <button
                    key={request.legal_request_id}
                    type="button"
                    aria-label={`${guidance.queueActionLabel} for request ${request.legal_request_id}. Next required action: ${guidance.nextRequiredAction}. ${guidance.queueSummary}.`}
                    className="cf-queue__row"
                    onClick={() =>
                      navigate(`/requests/${request.legal_request_id}?intent=next`)
                    }
                  >
                    <span className="cf-queue__topline">
                      <span className="cf-queue__identity">
                        <span className="cf-queue__id">{request.legal_request_id}</span>
                        <span className="cf-queue__agency">{agencyName(request)}</span>
                      </span>
                      <span className="cf-queue__badges">
                        <StatusBadge status={request.workflow_state} />
                        <Chip tone="violet">Synthetic / mock</Chip>
                      </span>
                    </span>

                    <span className="cf-queue__body">
                      <span className="cf-queue__main">
                        <strong>{guidance.queueSummary}</strong>
                        <span className="cf-queue__meta">
                          {legalProcessLabel(request)} · received{" "}
                          {formatDate(request.date_received)}
                        </span>
                      </span>

                      <span className="cf-queue__action">
                        <span>Next required action</span>
                        <strong>{guidance.nextRequiredAction}</strong>
                        <small>{guidance.nextActionReason}</small>
                      </span>
                    </span>

                    <span className="cf-queue__chips">
                      {request.urgency_tier ? (
                        <Chip tone={urgencyTone(request.urgency_tier)} dot>
                          {humanizeToken(request.urgency_tier)}
                        </Chip>
                      ) : null}
                      <Chip tone={blocking > 0 ? "red" : "green"} dot>
                        {blockerCopy(blocking)}
                      </Chip>
                      {request.product_domains.slice(0, 2).map((domain) => (
                        <Chip key={domain} tone="cyan">
                          {domain}
                        </Chip>
                      ))}
                      {badges.slice(0, 2).map((badge) => (
                        <Chip key={badge} tone="violet" dot>
                          {badge}
                        </Chip>
                      ))}
                      {badges.length > 2 ? (
                        <Chip tone="violet">+{badges.length - 2}</Chip>
                      ) : null}
                    </span>

                    <span className="cf-queue__progress">
                      <span className="cf-queue-stepper" aria-label="Guided workflow preview">
                        {progressSteps.map((step) => (
                          <span
                            key={step.id}
                            className={`cf-queue-step cf-queue-step--${stepClass(
                              step.status,
                            )}`}
                          >
                            {step.label}
                          </span>
                        ))}
                      </span>
                      <span className="cf-queue__agent-line">
                        <MiniRail runs={latestRuns} />
                        <span>{agentProgressLabel(latestRuns)}</span>
                      </span>
                      <span className="cf-queue__audit-line">
                        {reviewRequirementFor(request, latestRuns)} ·{" "}
                        {auditStatusFor(request, latestRuns)}
                      </span>
                      <span className="cf-queue__open">
                        {guidance.queueActionLabel}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="cf-queue-layout__secondary" aria-label="Queue guidance">
            <Card variant="soft" className="cf-queue-guide">
              <span className="cf-queue-guide__eyebrow">Guided processing path</span>
              <h2>Open one request, then follow the active step.</h2>
              <p>
                The detail view shows where the reviewer is, why the next
                action is required, blockers, evidence, and the audit event that
                will be logged.
              </p>
              <ol className="cf-queue-guide__steps" aria-label="Workflow walkthrough">
                <li>Intake</li>
                <li>Evidence</li>
                <li>Agent review</li>
                <li>Human review</li>
                <li>Audit-ready</li>
              </ol>
              <div className="cf-queue-guide__next">
                <span>Next</span>
                <strong>
                  {focusGuidance?.nextRequiredAction ??
                    "Open a request to begin extraction"}
                </strong>
              </div>
            </Card>

            <Card variant="default" className="cf-queue-insight">
              <span className="cf-queue-guide__eyebrow">Queue insight</span>
              <h2>Review stays human-owned.</h2>
              <p>
                Six agents prepare evidence, labels, notes, draft content, and
                action recommendations. Analysts still decide route changes,
                QA handoff, approvals, and escalations.
              </p>
              <div className="cf-queue-insight__facts">
                <span>
                  <strong>{counts.blocked}</strong>
                  Blocked
                </span>
                <span>
                  <strong>{counts.review}</strong>
                  Decision-ready
                </span>
                <span>
                  <strong>{counts.finalized}</strong>
                  Review recorded
                </span>
              </div>
            </Card>

            {focusRequest && focusGuidance ? (
              <Card variant="default" className="cf-queue-preview">
                <span className="cf-queue-guide__eyebrow">First visible request</span>
                <div className="cf-queue-preview__title">
                  <h2>{focusRequest.legal_request_id}</h2>
                  <StatusBadge status={focusRequest.workflow_state} />
                </div>
                <p>
                  {agencyName(focusRequest)} · {legalProcessLabel(focusRequest)}
                </p>
                <div className="cf-queue-preview__action">
                  <span>Next required action</span>
                  <strong>{focusGuidance.nextRequiredAction}</strong>
                  <small>{focusGuidance.nextActionReason}</small>
                </div>
              </Card>
            ) : null}
          </aside>
        </div>
      </div>
    </ConsoleShell>
  );
}
