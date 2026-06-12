import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import type {
  AuditEvent,
  FinalizationStatus,
  LegalRequest,
} from "../api/types";
import SixAgentWorkflowRail from "../components/agents/SixAgentWorkflowRail";
import ConsoleShell from "../components/layout/ConsoleShell";
import ResponsePackageView from "../components/package/ResponsePackageView";
import TextDraftView from "../components/package/TextDraftView";
import ExtractedFieldsPanel from "../components/request/ExtractedFieldsPanel";
import ReviewPanel from "../components/request/ReviewPanel";
import SourceDocumentPanel from "../components/request/SourceDocumentPanel";
import type { SourceTraceTarget } from "../components/request/SourceDocumentPanel";
import WorkflowProgress from "../components/request/WorkflowProgress";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import StatusBadge from "../components/ui/StatusBadge";
import { toRailRuns } from "../lib/agentRunMapping";
import {
  agencyName,
  formatDate,
  humanizeToken,
  legalProcessLabel,
  nextAction,
} from "../lib/requestDisplay";

type RequestDetailTab = "overview" | "evidence" | "agents" | "drafts" | "audit";

const REQUEST_TABS: Array<{ id: RequestDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "agents", label: "Agents" },
  { id: "drafts", label: "Drafts" },
  { id: "audit", label: "Audit" },
];

const DEFAULT_TAB: RequestDetailTab = "overview";

/** Request Detail — the hero screen (plan §13): source document with
 * extracted spans, structured fields, the live Six-Agent Workflow Rail,
 * drafted artifacts, and the human review panel. Every state-changing
 * button here either runs agents (drafts only) or records a human
 * decision; nothing sends, releases, or discloses. */
