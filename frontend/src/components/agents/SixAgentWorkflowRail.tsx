import { useEffect, useMemo, useState } from "react";

import type {
  AuditEvent,
  FinalizationStatus,
  LegalRequest,
  Role,
} from "../../api/types";
import { AGENT_RAIL_ORDER, AGENT_THEME, type AgentId } from "../../theme/agentTheme";
import { statusMeta } from "../../theme/status";
import { useOptionalActor } from "../identity/ActorContext";
import Button from "../ui/Button";
import Chip, { type ChipTone } from "../ui/Chip";
import type { AgentRunCardProps } from "./AgentRunCard";
import "./WorkflowConsole.css";

/** An agent run as the rail consumes it - typically a backend AgentRun
 * record. Name, ordinal, and role come from the agent registry, not the
 * caller. */
export type AgentRunLike = Omit<
  AgentRunCardProps,
  "agentName" | "ordinal" | "roleDescription"
>;

export type ReviewerMode = "analyst" | "senior" | "qa" | "demo";

export interface SixAgentWorkflowRailProps {
  runs?: AgentRunLike[];
  request?: LegalRequest;
  auditEvents?: AuditEvent[];
  finalizationStatus?: FinalizationStatus | null;
  onOpenEvidence?: (evidenceIds: string[]) => void;
  onOpenAudit?: (auditEventId: string | null) => void;
  onOpenSourceTrace?: (
    sourceSpan: string | null | undefined,
    fallbackTerms?: string[],
  ) => void;
  onAcceptAgent?: (agentId: string) => Promise<void> | void;
  onRerunAgent?: (agentId: string, instruction: string) => Promise<void> | void;
}

type ConsoleStatus =
  | "waiting"
  | "running"
  | "complete"
  | "needs_review"
  | "accepted"
  | "redraft_requested"
  | "changed_after_approval"
  | "blocked"
  | "superseded";

type CommandTarget =
  | "current"
  | "downstream"
  | "package"
  | "classification"
  | "deficiency";

interface ConsoleAgent {
  agentId: AgentId;
  theme: (typeof AGENT_THEME)[AgentId];
  run?: AgentRunLike;
  consoleStatus: ConsoleStatus;
  stale: boolean;
  dependency: string;
}

interface EvidenceChip {
  id: string;
  label: string;
  group: string;
  quality: "direct" | "inferred" | "missing" | "conflicting";
  evidenceIds?: string[];
  sourceSpan?: string | null;
  fallbackTerms?: string[];
}

const CONSOLE_STATUS_META: Record<
  ConsoleStatus,
  { label: string; tone: ChipTone; description: string }
> = {
  waiting: {
    label: "Waiting",
    tone: "neutral",
    description: "Agent has not run in this request.",
  },
  running: {
    label: "Running",
    tone: "blue",
    description: "Agent work is currently in progress.",
  },
  complete: {
    label: "Complete",
    tone: "green",
    description: "Machine output is complete and no extra gate is shown.",
  },
  needs_review: {
    label: "Needs review",
    tone: "amber",
    description: "Machine output is complete but human review is required.",
  },
  accepted: {
    label: "Accepted",
    tone: "green",
    description: "A human reviewer accepted this output.",
  },
  redraft_requested: {
    label: "Redraft requested",
    tone: "amber",
    description: "A human asked the agent to revise this output.",
  },
  changed_after_approval: {
    label: "May be stale",
    tone: "amber",
    description: "An upstream redraft may affect this downstream output.",
  },
  blocked: {
    label: "Blocked",
    tone: "red",
    description: "The agent cannot proceed without human attention.",
  },
  superseded: {
    label: "Superseded",
    tone: "neutral",
    description: "A newer revision replaced this run.",
  },
};

const DEPENDENCY_COPY: Record<AgentId, string> = {
  indexing_agent: "Request text feeds triage.",
  triaging_agent: "Indexing feeds classification and route.",
  etl_agent: "Triage route feeds mock record retrieval.",
  note_taking_and_data_entry_agent: "Extracted fields feed note drafting.",
  text_content_agent: "ETL records feed package drafting.",
  automation_agent: "Package draft feeds prepared next action.",
};

const COMMAND_TARGET_LABELS: Record<CommandTarget, string> = {
  current: "Current agent",
  downstream: "All downstream agents",
  package: "Package draft only",
  classification: "Classification only",
  deficiency: "Deficiency analysis only",
};

/** Operator-grade console for the six-agent legal-response workflow.
 * The component still renders all six official agents in fixed order, but
 * uses progressive disclosure: one selected agent owns the detailed
 * center panel while the right inspector carries evidence, audit, and
 * review state. */
