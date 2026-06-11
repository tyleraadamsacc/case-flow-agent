import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { governanceApi } from "../api/client";
import type { AuditEvent } from "../api/types";
import ConsoleShell from "../components/layout/ConsoleShell";
import Card from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import EvidenceLink from "../components/ui/EvidenceLink";
import { OFFICIAL_AGENT_NAMES, agentTheme } from "../theme/agentTheme";
import { formatDateTime, humanizeToken } from "../lib/requestDisplay";

const ACTOR_TYPES = ["system", "agent", "service", "human"] as const;

const AUDIT_LABELS: Record<string, string> = {
  analyst_approved: "Analyst review recorded",
  approved_by_analyst: "Analyst review recorded",
  sent_to_qa: "Pending QA review",
  draft_pending_approval: "Draft pending approval",
  draft_pending_analyst_review: "Draft pending analyst review",
  draft_not_final: "Draft, not final",
  synthetic_mock: "Synthetic / mock",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Day label derived from the ISO string directly — no locale surprises. */
function dayLabel(timestamp: string): string {
  const [year, month, day] = timestamp.slice(0, 10).split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

function actorTone(actorType: AuditEvent["actor_type"]) {
  switch (actorType) {
    case "human":
      return "blue" as const;
    case "agent":
      return "cyan" as const;
    case "service":
      return "violet" as const;
    default:
      return "neutral" as const;
  }
}

function eventIcon(event: AuditEvent): string {
  if (
    event.before_state !== null &&
    event.after_state !== null &&
    event.before_state !== event.after_state
  ) {
    return "S";
  }
  switch (event.actor_type) {
    case "agent":
      return "A";
    case "human":
      return "H";
    case "service":
      return "V";
    default:
      return "Y";
  }
}

function actorLabel(event: AuditEvent): string {
  return event.actor_type === "agent"
    ? humanizeToken(event.actor_id)
    : `${humanizeToken(event.actor_type)} · ${humanizeToken(event.actor_id)}`;
}

function auditLabel(value: string | null): string {
  if (value === null) {
    return "None";
  }
  return AUDIT_LABELS[value] ?? humanizeToken(value);
}

function TimelineEvent({ event }: { event: AuditEvent }) {
  const [open, setOpen] = useState(false);
  const stateChanged =
    event.before_state !== null &&
    event.after_state !== null &&
    event.before_state !== event.after_state;

  const accent =
    event.actor_type === "agent"
      ? agentTheme(event.actor_id)?.accent
      : undefined;

  return (
    <li className="cf-timeline__event">
      <div className="cf-timeline__marker" aria-hidden="true">
        <span
          className={`cf-timeline__dot cf-timeline__dot--${event.actor_type}`}
          style={accent ? { background: accent } : undefined}
        />
        <span className="cf-timeline__icon">{eventIcon(event)}</span>
      </div>
      <div className="cf-timeline__body">
        <div className="cf-timeline__head">
          <span className="cf-timeline__time">
            {formatDateTime(event.timestamp)}
          </span>
          <Chip
            tone={actorTone(event.actor_type)}
            title={humanizeToken(event.actor_type)}
            className="cf-audit__actor-chip"
          >
            {actorLabel(event)}
          </Chip>
          <span className="cf-timeline__action">
            {auditLabel(event.action)}
          </span>
          <Link
            className="cf-timeline__request"
            to={`/requests/${event.legal_request_id}`}
          >
            {event.legal_request_id}
          </Link>
        </div>
        <p className="cf-timeline__summary cf-timeline__summary--clamp">
          {event.summary}
        </p>
        <div className="cf-preview__row cf-audit__event-meta">
          {stateChanged ? (
            <Chip tone="blue" className="cf-audit__state-chip">
              {auditLabel(event.before_state)} to {auditLabel(event.after_state)}
            </Chip>
          ) : null}
          {event.confidence !== null ? (
            <Chip tone="neutral">{Math.round(event.confidence * 100)}% confidence</Chip>
          ) : null}
          <EvidenceLink evidenceIds={event.evidence_ids} />
          <button
            type="button"
            className="cf-agent-card__details-toggle"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide detail" : "Detail"}
          </button>
        </div>
        {open ? (
          <dl className="cf-agent-card__details">
            <div>
              <dt>Event id</dt>
              <dd>{event.audit_event_id}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>{auditLabel(event.before_state)} to {auditLabel(event.after_state)}</dd>
            </div>
            {event.confidence !== null ? (
              <div>
                <dt>Confidence</dt>
                <dd>{Math.round(event.confidence * 100)}%</dd>
              </div>
            ) : null}
            {event.approval_id ? (
              <div>
                <dt>Approval</dt>
                <dd>{event.approval_id}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </li>
  );
}

/** Global audit timeline (plan §13/§14): every agent, human, service,
 * and system action, chronologically, filterable by each of the six
 * agents individually (hard requirement), actor type, and request id.
 * Audit is a product feature here, not a debug log. */
export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<string>("");
  const [actorType, setActorType] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");

  useEffect(() => {
    setEvents(null);
    governanceApi
      .auditEvents({
        agent: agent || undefined,
        actor_type: actorType || undefined,
        legal_request_id: requestId.trim() || undefined,
      })
      .then(setEvents)
      .catch((cause: Error) => setError(cause.message));
  }, [agent, actorType, requestId]);

  const summary = useMemo(() => {
    const source = events ?? [];
    const transitionCount = source.filter(
      (event) =>
        event.before_state !== null &&
        event.after_state !== null &&
        event.before_state !== event.after_state,
    ).length;
    const agentCount = source.filter((event) => event.actor_type === "agent").length;
    const humanCount = source.filter((event) => event.actor_type === "human").length;
    const evidenceCount = source.reduce(
      (count, event) => count + event.evidence_ids.length,
      0,
    );

    return [
      { label: "Visible events", value: source.length, detail: "matching current filters" },
      {
        label: "Agent actions",
        value: agentCount,
        detail: `${humanCount} human action${humanCount === 1 ? "" : "s"}`,
      },
      {
        label: "State changes",
        value: transitionCount,
        detail: "workflow transitions in view",
      },
      {
        label: "Evidence links",
        value: evidenceCount,
        detail: "supporting records attached",
      },
    ];
  }, [events]);

  return (
    <ConsoleShell title="Audit">
      <div className="cf-page-header">
        <h1>Audit</h1>
        <p>
          Every agent action and every human action writes an audit event;
          this is the complete trail. Filter by any of the six agents, actor
          type, or request.
        </p>
      </div>

      <div className="cf-audit__summary-grid" aria-label="Audit summary">
        {summary.map((item) => (
          <Card key={item.label} variant="soft" className="cf-audit__summary-card">
            <span>{item.label}</span>
            <strong>{events === null && !error ? "..." : item.value}</strong>
            <p>{item.detail}</p>
          </Card>
        ))}
      </div>

      <div className="cf-toolbar cf-toolbar--wrap cf-audit__filters">
        <label className="cf-filter">
          <span className="cf-fields__label">Agent</span>
          <select
            className="cf-input"
            value={agent}
            onChange={(event) => setAgent(event.target.value)}
            aria-label="Filter by agent"
          >
            <option value="">All agents</option>
            {OFFICIAL_AGENT_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="cf-filter">
          <span className="cf-fields__label">Actor type</span>
          <select
            className="cf-input"
            value={actorType}
            onChange={(event) => setActorType(event.target.value)}
            aria-label="Filter by actor type"
          >
            <option value="">All actors</option>
            {ACTOR_TYPES.map((type) => (
              <option key={type} value={type}>
                {humanizeToken(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="cf-filter">
          <span className="cf-fields__label">Request</span>
          <input
            type="search"
            className="cf-input"
            placeholder="LER-2026-…"
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            aria-label="Filter by request id"
          />
        </label>
        {events ? (
          <span className="cf-toolbar__count">{events.length} events</span>
        ) : null}
      </div>

      {error ? (
        <Card variant="soft">
          <p style={{ margin: 0, color: "var(--red)" }}>
            Could not load audit events: {error}
          </p>
        </Card>
      ) : null}

      {events && events.length === 0 ? (
        <Card variant="soft">
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            No audit events match these filters.
          </p>
        </Card>
      ) : null}

      {events === null && !error ? (
        <div className="cf-skeleton" role="status" aria-label="Loading audit events">
          <div className="cf-skeleton__row" />
          <div className="cf-skeleton__row" />
          <div className="cf-skeleton__row" />
        </div>
      ) : null}

      {events && events.length > 0 ? (
        <Card className="cf-audit__timeline-card">
          <ol className="cf-timeline">
            {events.map((event, index) => {
              const label = dayLabel(event.timestamp);
              const newDay =
                index === 0 || dayLabel(events[index - 1].timestamp) !== label;
              return (
                <Fragment key={event.audit_event_id}>
                  {newDay ? (
                    <li className="cf-timeline__day" aria-hidden="true">
                      {label}
                    </li>
                  ) : null}
                  <TimelineEvent event={event} />
                </Fragment>
              );
            })}
          </ol>
        </Card>
      ) : null}
    </ConsoleShell>
  );
}