export default function RequestDetailPage() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [request, setRequest] = useState<LegalRequest | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [finalizationStatus, setFinalizationStatus] =
    useState<FinalizationStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTraceTarget, setActiveTraceTarget] =
    useState<SourceTraceTarget | null>(null);

  const refresh = useCallback(async () => {
    const [detail, events, status] = await Promise.all([
      api.getLegalRequest(id),
      api.auditTimeline(id),
      api.finalizationStatus(id).catch(() => null),
    ]);
    setRequest(detail);
    setAuditEvents(events);
    setFinalizationStatus(status);
  }, [id]);

  useEffect(() => {
    refresh().catch((cause: Error) => setLoadError(cause.message));
  }, [refresh]);

  const auditActions = useMemo(
    () =>
      Object.fromEntries(
        auditEvents.map((event) => [event.audit_event_id, event.action]),
      ),
    [auditEvents],
  );

  async function run(name: string, call: () => Promise<unknown>) {
    setBusy(name);
    setActionError(null);
    try {
      await call();
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiError) {
        const detail =
          typeof cause.detail === "string"
            ? cause.detail
            : JSON.stringify(cause.detail);
        setActionError(`${name} refused: ${detail}`);
      } else {
        setActionError(`${name} failed: ${(cause as Error).message}`);
      }
    } finally {
      setBusy(null);
    }
  }

  function handleUpdated(updated: LegalRequest) {
    setRequest(updated);
    api.auditTimeline(id).then(setAuditEvents).catch(() => undefined);
    api.finalizationStatus(id)
      .then(setFinalizationStatus)
      .catch(() => setFinalizationStatus(null));
  }

  if (loadError) {
    return (
      <ConsoleShell title="Request Detail">
        <Card variant="soft">
          <p style={{ margin: 0, color: "var(--red)" }}>
            Could not load {id}: {loadError}
          </p>
        </Card>
      </ConsoleShell>
    );
  }

  if (!request) {
    return (
      <ConsoleShell title="Request Detail">
        <Card variant="soft">
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>Loading…</p>
        </Card>
      </ConsoleShell>
    );
  }

  const state = request.workflow_state;
  const tabParam = searchParams.get("tab");
  const selectedTab: RequestDetailTab = isRequestDetailTab(tabParam)
    ? tabParam
    : DEFAULT_TAB;
  const hasRuns = Object.keys(request.agent_runs).length > 0;
  const canExtract = state === "request_received";
  const canValidate = state === "request_extracted";
  const canRunRail = [
    "request_extracted",
    "request_validated",
    "analyst_review_pending",
    "changes_requested",
    "escalated",
  ].includes(state);
  const blockedDeficiency = request.deficiency_findings.some(
    (finding) => finding.severity === "blocking",
  );
  const sourceSections = request.source_sections ?? [];
  const completedAgents = Object.values(request.agent_runs).filter(
    (run) => run.status === "complete",
  ).length;
  const reviewFlags = [
    ...(request.classification?.review_reasons ?? []),
    ...Object.values(request.agent_runs).flatMap((run) => run.risk_flags),
    ...request.deficiency_findings
      .filter((finding) => finding.severity === "blocking")
      .map((finding) => finding.code),
  ];

  const sourceBackedIdentifiers = request.subject_identifiers.filter((identifier) =>
    Boolean(identifier.source_span),
  ).length;
  const blockingFindings = request.deficiency_findings.filter(
    (finding) => finding.severity === "blocking",
  ).length;
  const latestAuditEvent = auditEvents[auditEvents.length - 1];

  function handleTabChange(tab: RequestDetailTab) {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === DEFAULT_TAB) {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function resolveTraceTarget(
    sourceSpan: string | null | undefined,
    fallbackTerms: string[] = [],
  ): SourceTraceTarget | null {
    if (sourceSections.length === 0) {
      return null;
    }

    const sourceSpanTarget = sourceSpan
      ? sectionTargetForTerm(sourceSections, sourceSpan, sourceSpan)
      : null;
    if (sourceSpanTarget) {
      return sourceSpanTarget;
    }

    for (const term of fallbackTerms.filter(Boolean)) {
      const target = sectionTargetForTerm(sourceSections, term, sourceSpan ?? null);
      if (target) {
        return target;
      }
    }
    return null;
  }

  return (
    <ConsoleShell title={`Request ${request.legal_request_id}`}>
      <div className="cf-request-command">
        <header className="cf-request-header">
          <div className="cf-request-header__main">
            <div className="cf-request-header__eyebrow">
              <span>Request command center</span>
              <StatusBadge status={state} />
              <StatusBadge status="synthetic_mock" />
              {request.urgency_tier ? (
                <Chip tone="amber" dot>
                  {humanizeToken(request.urgency_tier)}
                </Chip>
              ) : null}
            </div>
            <h1>{request.legal_request_id}</h1>
            <p>
              {agencyName(request)} request for {legalProcessLabel(request)}.
              Human review controls every route, package, and final audit
              decision.
            </p>
          </div>
          <div className="cf-request-header__actions" aria-label="Request actions">
            <Button
              variant={canExtract ? "filled" : "tonal"}
              disabled={!canExtract || busy !== null}
              onClick={() => run("Extraction", () => api.extract(id))}
            >
              {busy === "Extraction" ? "Extracting..." : "Extract request"}
            </Button>
            <Button
              variant={canValidate ? "filled" : "tonal"}
              disabled={!canValidate || busy !== null}
              onClick={() => run("Validation", () => api.validate(id))}
            >
              {busy === "Validation" ? "Validating..." : "Validate request"}
            </Button>
            <Button
              variant={canRunRail && !hasRuns ? "filled" : "tonal"}
              glow={canRunRail && !hasRuns}
              disabled={!canRunRail || busy !== null}
              onClick={() => run("Six-agent workflow", () => api.runAgentRail(id))}
            >
              {busy === "Six-agent workflow"
                ? "Running six agents..."
                : "Run six-agent workflow"}
            </Button>
          </div>
          <div className="cf-request-header__progress">
            <WorkflowProgress state={state} />
          </div>
          <div className="cf-request-signal-strip" aria-label="Request readiness summary">
            <RequestSignal
              label="Agents"
              value={`${completedAgents}/6`}
              helper="draft outputs complete"
              tone={completedAgents === 6 ? "green" : "blue"}
            />
            <RequestSignal
              label="Review flags"
              value={String(reviewFlags.length)}
              helper={reviewFlags.length ? "need analyst attention" : "none detected"}
              tone={reviewFlags.length ? "amber" : "green"}
            />
            <RequestSignal
              label="Evidence"
              value={`${sourceBackedIdentifiers}/${request.subject_identifiers.length}`}
              helper="source-backed IDs"
              tone={sourceBackedIdentifiers ? "green" : "neutral"}
            />
            <RequestSignal
              label="Blockers"
              value={String(blockingFindings)}
              helper={blockedDeficiency ? "blocking deficiencies" : "no blockers"}
              tone={blockedDeficiency ? "red" : "green"}
            />
            <RequestSignal
              label="Next action"
              value={nextAction(state)}
              helper={
                latestAuditEvent
                  ? `Last: ${humanizeToken(latestAuditEvent.action)}`
                  : "No audit events"
              }
              tone="blue"
            />
          </div>
          {actionError ? <p className="cf-review__error">{actionError}</p> : null}
        </header>

        <section className="cf-request-workspace" aria-label="Request review workspace">
          <div className="cf-request-workspace__main">
            <RequestTabNav selectedTab={selectedTab} onTabChange={handleTabChange} />
            <div className="cf-request-tab-panels">
              {selectedTab === "overview" ? (
                <OverviewTab
                  request={request}
                  completedAgents={completedAgents}
                  reviewFlags={reviewFlags}
                  blockedDeficiency={blockedDeficiency}
                  sourceBackedIdentifiers={sourceBackedIdentifiers}
                  blockingFindings={blockingFindings}
                  onOpenEvidence={() => handleTabChange("evidence")}
                  onOpenAgents={() => handleTabChange("agents")}
                  onOpenDrafts={() => handleTabChange("drafts")}
                />
              ) : null}
              {selectedTab === "evidence" ? (
                <section
                  aria-labelledby="request-tab-evidence"
                  className="cf-request-tab-panel"
                  id="request-panel-evidence"
                  role="tabpanel"
                >
                  <div className="cf-detail-grid cf-detail-grid--evidence">
                    <SourceDocumentPanel
                      request={request}
                      activeTraceTarget={activeTraceTarget}
                    />
                    <ExtractedFieldsPanel
                      request={request}
                      onUpdated={handleUpdated}
                      onTraceTarget={setActiveTraceTarget}
                      resolveTraceTarget={resolveTraceTarget}
                    />
                  </div>
                </section>
              ) : null}
              {selectedTab === "agents" ? (
                <AgentsTab
                  request={request}
                  auditEvents={auditEvents}
                  finalizationStatus={finalizationStatus}
                  hasRuns={hasRuns}
                  runs={toRailRuns(
                    request.agent_runs,
                    auditActions,
                    request.agent_run_reviews,
                  )}
                  onOpenSourceTrace={(sourceSpan, fallbackTerms = []) =>
                    setActiveTraceTarget(resolveTraceTarget(sourceSpan, fallbackTerms))
                  }
                  onAcceptAgent={(agentId) =>
                    run("Agent acceptance", () =>
                      api.acceptAgentRun(
                        id,
                        agentId,
                        "Accepted from the Six-Agent Workflow Rail.",
                      ),
                    )
                  }
                  onRerunAgent={(agentId, instruction) =>
                    run("Agent redraft", () =>
                      api.rerunAgent(id, agentId, instruction || undefined),
                    )
                  }
                />
              ) : null}
              {selectedTab === "drafts" ? (
                <DraftsTab
                  request={request}
                  busy={busy}
                  hasRuns={hasRuns}
                  blockedDeficiency={blockedDeficiency}
                  onDraftPackage={() =>
                    run("Package drafting", () => api.draftProductionPackage(id))
                  }
                  onDraftDeficiency={() =>
                    run("Deficiency response drafting", () =>
                      api.draftDeficiencyResponse(id),
                    )
                  }
                  onUpdated={handleUpdated}
                />
              ) : null}
              {selectedTab === "audit" ? (
                <AuditTab auditEvents={auditEvents} />
              ) : null}
            </div>
          </div>
          <aside className="cf-request-workspace__review" aria-label="Human review panel">
            <ReviewPanel
              request={request}
              auditEvents={auditEvents}
              onUpdated={handleUpdated}
            />
          </aside>
        </section>
      </div>
    </ConsoleShell>
  );
}

