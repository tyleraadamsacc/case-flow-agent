import { useState } from "react";

import { api, ApiError } from "../../api/client";
import type { AuditEvent, LegalRequest } from "../../api/types";
import { humanizeToken } from "../../lib/requestDisplay";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Chip from "../ui/Chip";
import StatusBadge from "../ui/StatusBadge";

export interface ReviewPanelProps {
  request: LegalRequest;
  auditEvents: AuditEvent[];
  /** Called with the updated request after any successful human action. */
  onUpdated: (request: LegalRequest) => void;
}

/** The human decision surface (plan §13 Human Review): the agent
 * recommendation as context, risk/review reasons, and the four human
 * actions — approve, request changes, escalate to SME, send to QA.
 * Every decision here is made by a person; the panel exposes no
 * agent-side approval. */
export default function ReviewPanel({
  request,
  auditEvents,
  onUpdated,
}: ReviewPanelProps) {
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const classification = request.classification;
  const routing = request.routing_recommendation;
  const reviewReasons = classification?.review_reasons ?? [];
  const riskFlags = Object.values(request.agent_runs).flatMap(
    (run) => run.risk_flags,
  );

  async function act(name: string, call: () => Promise<LegalRequest>) {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      const updated = await call();
      onUpdated(updated);
      setComments("");
      setNotice(`${name} recorded. Audit event logged.`);
    } catch (cause) {
      if (cause instanceof ApiError) {
        const detail =
          typeof cause.detail === "string"
            ? cause.detail
            : JSON.stringify(cause.detail);
        setError(`${name} refused: ${detail}`);
      } else {
        setError(`${name} failed: ${(cause as Error).message}`);
      }
    } finally {
      setBusy(null);
    }
  }

  const trimmed = comments.trim();

  return (
    <div className="cf-review">
      <Card title="Human review" subtitle="All decisions are made by a person">
        <div className="cf-review__state">
          <StatusBadge status={request.workflow_state} />
        </div>

        {routing ? (
          <p className="cf-review__recommendation">
            Recommended route:{" "}
            <strong>{routing.target_queue ?? "pending"}</strong>
            {routing.reason ? (
              <span className="cf-fields__muted"> · {routing.reason}</span>
            ) : null}{" "}
            <Chip tone="blue">Pending human approval</Chip>
          </p>
        ) : (
          <p className="cf-review__recommendation cf-fields__muted">
            No route recommendation yet. Run the six-agent workflow.
          </p>
        )}

        {reviewReasons.length > 0 ? (
          <div className="cf-review__reasons">
            <h4 className="cf-fields__label">Review reasons</h4>
            <div className="cf-preview__row">
              {reviewReasons.map((reason) => (
                <Chip key={reason} tone="amber" dot>
                  {humanizeToken(reason)}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        {riskFlags.length > 0 ? (
          <div className="cf-review__reasons">
            <h4 className="cf-fields__label">Risk flags</h4>
            <div className="cf-preview__row">
              {[...new Set(riskFlags)].map((flag) => (
                <Chip key={flag} tone="red" dot>
                  {humanizeToken(flag)}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        <label className="cf-fields__label" htmlFor="review-comments">
          Comments
        </label>
        <textarea
          id="review-comments"
          className="cf-input cf-review__comments"
          rows={3}
          placeholder="Reviewer comments (recorded in the audit trail)"
          value={comments}
          onChange={(event) => setComments(event.target.value)}
        />

        <div className="cf-review__actions">
          <Button
            variant="filled"
            disabled={busy !== null}
            onClick={() =>
              act("Route approval", async () => {
                const reviewed = await api.review(request.legal_request_id, {
                  action: "approve",
                  comments: trimmed || undefined,
                });
                return reviewed.legal_request;
              })
            }
          >
            {busy === "Route approval" ? "Approving…" : "Approve route"}
          </Button>
          <Button
            disabled={busy !== null}
            onClick={() =>
              act("Change request", async () => {
                const response = await api.review(request.legal_request_id, {
                  action: "request_changes",
                  comments: trimmed || undefined,
                });
                return response.legal_request;
              })
            }
          >
            Request changes
          </Button>
          <Button
            disabled={busy !== null}
            onClick={() =>
              act("Escalation", async () => {
                const response = await api.escalate(request.legal_request_id, {
                  reason: trimmed || "Analyst escalation",
                });
                return response.legal_request;
              })
            }
          >
            Escalate to SME
          </Button>
          <Button
            variant="outlined"
            disabled={busy !== null}
            onClick={() =>
              act("QA handoff", async () => {
                const response = await api.sendToQa(request.legal_request_id, {
                  reason: trimmed || undefined,
                });
                return response.legal_request;
              })
            }
          >
            Send to QA
          </Button>
          <Button
            disabled={busy !== null}
            onClick={() =>
              act("Finalization", async () => {
                const response = await api.approve(request.legal_request_id, {
                  comments: trimmed || undefined,
                });
                return response.legal_request;
              })
            }
          >
            {busy === "Finalization" ? "Finalizing…" : "Finalize request"}
          </Button>
        </div>
        <p className="cf-review__hint">
          Approving the route records your decision and clears agent holds;
          re-run the six-agent workflow afterwards if any run was blocked.
          Finalize completes the audit once nothing is blocked.
        </p>

        {error ? <p className="cf-review__error">{error}</p> : null}
        {notice ? <p className="cf-review__notice">{notice}</p> : null}
      </Card>

      <Card title="Audit" subtitle={`${auditEvents.length} events logged`}>
        <ul className="cf-audit-mini">
          {auditEvents.slice(-6).map((event) => (
            <li key={event.audit_event_id}>
              <Chip
                tone={event.actor_type === "human" ? "blue" : "neutral"}
                title={event.actor_id}
              >
                {event.actor_type === "agent"
                  ? humanizeToken(event.actor_id)
                  : humanizeToken(event.actor_type)}
              </Chip>
              <span className="cf-audit-mini__action">
                {humanizeToken(event.action)}
              </span>
            </li>
          ))}
          {auditEvents.length === 0 ? (
            <li className="cf-fields__muted">No events yet.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
