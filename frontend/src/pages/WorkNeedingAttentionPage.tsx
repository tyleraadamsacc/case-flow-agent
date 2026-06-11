import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { governanceApi } from "../api/client";
import type { AttentionItem } from "../api/types";
import ConsoleShell from "../components/layout/ConsoleShell";
import Card from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import StatusBadge from "../components/ui/StatusBadge";
import {
  humanizeToken,
  nextAction,
  workflowStateLabel,
} from "../lib/requestDisplay";

function reasonTone(reason: string): "red" | "amber" | "violet" {
  if (
    reason.includes("blocking") ||
    reason.includes("audit") ||
    reason.includes("missing")
  ) {
    return "red";
  }
  if (
    reason.includes("pen_register") ||
    reason.includes("trap_and_trace") ||
    reason.includes("sealed") ||
    reason.includes("non_disclosure") ||
    reason.includes("sensitive") ||
    reason.includes("special")
  ) {
    return "violet";
  }
  return "amber";
}

function responsibleAgentLabel(item: AttentionItem): string {
  const text = item.reasons.join(" ");
  if (text.includes("sme") || text.includes("escalation")) {
    return "Triaging Agent";
  }
  if (text.includes("audit") || text.includes("approval")) {
    return "Automation Agent";
  }
  if (text.includes("deficiency") || text.includes("missing")) {
    return "Text Content Agent";
  }
  if (text.includes("etl") || text.includes("package")) {
    return "ETL Agent";
  }
  return "CaseFlow analyst";
}

function recommendedAction(item: AttentionItem): string {
  if (item.reasons.some((reason) => reason.includes("blocking"))) {
    return "Clear or override the blocking deficiency";
  }
  if (item.reasons.some((reason) => reason.includes("sme"))) {
    return "Review the prepared SME escalation";
  }
  if (item.reasons.some((reason) => reason.includes("audit"))) {
    return "Inspect the audit trail before approval";
  }
  return nextAction(item.workflow_state);
}

/** Work Needing Attention — a curated, prioritized exception feed
 * (plan §13), not a raw queue. Each card names why a human is needed
 * and links into the request detail where the responsible agent run is
 * visible. */
export default function WorkNeedingAttentionPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    governanceApi
      .workNeedingAttention()
      .then((response) => setItems(response.items))
      .catch((cause: Error) => setError(cause.message));
  }, []);

  return (
    <ConsoleShell title="Work Needing Attention">
      <div className="cf-page-header">
        <h1>Work Needing Attention</h1>
        <p>
          Requests where a human decision is needed next: special handling,
          blocking deficiencies, blocked agent runs, low confidence, and
          approvals pending. Highest priority first.
        </p>
      </div>

      {error ? (
        <Card variant="soft">
          <p style={{ margin: 0, color: "var(--red)" }}>
            Could not load attention items: {error}
          </p>
        </Card>
      ) : null}

      {items === null && !error ? (
        <div
          className="cf-skeleton"
          role="status"
          aria-label="Loading attention items"
        >
          <div className="cf-skeleton__row" />
          <div className="cf-skeleton__row" />
        </div>
      ) : null}

      {items && items.length === 0 ? (
        <Card variant="soft">
          <div className="cf-empty">
            <h3>Nothing needs attention right now</h3>
            <p>
              When an agent run is blocked, a deficiency blocks production, or
              a draft waits on approval, the request appears here first.
            </p>
          </div>
        </Card>
      ) : null}

      <div className="cf-attention">
        {items?.map((item) => {
          const agentLabel = responsibleAgentLabel(item);
          return (
            <Card
              key={item.legal_request_id}
              interactive
              className="cf-attention__card"
              onClick={() => navigate(`/requests/${item.legal_request_id}`)}
              role="link"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/requests/${item.legal_request_id}`);
                }
              }}
            >
              <div className="cf-attention__header">
                <span className="cf-queue__id">{item.legal_request_id}</span>
                <StatusBadge status={item.workflow_state} />
                <Chip tone="neutral" title="Priority score">
                  P{item.priority}
                </Chip>
                <Chip tone="neutral" dot>
                  Synthetic / mock
                </Chip>
              </div>

              <div className="cf-attention__reason">
                <span className="cf-attention__eyebrow">Needs attention because</span>
                <div className="cf-preview__row">
                  {item.reasons.map((reason) => (
                    <Chip key={reason} tone={reasonTone(reason)} dot>
                      {humanizeToken(reason)}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="cf-attention__grid">
                <span>
                  <span className="cf-attention__label">Workflow state</span>
                  {workflowStateLabel(item.workflow_state)}
                </span>
                <span>
                  <span className="cf-attention__label">Responsible owner</span>
                  {agentLabel}
                </span>
                <span className="cf-attention__wide">
                  <span className="cf-attention__label">Recommended next action</span>
                  {recommendedAction(item)}
                </span>
              </div>

              <div className="cf-attention__footer">
                <span>
                  Evidence: open request
                </span>
                <span>
                  Audit: inspect trail
                </span>
                {item.related_agent_run_ids.length > 0 ? (
                  <span>
                    {item.related_agent_run_ids.length} related agent run
                    {item.related_agent_run_ids.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span>Human-led guardrail</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </ConsoleShell>
  );
}
