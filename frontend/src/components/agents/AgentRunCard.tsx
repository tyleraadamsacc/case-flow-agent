import { useId, useState } from "react";

import { agentTheme } from "../../theme/agentTheme";
import type { AgentRunStatus } from "../../theme/status";
import AuditLink from "../ui/AuditLink";
import Button from "../ui/Button";
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
  output?: Record<string, unknown>;
  confidence?: number | null;
  rationale?: string | null;
  evidenceIds?: string[];
  auditEventId?: string | null;
  /** Audit action name, shown on the audit link when available. */
  auditAction?: string | null;
  requiresHumanReview?: boolean;
  reviewReasons?: string[];
  riskFlags?: string[];
  blockedReason?: string | null;
  humanDecision?: "accepted" | "sent_back" | null;
  humanReviewer?: string | null;
  humanInstruction?: string | null;
  timestamp?: string | null;
  onOpenEvidence?: (evidenceIds: string[]) => void;
  onOpenAudit?: (auditEventId: string | null) => void;
  onAccept?: (agentId: string) => Promise<void> | void;
  onRerun?: (agentId: string, instruction: string) => Promise<void> | void;
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
  humanDecision,
  humanReviewer,
  humanInstruction,
  timestamp,
  onOpenEvidence,
  onOpenAudit,
  onAccept,
  onRerun,
}: AgentRunCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const detailsId = useId();
  const summaryId = useId();
  const theme = agentTheme(agentId);
  const accent = theme?.accent ?? "var(--text-muted)";
  const accentSoft = theme?.accentSoft ?? "var(--surface-soft)";
  const hasDetails = Boolean(
    inputSummary ||
      (reviewReasons && reviewReasons.length > 0) ||
      (riskFlags && riskFlags.length > 0) ||
      timestamp,
  );
  // Verbose outputs (the Indexing Agent's category list, for example)
  // clamp to four lines so one agent cannot stretch the whole rail row.
  const longSummary = (outputSummary?.length ?? 0) > 220;
  const hasConfidence = confidence !== null && confidence !== undefined;
  const hasMeta = Boolean(
    requiresHumanReview ||
      humanDecision ||
      (evidenceIds && evidenceIds.length > 0) ||
      auditEventId ||
      auditAction,
  );
  const hasFooter = hasConfidence || hasMeta || hasDetails;
  const canAct = status !== "waiting" && status !== "running";
  const hasHumanControls = canAct && (onAccept || onRerun);

  async function acceptOutput() {
    if (!onAccept) {
      return;
    }
    setActionBusy("accept");
    try {
      await onAccept(agentId);
    } finally {
      setActionBusy(null);
    }
  }

  async function requestRedraft() {
    if (!onRerun) {
      return;
    }
    setActionBusy("rerun");
    try {
      await onRerun(agentId, instruction.trim());
      setInstruction("");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <article
      className={`cf-agent-card cf-agent-card--${status}`}
      data-agent-id={agentId}
      aria-label={`${agentName}: ${status.replace("_", " ")}`}
    >
      <div className="cf-agent-card__header">
        <div className="cf-agent-card__topline">
          <span
            className="cf-agent-card__ordinal"
            style={{ background: accentSoft, color: accent }}
            aria-hidden="true"
          >
            {ordinal}
          </span>
          <StatusBadge status={status} />
        </div>
        <span className="cf-agent-card__name">{agentName}</span>
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
        <p
          id={summaryId}
          className={
            longSummary && !summaryOpen
              ? "cf-agent-card__summary cf-agent-card__summary--clamp"
              : "cf-agent-card__summary"
          }
        >
          {outputSummary}
        </p>
      ) : null}
      {longSummary ? (
        <button
          type="button"
          className="cf-agent-card__details-toggle"
          aria-expanded={summaryOpen}
          aria-controls={summaryId}
          aria-label={
            summaryOpen
              ? `Collapse output for ${agentName}`
              : `Show full output for ${agentName}`
          }
          onClick={() => setSummaryOpen((value) => !value)}
        >
          {summaryOpen ? "Collapse output" : "Show full output"}
        </button>
      ) : null}

      {hasFooter ? (
        <div className="cf-agent-card__footer">
          {hasConfidence ? <ConfidenceBar value={confidence} /> : null}

          {hasMeta ? (
            <div className="cf-agent-card__meta">
              {requiresHumanReview ? (
                <Chip tone="amber" dot>
                  Human review required
                </Chip>
              ) : null}
              {humanDecision === "accepted" ? (
                <Chip tone="green" dot title={humanReviewer ?? undefined}>
                  Accepted by human
                </Chip>
              ) : null}
              {humanDecision === "sent_back" ? (
                <Chip tone="amber" dot title={humanInstruction ?? undefined}>
                  Redraft requested
                </Chip>
              ) : null}
              <EvidenceLink evidenceIds={evidenceIds} onOpen={onOpenEvidence} />
              <AuditLink
                auditEventId={auditEventId}
                action={auditAction}
                onOpen={onOpenAudit}
              />
            </div>
          ) : null}

          {hasDetails ? (
            <>
              <button
                type="button"
                className="cf-agent-card__details-toggle"
                aria-expanded={detailsOpen}
                aria-controls={detailsId}
                aria-label={
                  detailsOpen
                    ? `Hide details for ${agentName}`
                    : `Details for ${agentName}`
                }
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
        </div>
      ) : null}

      {hasHumanControls ? (
        <div className="cf-agent-card__actions">
          {onRerun ? (
            <textarea
              className="cf-input cf-agent-card__instruction"
              rows={2}
              value={instruction}
              placeholder="Instruction for this agent"
              aria-label={`Instruction for ${agentName}`}
              onChange={(event) => setInstruction(event.target.value)}
            />
          ) : null}
          <div className="cf-agent-card__action-row">
            {onAccept ? (
              <Button
                size="sm"
                variant={humanDecision === "accepted" ? "tonal" : "outlined"}
                disabled={actionBusy !== null || humanDecision === "accepted"}
                onClick={acceptOutput}
              >
                {actionBusy === "accept" ? "Accepting..." : "Accept output"}
              </Button>
            ) : null}
            {onRerun ? (
              <Button
                size="sm"
                variant="outlined"
                disabled={actionBusy !== null}
                onClick={requestRedraft}
              >
                {actionBusy === "rerun" ? "Requesting..." : "Request redraft"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
