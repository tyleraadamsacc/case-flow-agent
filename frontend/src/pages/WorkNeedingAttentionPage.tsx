import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { governanceApi } from "../api/client";
import type { AttentionItem } from "../api/types";
import ConsoleShell from "../components/layout/ConsoleShell";
import Card from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import StatusBadge from "../components/ui/StatusBadge";
import { humanizeToken } from "../lib/requestDisplay";

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
          Requests where a human decision is needed next — special handling,
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

      {items && items.length === 0 ? (
        <Card variant="soft">
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            Nothing needs attention right now.
          </p>
        </Card>
      ) : null}

      <div className="cf-attention">
        {items?.map((item) => (
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
            </div>
            <div className="cf-preview__row" style={{ marginTop: "var(--space-2)" }}>
              {item.reasons.map((reason) => (
                <Chip key={reason} tone={reasonTone(reason)} dot>
                  {humanizeToken(reason)}
                </Chip>
              ))}
            </div>
            {item.related_agent_run_ids.length > 0 ? (
              <p className="cf-attention__runs">
                {item.related_agent_run_ids.length} related agent run
                {item.related_agent_run_ids.length === 1 ? "" : "s"} — open the
                request to inspect the rail.
              </p>
            ) : null}
          </Card>
        ))}
      </div>
    </ConsoleShell>
  );
}
