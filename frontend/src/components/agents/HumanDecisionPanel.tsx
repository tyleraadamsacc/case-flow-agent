import { useState } from "react";

import type { AgentRunDecision } from "../../api/types";
import Button from "../ui/Button";
import Chip from "../ui/Chip";
import RerunCommandBar, { type RerunCommand } from "./RerunCommandBar";
import { deriveAgentStatus } from "./agentWorkflowUtils";
import type { AgentRun } from "../../api/types";

export interface HumanDecisionPanelProps {
  agent: Pick<
    AgentRun,
    | "agent_id"
    | "status"
    | "requires_human_review"
    | "review_reasons"
    | "risk_flags"
    | "blocked_reason"
  >;
  agentName: string;
  latestDecision?: AgentRunDecision | null;
  stale?: boolean;
  dependencyReasons?: string[];
  disabled?: boolean;
  onAccept: (agentId: string, comments?: string) => Promise<void> | void;
  onRerun: (command: RerunCommand) => Promise<void> | void;
}

export default function HumanDecisionPanel({
  agent,
  agentName,
  latestDecision = null,
  stale = false,
  dependencyReasons,
  disabled = false,
  onAccept,
  onRerun,
}: HumanDecisionPanelProps) {
  const [comments, setComments] = useState("");
  const [acceptBusy, setAcceptBusy] = useState(false);
  const status = deriveAgentStatus(agent, {
    stale,
    dependencyReasons,
    latestReview: latestDecision ? { decision: latestDecision } : null,
  });
  const accepted = latestDecision === "accepted";
  const canAccept = !disabled && !accepted && agent.status !== "running";

  async function accept() {
    if (!canAccept) {
      return;
    }
    setAcceptBusy(true);
    try {
      await onAccept(agent.agent_id, comments.trim() || undefined);
      setComments("");
    } finally {
      setAcceptBusy(false);
    }
  }

  return (
    <section className="cf-agent-card__actions" aria-label={`${agentName} human decision`}>
      <div className="cf-agent-card__meta">
        <Chip tone={status.requiresHumanDecision ? "amber" : "blue"} dot>
          {status.label}
        </Chip>
        {status.isStale ? (
          <Chip tone="amber" dot>
            Downstream stale
          </Chip>
        ) : null}
        {status.hasDependencyIssue ? (
          <Chip tone="red" dot>
            Dependency issue
          </Chip>
        ) : null}
      </div>

      {status.reasons.length > 0 ? (
        <ul className="cf-deficiency-list">
          {status.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      <label className="cf-field">
        <span className="cf-field__label">Decision comments</span>
        <textarea
          className="cf-input cf-agent-card__instruction"
          rows={2}
          value={comments}
          disabled={disabled || acceptBusy || accepted}
          placeholder="Optional human decision note"
          onChange={(event) => setComments(event.target.value)}
        />
      </label>

      <div className="cf-agent-card__action-row">
        <Button
          size="sm"
          variant={accepted ? "tonal" : "outlined"}
          disabled={!canAccept || acceptBusy}
          onClick={accept}
        >
          {acceptBusy ? "Accepting..." : accepted ? "Accepted by human" : "Accept output"}
        </Button>
      </div>

      <RerunCommandBar
        agentId={agent.agent_id}
        agentName={agentName}
        disabled={disabled || acceptBusy}
        onSubmit={onRerun}
      />
    </section>
  );
}