export default function SixAgentWorkflowRail({
  runs = [],
  request,
  auditEvents = [],
  finalizationStatus,
  onOpenEvidence,
  onOpenAudit,
  onOpenSourceTrace,
  onAcceptAgent,
  onRerunAgent,
}: SixAgentWorkflowRailProps) {
  const actor = useOptionalActor()?.actor;
  const defaultMode = reviewerModeForRole(actor?.role);
  const [manualMode, setManualMode] = useState<ReviewerMode | null>(null);
  const reviewerMode = manualMode ?? defaultMode;
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>(() =>
    firstActionableAgent(runs),
  );
  const [commandText, setCommandText] = useState("");
  const [commandTarget, setCommandTarget] = useState<CommandTarget>("current");
  const [busyCommand, setBusyCommand] = useState(false);
  const [busyAccept, setBusyAccept] = useState(false);

  const agents = useMemo(() => buildConsoleAgents(runs), [runs]);
  const selected = agents.find((agent) => agent.agentId === selectedAgentId) ?? agents[0];
  const selectedEvents = useMemo(
    () => eventsForAgent(selected.agentId, auditEvents, selected.run),
    [auditEvents, selected.agentId, selected.run],
  );
  const evidenceChips = useMemo(
    () => buildEvidenceChips(selected, request, selectedEvents),
    [request, selected, selectedEvents],
  );
  const readiness = useMemo(
    () => buildReadiness(agents, request, finalizationStatus),
    [agents, request, finalizationStatus],
  );
  const story = useMemo(
    () => buildWorkflowStory(agents, request, finalizationStatus),
    [agents, request, finalizationStatus],
  );

  useEffect(() => {
    if (!agents.some((agent) => agent.agentId === selectedAgentId)) {
      setSelectedAgentId(agents[0].agentId);
    }
  }, [agents, selectedAgentId]);

  async function acceptSelected() {
    if (!onAcceptAgent || !selected.run || selected.run.humanDecision === "accepted") {
      return;
    }
    setBusyAccept(true);
    try {
      await onAcceptAgent(selected.agentId);
    } finally {
      setBusyAccept(false);
    }
  }

  async function runCommand() {
    if (!onRerunAgent) {
      return;
    }
    const agentIds = targetAgentIds(commandTarget, selected.agentId, agents).filter(
      (agentId) => agents.find((agent) => agent.agentId === agentId)?.run,
    );
    if (agentIds.length === 0) {
      return;
    }
    setBusyCommand(true);
    try {
      for (const agentId of agentIds) {
        await onRerunAgent(agentId, commandText.trim());
      }
      setCommandText("");
    } finally {
      setBusyCommand(false);
    }
  }

  return (
    <section className="cf-workflow-console" aria-label="Six-agent workflow console">
      <header className="cf-workflow-story">
        <div className="cf-workflow-story__copy">
          <p className="cf-workflow-story__eyebrow">Six-agent workflow console</p>
          <h3>{story.title}</h3>
          <p>{story.subtitle}</p>
        </div>
        <div className="cf-workflow-story__metrics" aria-label="Workflow summary">
          <Metric label="Confidence" value={story.confidence} />
          <Metric label="Blocking items" value={story.blockers} />
          <Metric label="Human actions" value={story.humanActions} />
          <Metric label="Last run" value={story.lastRun} />
        </div>
        <div className="cf-workflow-story__guardrails" aria-label="Workflow guardrails">
          <Chip tone="blue">Draft</Chip>
          <Chip tone="blue">Prepared</Chip>
          <Chip tone="amber" dot>
            Pending review
          </Chip>
          <Chip tone="amber" dot>
            Human review required
          </Chip>
          <Chip tone="green">Audit event logged</Chip>
          <Chip tone="violet">Synthetic / mock data</Chip>
          <Chip tone={story.changedSinceApproval ? "amber" : "neutral"} dot>
            {story.changedSinceApproval
              ? "Changed since approval"
              : "No post-approval change"}
          </Chip>
        </div>
      </header>

      <div className="cf-readiness-strip" aria-label="Operational readiness">
        {readiness.map((item) => (
          <div
            key={item.id}
            className={`cf-readiness-strip__item cf-readiness-strip__item--${item.tone}`}
          >
            <span className="cf-readiness-strip__value">{item.value}</span>
            <span className="cf-readiness-strip__label">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="cf-workflow-modebar" aria-label="Reviewer mode">
        <span>Reviewer mode</span>
        {(["analyst", "senior", "qa", "demo"] as const).map((mode) => (
          <button
            type="button"
            key={mode}
            className={
              mode === reviewerMode
                ? "cf-workflow-modebar__button cf-workflow-modebar__button--active"
                : "cf-workflow-modebar__button"
            }
            aria-pressed={mode === reviewerMode}
            onClick={() => setManualMode(mode)}
          >
            {modeLabel(mode)}
          </button>
        ))}
      </div>

      <div className={`cf-workflow-grid cf-workflow-grid--${reviewerMode}`}>
        <div className="cf-agent-timeline-shell">
          <div className="cf-agent-timeline-shell__header">
            <span>Official sequence</span>
            <strong>All six agents</strong>
          </div>
          <ol className="cf-agent-timeline" aria-label="Six-Agent Workflow Rail">
            {agents.map((agent) => (
              <AgentTimelineNode
                key={agent.agentId}
                agent={agent}
                selected={agent.agentId === selected.agentId}
                onSelect={() => setSelectedAgentId(agent.agentId)}
              />
            ))}
          </ol>
        </div>

        <article
          className="cf-agent-detail"
          aria-label={`${selected.theme.officialName} selected output`}
        >
          <AgentDetailPanel
            agent={selected}
            request={request}
            reviewerMode={reviewerMode}
            busyAccept={busyAccept}
            canAccept={Boolean(onAcceptAgent && selected.run)}
            onAccept={acceptSelected}
          />
        </article>

        <aside
          className="cf-agent-inspector"
          aria-label={`${selected.theme.officialName} evidence and audit inspector`}
        >
          <EvidenceInspector
            agent={selected}
            mode={reviewerMode}
            events={selectedEvents}
            chips={evidenceChips}
            finalizationStatus={finalizationStatus}
            request={request}
            onOpenAudit={onOpenAudit}
            onOpenEvidence={onOpenEvidence}
            onOpenSourceTrace={onOpenSourceTrace}
          />
        </aside>
      </div>

      <CommandBar
        selectedAgentName={selected.theme.officialName}
        value={commandText}
        target={commandTarget}
        disabled={!onRerunAgent || busyCommand}
        onChange={setCommandText}
        onTargetChange={setCommandTarget}
        onSubmit={runCommand}
      />
    </section>
  );
}

function AgentTimelineNode({
  agent,
  selected,
  onSelect,
}: {
  agent: ConsoleAgent;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = CONSOLE_STATUS_META[agent.consoleStatus];
  const confidence = formatConfidence(agent.run?.confidence);
  const output = agent.run?.outputSummary ?? "No persisted output yet.";
  return (
    <li className="cf-agent-timeline__item">
      <button
        type="button"
        className={[
          "cf-agent-node",
          `cf-agent-node--${agent.consoleStatus}`,
          selected ? "cf-agent-node--selected" : null,
          agent.stale ? "cf-agent-node--stale" : null,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-current={selected ? "step" : undefined}
        onClick={onSelect}
      >
        <span className="cf-agent-node__rail" aria-hidden="true">
          <span className="cf-agent-node__ordinal">{agent.theme.ordinal}</span>
        </span>
        <span className="cf-agent-node__body">
          <span className="cf-agent-node__topline">
            <span className="cf-agent-node__name">{agent.theme.officialName}</span>
            <Chip tone={meta.tone} dot>
              {meta.label}
            </Chip>
          </span>
          <span className="cf-agent-node__summary">{output}</span>
          <span className="cf-agent-node__meta">
            <span>{confidence}</span>
            <span>{agent.run?.evidenceIds?.length ?? 0} evidence</span>
            <span>{agent.run?.auditAction ? "audit logged" : "audit pending"}</span>
            {agent.run?.requiresHumanReview ? <span>human gate</span> : null}
          </span>
        </span>
      </button>
    </li>
  );
}

function AgentDetailPanel({
  agent,
  request,
  reviewerMode,
  busyAccept,
  canAccept,
  onAccept,
}: {
  agent: ConsoleAgent;
  request?: LegalRequest;
  reviewerMode: ReviewerMode;
  busyAccept: boolean;
  canAccept: boolean;
  onAccept: () => void;
}) {
  const run = agent.run;
  const meta = CONSOLE_STATUS_META[agent.consoleStatus];
  const accepted = run?.humanDecision === "accepted";
  const sentBack = run?.humanDecision === "sent_back";
  const riskItems = [
    ...(run?.riskFlags ?? []),
    ...(run?.reviewReasons ?? []),
    ...(request?.deficiency_findings.map((finding) => finding.message) ?? []),
  ];

  return (
    <>
      <header className="cf-agent-detail__header">
        <div>
          <p className="cf-agent-detail__eyebrow">Gemini analysis panel</p>
          <h3>{agent.theme.officialName}</h3>
          <p>{agent.theme.roleDescription}</p>
        </div>
        <Chip tone={meta.tone} dot title={meta.description}>
          {meta.label}
        </Chip>
      </header>

      <section className="cf-agent-detail__section">
        <p className="cf-agent-detail__label">Machine output</p>
        <p className="cf-agent-detail__result">
          {run?.outputSummary ?? "No run has been persisted for this agent yet."}
        </p>
        {run?.blockedReason ? (
          <p className="cf-agent-detail__blocked">
            Blocked: {run.blockedReason}
          </p>
        ) : null}
        {run?.inputSummary ? (
          <p className="cf-agent-detail__input">Input: {run.inputSummary}</p>
        ) : null}
        {run?.rationale ? (
          <div className="cf-agent-detail__rationale">
            <p className="cf-agent-detail__label">Reasoning</p>
            <p>{run.rationale}</p>
          </div>
        ) : null}
      </section>

      <section className="cf-trust-grid" aria-label="Trust metadata">
        <TrustMetric label="Confidence" value={formatConfidence(run?.confidence)} />
        <TrustMetric
          label="Evidence"
          value={`${run?.evidenceIds?.length ?? 0} direct`}
        />
        <TrustMetric
          label="Audit"
          value={run?.auditAction ? "Audit event logged" : "Pending"}
        />
        <TrustMetric label="Risk" value={riskLabel(agent, riskItems)} />
        <TrustMetric label="Policy basis" value={policyBasis(run)} />
        <TrustMetric
          label="Human gate"
          value={run?.requiresHumanReview ? "Required" : "Not flagged"}
        />
      </section>

      <section className="cf-human-decision" aria-label="Human decision layer">
        <div>
          <p className="cf-agent-detail__label">Human decision</p>
          <p>
            {accepted
              ? `Accepted by ${run?.humanReviewer ?? "human reviewer"}.`
              : sentBack
                ? `Redraft requested${run?.humanReviewer ? ` by ${run.humanReviewer}` : ""}.`
                : run
                  ? "Pending acceptance by analyst."
                  : "No decision available until this agent runs."}
          </p>
          {run?.humanInstruction ? (
            <p className="cf-human-decision__instruction">
              Instruction: {run.humanInstruction}
            </p>
          ) : null}
        </div>
        <div className="cf-human-decision__actions">
          <Button
            size="sm"
            variant={accepted ? "tonal" : "filled"}
            disabled={!canAccept || busyAccept || accepted}
            onClick={onAccept}
          >
            {busyAccept ? "Accepting..." : accepted ? "Accepted" : "Accept output"}
          </Button>
        </div>
      </section>

      <RerunDiffPanel agent={agent} request={request} />

      {reviewerMode !== "demo" ? (
        <section className="cf-agent-detail__section">
          <p className="cf-agent-detail__label">Override options</p>
          <div className="cf-agent-detail__chips">
            {agent.agentId === "triaging_agent" ? (
              <Chip tone="blue">Route override in review panel</Chip>
            ) : null}
            {agent.agentId === "indexing_agent" ? (
              <>
                <Chip tone="blue">Legal process override</Chip>
                <Chip tone="blue">Requested period override</Chip>
              </>
            ) : null}
            {agent.agentId === "text_content_agent" ? (
              <>
                <Chip tone="blue">Summary override</Chip>
                <Chip tone="blue">Certification representative override</Chip>
              </>
            ) : null}
            {agent.agentId === "automation_agent" ? (
              <Chip tone="neutral">Approval recording remains human-only</Chip>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function EvidenceInspector({
  agent,
  mode,
  events,
  chips,
  request,
  finalizationStatus,
  onOpenAudit,
  onOpenEvidence,
  onOpenSourceTrace,
}: {
  agent: ConsoleAgent;
  mode: ReviewerMode;
  events: AuditEvent[];
  chips: EvidenceChip[];
  request?: LegalRequest;
  finalizationStatus?: FinalizationStatus | null;
  onOpenAudit?: (auditEventId: string | null) => void;
  onOpenEvidence?: (evidenceIds: string[]) => void;
  onOpenSourceTrace?: (
    sourceSpan: string | null | undefined,
    fallbackTerms?: string[],
  ) => void;
}) {
  const grouped = groupEvidence(chips);
  const auditFocus = mode === "qa" || mode === "senior";
  return (
    <>
      <header className="cf-agent-inspector__header">
        <div>
          <p className="cf-agent-detail__eyebrow">{modeLabel(mode)} inspector</p>
          <h3>Evidence and audit</h3>
        </div>
        <Chip tone={agent.stale ? "amber" : "neutral"} dot={agent.stale}>
          {agent.stale ? "Refresh advised" : "Current view"}
        </Chip>
      </header>

      <section className="cf-agent-inspector__section">
        <p className="cf-agent-detail__label">Evidence quality</p>
        <div className="cf-evidence-groups">
          {Object.entries(grouped).map(([group, groupChips]) => (
            <div key={group} className="cf-evidence-group">
              <h4>{group}</h4>
              <div className="cf-evidence-group__chips">
                {groupChips.map((chip) => (
                  <button
                    type="button"
                    key={chip.id}
                    className={`cf-evidence-chip cf-evidence-chip--${chip.quality}`}
                    title={qualityTitle(chip)}
                    onClick={() => {
                      if (chip.evidenceIds?.length) {
                        onOpenEvidence?.(chip.evidenceIds);
                      } else if (chip.sourceSpan || chip.fallbackTerms?.length) {
                        onOpenSourceTrace?.(chip.sourceSpan, chip.fallbackTerms);
                      }
                    }}
                  >
                    <span>{chip.label}</span>
                    <small>{chip.quality}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {mode !== "demo" ? (
        <section className="cf-agent-inspector__section">
          <p className="cf-agent-detail__label">Dependency flow</p>
          <ol className="cf-dependency-flow">
            {AGENT_RAIL_ORDER.map((agentId) => (
              <li
                key={agentId}
                className={
                  agentId === agent.agentId
                    ? "cf-dependency-flow__item cf-dependency-flow__item--active"
                    : "cf-dependency-flow__item"
                }
              >
                <span>{AGENT_THEME[agentId].ordinal}</span>
                <p>{DEPENDENCY_COPY[agentId]}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {auditFocus ? (
        <section className="cf-agent-inspector__section">
          <p className="cf-agent-detail__label">Audit events</p>
          <div className="cf-audit-stack">
            {events.length ? (
              events.map((event) => (
                <button
                  type="button"
                  key={event.audit_event_id}
                  className="cf-audit-event"
                  onClick={() => onOpenAudit?.(event.audit_event_id)}
                >
                  <span>{event.action}</span>
                  <small>{event.summary}</small>
                </button>
              ))
            ) : (
              <p className="cf-agent-detail__muted">
                No audit event is linked to this agent in the current timeline.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {mode === "senior" ? (
        <section className="cf-agent-inspector__section">
          <p className="cf-agent-detail__label">Approval gates</p>
          <ul className="cf-gate-list">
            <li>
              {finalizationStatus?.approvals_recorded ?? request?.approvals.length ?? 0} /{" "}
              {finalizationStatus?.approvals_required ?? 1} approvals recorded
            </li>
            <li>
              {finalizationStatus?.requires_senior_approval
                ? finalizationStatus.senior_approval_present
                  ? "Senior co-sign present"
                  : "Senior co-sign required"
                : "Senior co-sign not required"}
            </li>
            <li>
              {(finalizationStatus?.missing_attestations.length ?? 0) > 0
                ? `${finalizationStatus?.missing_attestations.length} attestations missing`
                : "No attestation gap reported"}
            </li>
          </ul>
        </section>
      ) : null}
    </>
  );
}

function CommandBar({
  selectedAgentName,
  value,
  target,
  disabled,
  onChange,
  onTargetChange,
  onSubmit,
}: {
  selectedAgentName: string;
  value: string;
  target: CommandTarget;
  disabled: boolean;
  onChange: (value: string) => void;
  onTargetChange: (value: CommandTarget) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="cf-command-bar"
      aria-label="Agent review command bar"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="cf-command-bar__input">
        <span>Ask an agent to revise</span>
        <input
          className="cf-input"
          value={value}
          placeholder={`Instruction for ${selectedAgentName}`}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <label className="cf-command-bar__target">
        <span>Target</span>
        <select
          className="cf-input"
          value={target}
          onChange={(event) => onTargetChange(event.target.value as CommandTarget)}
        >
          {Object.entries(COMMAND_TARGET_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="filled" disabled={disabled}>
        {disabled ? "Unavailable" : "Request redraft"}
      </Button>
    </form>
  );
}

function RerunDiffPanel({
  agent,
  request,
}: {
  agent: ConsoleAgent;
  request?: LegalRequest;
}) {
  const run = agent.run;
  const redraft = run?.humanDecision === "sent_back";
  const retryCount =
    typeof run?.output === "object" && run.output !== null && "retry_count" in run.output
      ? Number(run.output.retry_count)
      : null;
  const resolvedDeficiencies =
    request?.human_overrides.flatMap((override) => override.cleared_deficiencies) ?? [];
  return (
    <section className="cf-rerun-diff" aria-label="Rerun diff">
      <div>
        <p className="cf-agent-detail__label">Rerun diff</p>
        <p>
          {redraft
            ? "A redraft has been requested; downstream outputs are treated as review-sensitive until refreshed."
            : "No retained previous agent output is available for side-by-side comparison."}
        </p>
      </div>
      <dl>
        <div>
          <dt>Confidence delta</dt>
          <dd>{retryCount ? "Compare with previous revision" : "No prior score"}</dd>
        </div>
        <div>
          <dt>Evidence changes</dt>
          <dd>{run?.evidenceIds?.length ?? 0} current evidence ids</dd>
        </div>
        <div>
          <dt>Deficiencies</dt>
          <dd>
            {resolvedDeficiencies.length
              ? `${resolvedDeficiencies.length} resolved by human override`
              : "No resolved/introduced delta recorded"}
          </dd>
        </div>
        <div>
          <dt>Approval impact</dt>
          <dd>{agent.stale || redraft ? "Prior acceptance may need review" : "No invalidation flagged"}</dd>
        </div>
      </dl>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="cf-workflow-story__metric">
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}

function TrustMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="cf-trust-card">
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}

function buildConsoleAgents(runs: AgentRunLike[]): ConsoleAgent[] {
  const sentBackOrdinal = Math.min(
    ...runs
      .filter((run) => run.humanDecision === "sent_back")
      .map((run) => AGENT_THEME[run.agentId as AgentId]?.ordinal ?? Number.POSITIVE_INFINITY),
  );
  return AGENT_RAIL_ORDER.map((agentId) => {
    const run = runs.find((candidate) => candidate.agentId === agentId);
    const theme = AGENT_THEME[agentId];
    const stale =
      Number.isFinite(sentBackOrdinal) &&
      theme.ordinal > sentBackOrdinal &&
      Boolean(run);
    return {
      agentId,
      theme,
      run,
      consoleStatus: deriveConsoleStatus(run, stale),
      stale,
      dependency: DEPENDENCY_COPY[agentId],
    };
  });
}

function deriveConsoleStatus(
  run: AgentRunLike | undefined,
  stale: boolean,
): ConsoleStatus {
  if (!run) {
    return "waiting";
  }
  if (run.status === "running") {
    return "running";
  }
  if (run.status === "blocked" || run.status === "failed") {
    return "blocked";
  }
  if (run.humanDecision === "sent_back") {
    return "redraft_requested";
  }
  if (stale) {
    return "changed_after_approval";
  }
  if (run.humanDecision === "accepted") {
    return "accepted";
  }
  if (run.requiresHumanReview || run.status === "needs_review") {
    return "needs_review";
  }
  return run.status === "complete" ? "complete" : "waiting";
}

function firstActionableAgent(runs: AgentRunLike[]): AgentId {
  const agents = buildConsoleAgents(runs);
  return (
    agents.find((agent) =>
      ["blocked", "redraft_requested", "changed_after_approval", "needs_review"].includes(
        agent.consoleStatus,
      ),
    )?.agentId ??
    agents.find((agent) => agent.run)?.agentId ??
    "indexing_agent"
  );
}

function buildWorkflowStory(
  agents: ConsoleAgent[],
  request?: LegalRequest,
  finalizationStatus?: FinalizationStatus | null,
) {
  const process = request?.legal_process?.type
    ? humanize(request.legal_process.type)
    : "Process pending";
  const domain = request?.product_domains[0] ?? request?.requested_data_categories[0]?.category;
  const recordCount =
    request?.production_package?.production_summary.total_responsive_records ??
    request?.production_package?.records.length ??
    null;
  const route =
    request?.routing_recommendation?.target_queue ??
    request?.classification?.recommended_queue ??
    "Human review required";
  const title = `${process} -> ${domain ? humanize(domain) : "Data review"} -> ${
    recordCount !== null ? `${recordCount} responsive records` : route
  } -> ${humanActionPhrase(agents, finalizationStatus)}`;
  const subtitle = request
    ? `${request.legal_request_id} is in ${statusMeta(request.workflow_state).label.toLowerCase()} with ${agents.filter((agent) => agent.run).length} of 6 agent outputs persisted.`
    : `${agents.filter((agent) => agent.run).length} of 6 agent outputs are persisted.`;
  return {
    title,
    subtitle,
    confidence: overallConfidence(agents),
    blockers: String(blockingItemCount(agents, request, finalizationStatus)),
    humanActions: String(humanActionCount(agents, request, finalizationStatus)),
    lastRun: latestRunTime(agents),
    changedSinceApproval: agents.some((agent) => agent.stale),
  };
}

function buildReadiness(
  agents: ConsoleAgent[],
  request?: LegalRequest,
  finalizationStatus?: FinalizationStatus | null,
) {
  const complete = agents.filter((agent) => agent.run?.status === "complete").length;
  const reviewNeeded = agents.filter(
    (agent) =>
      agent.run?.requiresHumanReview &&
      agent.run.humanDecision !== "accepted",
  ).length;
  const missingAttestations = finalizationStatus?.missing_attestations.length ?? 0;
  const blockers = blockingItemCount(agents, request, finalizationStatus);
  const seniorRequired = finalizationStatus?.requires_senior_approval ?? false;
  return [
    {
      id: "agents-complete",
      value: `${complete}/6`,
      label: "agents complete",
      tone: complete === 6 ? "green" : "neutral",
    },
    {
      id: "acceptance",
      value: String(reviewNeeded),
      label: "outputs need acceptance",
      tone: reviewNeeded ? "amber" : "green",
    },
    {
      id: "attestations",
      value: String(missingAttestations),
      label: "attestations missing",
      tone: missingAttestations ? "amber" : "green",
    },
    {
      id: "blockers",
      value: String(blockers),
      label: "blocking items",
      tone: blockers ? "red" : "green",
    },
    {
      id: "senior",
      value: seniorRequired ? "Yes" : "No",
      label: "senior approval",
      tone: seniorRequired ? "amber" : "neutral",
    },
  ] as const;
}

function eventsForAgent(
  agentId: AgentId,
  auditEvents: AuditEvent[],
  run?: AgentRunLike,
): AuditEvent[] {
  return auditEvents.filter(
    (event) =>
      event.actor_id === agentId ||
      event.audit_event_id === run?.auditEventId ||
      event.action === run?.auditAction,
  );
}

function buildEvidenceChips(
  agent: ConsoleAgent,
  request: LegalRequest | undefined,
  events: AuditEvent[],
): EvidenceChip[] {
  const chips: EvidenceChip[] = [];
  const ids = [...new Set([...(agent.run?.evidenceIds ?? []), ...events.flatMap((e) => e.evidence_ids)])];
  ids.forEach((id) => {
    chips.push({
      id: `evidence-${id}`,
      label: id,
      group: evidenceGroup(id),
      quality: qualityForEvidenceId(id),
      evidenceIds: [id],
    });
  });
  if (request) {
    buildSourceTraceChips(agent.agentId, request).forEach((chip) => chips.push(chip));
  }
  if (chips.length === 0) {
    chips.push({
      id: "missing-evidence",
      label: "No linked evidence",
      group: "Missing",
      quality: "missing",
    });
  }
  return chips;
}

function buildSourceTraceChips(agentId: AgentId, request: LegalRequest): EvidenceChip[] {
  const chips: EvidenceChip[] = [];
  if (agentId === "indexing_agent") {
    request.subject_identifiers.forEach((identifier) => {
      chips.push({
        id: `source-id-${identifier.value}`,
        label: `${humanize(identifier.type)} source`,
        group: "Request text",
        quality: identifier.source_span ? "direct" : "missing",
        sourceSpan: identifier.source_span,
        fallbackTerms: [identifier.value],
      });
    });
  }
  if (agentId === "triaging_agent" || agentId === "automation_agent") {
    request.legal_authorities.forEach((authority) => {
      chips.push({
        id: `authority-${authority.citation}`,
        label: authority.citation,
        group: "Request text",
        quality: authority.source_span ? "direct" : "inferred",
        sourceSpan: authority.source_span,
        fallbackTerms: [authority.citation, authority.description ?? ""],
      });
    });
  }
  if (agentId === "etl_agent" || agentId === "text_content_agent") {
    request.requested_data_categories.forEach((category) => {
      chips.push({
        id: `category-${category.category}`,
        label: humanize(category.category),
        group: "Request text",
        quality: "inferred",
        fallbackTerms: [category.category, category.product_domain],
      });
    });
    if (request.requested_period) {
      chips.push({
        id: "requested-period",
        label: "Requested period",
        group: "Request text",
        quality: request.requested_period.valid ? "direct" : "conflicting",
        fallbackTerms: [
          request.requested_period.start ?? "",
          request.requested_period.end ?? "",
        ],
      });
    }
  }
  return chips;
}

function groupEvidence(chips: EvidenceChip[]): Record<string, EvidenceChip[]> {
  return chips.reduce<Record<string, EvidenceChip[]>>((groups, chip) => {
    groups[chip.group] = [...(groups[chip.group] ?? []), chip];
    return groups;
  }, {});
}

function targetAgentIds(
  target: CommandTarget,
  selectedAgentId: AgentId,
  agents: ConsoleAgent[],
): AgentId[] {
  if (target === "classification") {
    return ["triaging_agent"];
  }
  if (target === "package" || target === "deficiency") {
    return ["text_content_agent"];
  }
  if (target === "downstream") {
    const selectedOrdinal = AGENT_THEME[selectedAgentId].ordinal;
    return agents
      .filter((agent) => agent.theme.ordinal >= selectedOrdinal)
      .map((agent) => agent.agentId);
  }
  return [selectedAgentId];
}

function reviewerModeForRole(role: Role | undefined): ReviewerMode {
  if (role === "senior_analyst" || role === "sme") {
    return "senior";
  }
  if (role === "qa") {
    return "qa";
  }
  return "analyst";
}

function modeLabel(mode: ReviewerMode): string {
  switch (mode) {
    case "senior":
      return "Senior reviewer";
    case "qa":
      return "QA";
    case "demo":
      return "Demo";
    default:
      return "Analyst";
  }
}

function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not scored";
  }
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

function overallConfidence(agents: ConsoleAgent[]): string {
  const values = agents
    .map((agent) => agent.run?.confidence)
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) {
    return "Not scored";
  }
  const average = values.reduce((sum, value) => sum + (value <= 1 ? value * 100 : value), 0) / values.length;
  return `${Math.round(average)}%`;
}

function latestRunTime(agents: ConsoleAgent[]): string {
  const timestamps = agents
    .map((agent) => agent.run?.timestamp)
    .filter((value): value is string => Boolean(value));
  return timestamps[timestamps.length - 1] ?? "No run yet";
}

function blockingItemCount(
  agents: ConsoleAgent[],
  request?: LegalRequest,
  finalizationStatus?: FinalizationStatus | null,
): number {
  const agentBlockers = agents.filter((agent) => agent.consoleStatus === "blocked").length;
  const deficiencyBlockers =
    request?.deficiency_findings.filter((finding) => finding.severity === "blocking")
      .length ?? 0;
  const packageBlockers =
    request?.package_validation_findings.filter((finding) => finding.severity === "blocking")
      .length ?? 0;
  return Math.max(
    agentBlockers + deficiencyBlockers + packageBlockers,
    finalizationStatus?.blocking_reasons.length ?? 0,
  );
}

function humanActionCount(
  agents: ConsoleAgent[],
  request?: LegalRequest,
  finalizationStatus?: FinalizationStatus | null,
): number {
  const agentActions = agents.filter(
    (agent) =>
      agent.run?.requiresHumanReview &&
      agent.run.humanDecision !== "accepted",
  ).length;
  const missingAttestations = finalizationStatus?.missing_attestations.length ?? 0;
  const approvalsStillNeeded = finalizationStatus
    ? Math.max(
        finalizationStatus.approvals_required -
          finalizationStatus.approvals_recorded,
        0,
      )
    : 0;
  const overrideSignals =
    request?.deficiency_findings.filter((finding) => finding.requires_human_review)
      .length ?? 0;
  return agentActions + missingAttestations + approvalsStillNeeded + overrideSignals;
}

function humanActionPhrase(
  agents: ConsoleAgent[],
  finalizationStatus?: FinalizationStatus | null,
): string {
  if (blockingItemCount(agents, undefined, finalizationStatus) > 0) {
    return "Blocking review";
  }
  if (humanActionCount(agents, undefined, finalizationStatus) > 0) {
    return "Human approval required";
  }
  return "Ready for approval recording";
}

function riskLabel(agent: ConsoleAgent, riskItems: string[]): string {
  if (agent.consoleStatus === "blocked") {
    return "Blocked";
  }
  if (agent.stale) {
    return "Stale";
  }
  if (riskItems.length > 0) {
    return `${riskItems.length} flags`;
  }
  return "Low";
}

function policyBasis(run: AgentRunLike | undefined): string {
  const evidence = run?.evidenceIds ?? [];
  const sop = evidence.find((id) => /SOP|RULE|ROUTE|TMPL/i.test(id));
  return sop ?? "No policy id linked";
}

function evidenceGroup(id: string): string {
  if (/^SOP|RULE|DEF/i.test(id)) {
    return "SOP";
  }
  if (/^TMPL|TEMPLATE/i.test(id)) {
    return "Template";
  }
  if (/^ROUTE|TAX|REG/i.test(id)) {
    return "Policy";
  }
  if (/^REC|GPS|SUB/i.test(id)) {
    return "Response record";
  }
  return "Evidence";
}

function qualityForEvidenceId(id: string): EvidenceChip["quality"] {
  if (/MISSING|GAP/i.test(id)) {
    return "missing";
  }
  if (/CONFLICT|MISMATCH/i.test(id)) {
    return "conflicting";
  }
  if (/SOP|TMPL|ROUTE|REC|GPS|SUB/i.test(id)) {
    return "direct";
  }
  return "inferred";
}

function qualityTitle(chip: EvidenceChip): string {
  if (chip.quality === "direct") {
    return "Direct supporting source";
  }
  if (chip.quality === "conflicting") {
    return "Evidence conflicts or requires reconciliation";
  }
  if (chip.quality === "missing") {
    return "Expected source is missing";
  }
  return "Inferred from available request context";
}

function humanize(value: string): string {
  const words = value.replace(/[_-]+/g, " ").trim();
  return words.length === 0
    ? value
    : words.charAt(0).toUpperCase() + words.slice(1);
}