function RequestTabNav({
  selectedTab,
  onTabChange,
}: {
  selectedTab: RequestDetailTab;
  onTabChange: (tab: RequestDetailTab) => void;
}) {
  return (
    <nav className="cf-request-tabs" aria-label="Request sections" role="tablist">
      {REQUEST_TABS.map((tab) => (
        <button
          aria-controls={`request-panel-${tab.id}`}
          aria-selected={selectedTab === tab.id}
          className="cf-request-tab"
          id={`request-tab-${tab.id}`}
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function RequestSignal({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "green" | "blue" | "amber" | "red" | "neutral";
}) {
  return (
    <div className={`cf-request-signal cf-request-signal--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

function OverviewTab({
  request,
  completedAgents,
  reviewFlags,
  blockedDeficiency,
  sourceBackedIdentifiers,
  blockingFindings,
  onOpenEvidence,
  onOpenAgents,
  onOpenDrafts,
}: {
  request: LegalRequest;
  completedAgents: number;
  reviewFlags: string[];
  blockedDeficiency: boolean;
  sourceBackedIdentifiers: number;
  blockingFindings: number;
  onOpenEvidence: () => void;
  onOpenAgents: () => void;
  onOpenDrafts: () => void;
}) {
  const routing = request.routing_recommendation;
  const topReviewFlags = [...new Set(reviewFlags)].slice(0, 6);
  return (
    <section
      aria-labelledby="request-tab-overview"
      className="cf-request-tab-panel"
      id="request-panel-overview"
      role="tabpanel"
    >
      <div className="cf-request-overview-grid">
        <Card
          className="cf-request-focus-card"
          title="Review focus"
          subtitle="Current decision context for the reviewer."
        >
          <div className="cf-request-focus-card__body">
            <div>
              <span>Recommended route</span>
              <strong>{routing?.target_queue ?? "Pending route recommendation"}</strong>
              <p>
                {routing?.reason ??
                  "Run or review agent outputs before recording a routing decision."}
              </p>
            </div>
            <Chip tone={blockedDeficiency ? "red" : "amber"} dot={blockedDeficiency}>
              {blockedDeficiency ? "Blocking review" : "Analyst review pending"}
            </Chip>
          </div>
        </Card>

        <Card title="Request facts" subtitle="Core intake details.">
          <div className="cf-request-fact-grid">
            <RequestFact label="Agency" value={agencyName(request)} />
            <RequestFact label="Legal process" value={legalProcessLabel(request)} />
            <RequestFact
              label="Case"
              value={request.requesting_agency?.case_number ?? "Pending extraction"}
            />
            <RequestFact label="Received" value={formatDate(request.date_received)} />
            <RequestFact
              label="Deadline"
              value={
                request.special_handling.production_deadline_days
                  ? `${request.special_handling.production_deadline_days} days`
                  : "None stated"
              }
            />
            <RequestFact label="Owner" value={request.owner ?? "Unassigned"} />
          </div>
        </Card>

        <Card title="Workflow readiness" subtitle="Draft work prepared for review.">
          <div className="cf-request-readiness-list">
            <ReadinessRow
              label="Agent outputs"
              value={`${completedAgents}/6 complete`}
              tone={completedAgents === 6 ? "green" : "blue"}
            />
            <ReadinessRow
              label="Source-backed identifiers"
              value={`${sourceBackedIdentifiers}/${request.subject_identifiers.length}`}
              tone={sourceBackedIdentifiers ? "green" : "neutral"}
            />
            <ReadinessRow
              label="Review flags"
              value={`${reviewFlags.length} active`}
              tone={reviewFlags.length ? "amber" : "green"}
            />
            <ReadinessRow
              label="Blocking findings"
              value={`${blockingFindings} blocking`}
              tone={blockingFindings ? "red" : "green"}
            />
          </div>
        </Card>

        <Card title="Priority items" subtitle="Review drivers before final action.">
          {topReviewFlags.length ? (
            <div className="cf-request-chip-list">
              {topReviewFlags.map((flag) => (
                <Chip key={flag} tone="amber" dot>
                  {humanizeToken(flag)}
                </Chip>
              ))}
              {reviewFlags.length > topReviewFlags.length ? (
                <Chip tone="neutral">+{reviewFlags.length - topReviewFlags.length}</Chip>
              ) : null}
            </div>
          ) : (
            <p className="cf-request-muted">No review flags are active.</p>
          )}
          <div className="cf-request-overview-actions">
            <Button variant="outlined" onClick={onOpenEvidence}>
              Review evidence
            </Button>
            <Button variant="outlined" onClick={onOpenAgents}>
              Review agents
            </Button>
            <Button variant="outlined" onClick={onOpenDrafts}>
              Review drafts
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

function RequestFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="cf-request-fact">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function ReadinessRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "blue" | "amber" | "red" | "neutral";
}) {
  return (
    <div className="cf-request-readiness-row">
      <span>{label}</span>
      <Chip tone={tone} dot={tone !== "neutral"}>
        {value}
      </Chip>
    </div>
  );
}

function AgentsTab({
  request,
  auditEvents,
  finalizationStatus,
  hasRuns,
  runs,
  onOpenSourceTrace,
  onAcceptAgent,
  onRerunAgent,
}: {
  request: LegalRequest;
  auditEvents: AuditEvent[];
  finalizationStatus: FinalizationStatus | null;
  hasRuns: boolean;
  runs: ReturnType<typeof toRailRuns>;
  onOpenSourceTrace: (
    sourceSpan: string | null | undefined,
    fallbackTerms?: string[],
  ) => void;
  onAcceptAgent: (agentId: string) => void;
  onRerunAgent: (agentId: string, instruction: string) => void;
}) {
  return (
    <section
      aria-labelledby="request-tab-agents"
      className="cf-request-tab-panel"
      id="request-panel-agents"
      role="tabpanel"
    >
      <div className="cf-request-section-heading">
        <div>
          <h2>Six-agent workflow rail</h2>
          <p>
            {hasRuns
              ? "Latest persisted run per agent with linked evidence and audit trace."
              : "Agents have not run yet. Each agent will appear here after the workflow starts."}
          </p>
        </div>
      </div>
      <SixAgentWorkflowRail
        request={request}
        auditEvents={auditEvents}
        finalizationStatus={finalizationStatus}
        runs={runs}
        onOpenSourceTrace={onOpenSourceTrace}
        onAcceptAgent={onAcceptAgent}
        onRerunAgent={onRerunAgent}
      />
    </section>
  );
}

function DraftsTab({
  request,
  busy,
  hasRuns,
  blockedDeficiency,
  onDraftPackage,
  onDraftDeficiency,
  onUpdated,
}: {
  request: LegalRequest;
  busy: string | null;
  hasRuns: boolean;
  blockedDeficiency: boolean;
  onDraftPackage: () => void;
  onDraftDeficiency: () => void;
  onUpdated: (request: LegalRequest) => void;
}) {
  return (
    <section
      aria-labelledby="request-tab-drafts"
      className="cf-request-tab-panel"
      id="request-panel-drafts"
      role="tabpanel"
    >
      <div className="cf-request-section-heading">
        <div>
          <h2>Drafted artifacts</h2>
          <p>All drafts stay pending human review before any final action.</p>
        </div>
        <div className="cf-request-section-heading__actions">
          <Button
            disabled={busy !== null || !hasRuns || blockedDeficiency}
            onClick={onDraftPackage}
          >
            {busy === "Package drafting" ? "Drafting..." : "Draft response package"}
          </Button>
          <Button
            variant="outlined"
            disabled={busy !== null || !hasRuns}
            onClick={onDraftDeficiency}
          >
            {busy === "Deficiency response drafting"
              ? "Drafting..."
              : "Draft deficiency response"}
          </Button>
        </div>
      </div>

      {blockedDeficiency ? (
        <Chip tone="red" dot>
          Package drafting blocked by deficiency
        </Chip>
      ) : null}

      {request.production_package ? (
        <ResponsePackageView
          pkg={request.production_package}
          onUpdated={onUpdated}
        />
      ) : null}

      {request.text_drafts
        .filter((draft) => draft.draft_type !== "production_package")
        .map((draft) => (
          <TextDraftView key={draft.draft_type} draft={draft} />
        ))}

      {request.note_drafts.length > 0 ? (
        <Card
          title="Drafted notes"
          subtitle="Note Taking and Data Entry Agent, pending human approval"
        >
          <ul className="cf-note-list">
            {request.note_drafts.map((note) => (
              <li key={note.note_type}>
                <Chip tone="blue">{note.note_type}</Chip>
                <p className="cf-package__text--pre">{note.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!request.production_package &&
      request.text_drafts.length === 0 &&
      request.note_drafts.length === 0 ? (
        <Card variant="soft">
          <p className="cf-request-muted">
            No drafts yet. Run the six-agent workflow to produce notes and a
            response package draft.
          </p>
        </Card>
      ) : null}
    </section>
  );
}

function AuditTab({ auditEvents }: { auditEvents: AuditEvent[] }) {
  return (
    <section
      aria-labelledby="request-tab-audit"
      className="cf-request-tab-panel"
      id="request-panel-audit"
      role="tabpanel"
    >
      <Card title="Audit trail" subtitle={`${auditEvents.length} events logged`}>
        <ol className="cf-request-audit-list">
          {auditEvents.map((event) => (
            <li key={event.audit_event_id}>
              <div>
                <Chip tone={event.actor_type === "human" ? "blue" : "neutral"}>
                  {event.actor_type === "agent"
                    ? humanizeToken(event.actor_id)
                    : humanizeToken(event.actor_type)}
                </Chip>
                <strong>{humanizeToken(event.action)}</strong>
                <p>{event.summary}</p>
              </div>
              <time>{formatDate(event.timestamp)}</time>
            </li>
          ))}
          {auditEvents.length === 0 ? (
            <li className="cf-request-empty-row">No audit events yet.</li>
          ) : null}
        </ol>
      </Card>
    </section>
  );
}

function isRequestDetailTab(value: string | null): value is RequestDetailTab {
  return REQUEST_TABS.some((tab) => tab.id === value);
}

function sectionTargetForTerm(
  sections: LegalRequest["source_sections"],
  term: string,
  sourceSpan: string | null,
): SourceTraceTarget | null {
  const normalizedTerm = normalizeTraceText(term);
  if (!normalizedTerm) {
    return null;
  }

  for (const section of sections) {
    const normalizedText = normalizeTraceText(`${section.title} ${section.text}`);
    if (normalizedText.includes(normalizedTerm)) {
      return {
        section_id: section.section_id,
        source_span: sourceSpan,
        label: section.title,
      };
    }
  }
  return null;
}

function normalizeTraceText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
