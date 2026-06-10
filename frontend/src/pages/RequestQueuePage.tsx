import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { LegalRequest } from "../api/types";
import ConsoleShell from "../components/layout/ConsoleShell";
import Card from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import StatusBadge from "../components/ui/StatusBadge";
import {
  agencyName,
  blockingDeficiencyCount,
  formatDate,
  legalProcessLabel,
  nextAction,
  specialHandlingBadges,
} from "../lib/requestDisplay";

/** Analyst worklist (plan §13): every seeded synthetic request with its
 * state, special-handling badges, deficiency status, and next human
 * action. Rows navigate to Request Detail. */
export default function RequestQueuePage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LegalRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api
      .listLegalRequests()
      .then(setRequests)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  const filtered = useMemo(() => {
    if (!requests) {
      return null;
    }
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return requests;
    }
    return requests.filter((request) =>
      [
        request.legal_request_id,
        agencyName(request),
        legalProcessLabel(request),
        request.product_domains.join(" "),
        request.workflow_state,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [requests, query]);

  return (
    <ConsoleShell title="Request Queue">
      <div className="cf-page-header">
        <h1>Request Queue</h1>
        <p>
          Synthetic LERS-style requests awaiting human-led processing. Every
          action below is drafted or prepared by agents and decided by a person.
        </p>
      </div>

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
        <Card variant="soft">
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>Loading…</p>
        </Card>
      ) : null}

      {filtered && filtered.length === 0 ? (
        <Card variant="soft">
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            No requests match this filter.
          </p>
        </Card>
      ) : null}

      <div className="cf-queue">
        {filtered?.map((request) => {
          const badges = specialHandlingBadges(request.special_handling);
          const blocking = blockingDeficiencyCount(request);
          return (
            <button
              key={request.legal_request_id}
              type="button"
              className="cf-queue__row"
              onClick={() => navigate(`/requests/${request.legal_request_id}`)}
            >
              <span className="cf-queue__id">{request.legal_request_id}</span>
              <span className="cf-queue__main">
                <span className="cf-queue__agency">{agencyName(request)}</span>
                <span className="cf-queue__meta">
                  {legalProcessLabel(request)} · received{" "}
                  {formatDate(request.date_received)}
                  {request.urgency_tier
                    ? ` · urgency: ${request.urgency_tier}`
                    : ""}
                </span>
              </span>
              <span className="cf-queue__chips">
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
                {blocking > 0 ? (
                  <Chip tone="red" dot>
                    {blocking} blocking deficienc{blocking === 1 ? "y" : "ies"}
                  </Chip>
                ) : null}
              </span>
              <StatusBadge status={request.workflow_state} />
              <span className="cf-queue__next">
                {nextAction(request.workflow_state)}
              </span>
            </button>
          );
        })}
      </div>
    </ConsoleShell>
  );
}
