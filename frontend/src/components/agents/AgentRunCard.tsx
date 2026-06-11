import { useId, useState } from "react";

import { agentTheme } from "../../theme/agentTheme";
import type { AgentRunStatus } from "../../theme/status";
import AuditLink from "../ui/AuditLink";
import Chip from "../ui/Chip";
import ConfidenceBar from "../ui/ConfidenceBar";
import EvidenceLink from "../ui/EvidenceLink";
import StatusBadge from "../ui/StatusBadge";

export interface AgentRunCardProps {
  agentId: string;
  /** Official RFP agent name — exact spelling, never paraphrased. */
  agentName: string;
  ordinal: number;
  status: AgentRunStatus;
  roleDescription?: string;
  inputSummary?: string;
  outputSummary?: string;
  confidence?: number | null;
  evidenceIds?: string[];
  auditEventId?: string | null;
  /** Audit action name, shown on the audit link when available. */
  auditAction?: string | null;
  requiresHumanReview?: boolean;
  reviewReasons?: string[];
  riskFlags?: string[];
  blockedReason?: string | null;
  timestamp?: string | null;
  onOpenEvidence?: (evidenceIds: string[]) => void;
  onOpenAudit?: (auditEventId: string | null) => void;
}

/** One agent on the Six-Agent Workflow Rail. Blocked and failed runs are
 * rendered prominently, never hidden. All output language is draft /
 * prepared / pending-human; the card has no affordance that could read
 * as the agent approving, releasing, or sending anything. */
export default function AgentRunCard({
  agentId,
  agentName,
  ordinal,
  status,
  roleDescription,
  inputSummary,
  outputSummary,
  confidence,
  evidenceIds,
  auditEventId,
  auditAction,
  requiresHumanReview = false,
  reviewReasons,
  riskFlags,
  blockedReason,
  timestamp,
  onOpenEvidence,
  onOpenAudit,
}: AgentRunCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  const theme = agentTheme(agentId);
  const accent = theme?.accent ?? "var(--text-muted)";
  const accentSoft = theme?.accentSoft ?? "var(--surface-soft)";
  const hasDetails = Boolean(
    inputSummary ||
      (reviewReasons && reviewReasons.length > 0) ||
      (riskFlags && riskFlags.length > 0) ||
      timestamp,
  );

  return (
    <article
      className={`cf-agent-card cf-agent-card--${status}`}
      data-agent-id={agentId}
      aria-label={`${agentName}: ${status.replace("_", " ")}`}
    >
      <div className="cf-agent-card__header">
        <span
          className="cf-agent-card__ordinal"
          style={{ background: accentSoft, color: accent }}
          aria-hidden="true"
        >
          {ordinal}
        </span>
        <span className="cf-agent-card__name">{agentName}</span>
        <StatusBadge status={status} />
      </div>

      {roleDescription ? (
        <p className="cf-agent-card__role">{roleDescription}</p>
      ) : null}

      {status === "blocked" && blockedReason ? (
        <p className="cf-agent-card__blocked-reason">
          <strong>Blocked:</strong> {blockedReason}
        </p>
      ) : null}
      {status === "failed" && blockedReason ? (
        <p className="cf-agent-card__blocked-reason">
          <strong>Failed:</strong> {blockedReason}
        </p>
      ) : null}

      {outputSummary ? (
        <p className="cf-agent-card__summary">{outputSummary}</p>
      ) : null}

      {confidence !== null && confidence !== undefined ? (
        <ConfidenceBar value={confidence} />
      ) : null}

      <div className="cf-agent-card__meta">
        {requiresHumanReview ? (
          <Chip tone="amber" dot>
            Human review required
          </Chip>
        ) : null}
        <EvidenceLink evidenceIds={evidenceIds} onOpen={onOpenEvidence} />
        <AuditLink
          auditEventId={auditEventId}
          action={auditAction}
          onOpen={onOpenAudit}
        />
      </div>

      {hasDetails ? (
        <>
          <button
            type="button"
            className="cf-agent-card__details-toggle"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            onClick={() => setDetailsOpen((value) => !value)}
          >
            {detailsOpen ? "Hide details" : "Details"}
          </button>
          {detailsOpen ? (
            <dl className="cf-agent-card__details" id={detailsId}>
              {inputSummary ? (
                <div>
                  <dt>Input</dt>
                  <dd>{inputSummary}</dd>
                </div>
              ) : null}
              {reviewReasons && reviewReasons.length > 0 ? (
                <div>
                  <dt>Review reasons</dt>
                  <dd className="cf-preview__row">
                    {reviewReasons.map((reason) => (
                      <Chip key={reason} tone="amber">
                        {reason}
                      </Chip>
                    ))}
                  </dd>
                </div>
              ) : null}
              {riskFlags && riskFlags.length > 0 ? (
                <div>
                  <dt>Risk flags</dt>
                  <dd className="cf-preview__row">
                    {riskFlags.map((flag) => (
                      <Chip key={flag} tone="red">
                        {flag}
                      </Chip>
                    ))}
                  </dd>
                </div>
              ) : null}
              {timestamp ? (
                <div>
                  <dt>Completed</dt>
                  <dd className="cf-agent-card__timestamp">{timestamp}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
