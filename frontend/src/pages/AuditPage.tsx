import { Fragment, useEffect, useState } from "react";
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
      <span
        className={`cf-timeline__dot cf-timeline__dot--${event.actor_type}`}
        style={accent ? { background: accent } : undefined}
        aria-hidden="true"
      />
      <div className="cf-timeline__body">
        <div className="cf-timeline__head">
          <span className="cf-timeline__time">
            {formatDateTime(event.timestamp)}
          </span>
          <Chip tone={actorTone(event.actor_type)} title={event.actor_type}>
            {event.actor_type === "agent"
              ? humanizeToken(event.actor_id)
              : humanizeToken(event.actor_id)}
          </Chip>
          <span className="cf-timeline__action">
            {humanizeToken(event.action)}
          </span>
          <Link
            className="cf-timeline__request"
            to={`/requests/${event.legal_request_id}`}
          >
            {event.legal_request_id}
          </Link>
        </div>
        <p className="cf-timeline__summary">{event.summary}</p>
        <div className="cf-preview__row">
          {stateChanged ? (
            <Chip tone="blue">
              {humanizeToken(event.before_state ?? "")} →{" "}
              {humanizeToken(event.after_state ?? "")}
            </Chip>
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
              <dd>
                {event.before_state ?? "none"} → {event.after_state ?? "none"}
              </dd>
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

      <div className="cf-toolbar cf-toolbar--wrap">
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
        <Card>
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
