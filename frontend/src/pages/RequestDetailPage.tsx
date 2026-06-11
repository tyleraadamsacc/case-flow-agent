import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import type { AuditEvent, FinalizationStatus, LegalRequest } from "../api/types";
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
  legalProcessLabel,
  nextAction,
} from "../lib/requestDisplay";

/** Request Detail — the hero screen (plan §13): source document with
 * extracted spans, structured fields, the live Six-Agent Workflow Rail,
 * drafted artifacts, and the human review panel. Every state-changing
 * button here either runs agents (drafts only) or records a human
 * decision; nothing sends, releases, or discloses. */
export default function RequestDetailPage() {
  const { id = "" } = useParams();
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
    <ConsoleShell
      title={`Request ${request.legal_request_id}`}
      contextPanel={
        <ReviewPanel
          request={request}
          auditEvents={auditEvents}
          onUpdated={handleUpdated}
        />
      }
    >
      <header className="cf-hero cf-detail-header">
        <div className="cf-detail-hero__topline">
          <div className="cf-detail-header__title">
            <p className="cf-detail-hero__eyebrow">Request command center</p>
            <h1>{request.legal_request_id}</h1>
          </div>
          <div className="cf-detail-hero__badges">
            <StatusBadge status={state} />
            <StatusBadge status="synthetic_mock" />
            {request.urgency_tier ? (
              <Chip tone="red" dot>
                {request.urgency_tier}
              </Chip>
            ) : null}
          </div>
        </div>
        <p className="cf-detail-hero__summary">
          {agencyName(request)} request for {legalProcessLabel(request)}. Six
          agents prepare draft work only; human review is required before any
          route, package, or final audit decision is recorded.
        </p>
        <div className="cf-detail-header__meta">
          <WorkflowProgress state={state} />
        </div>
        <div className="cf-detail-hero__signals" aria-label="Request readiness summary">
          <Chip tone={completedAgents === 6 ? "green" : "blue"} dot>
            {completedAgents}/6 agents complete
          </Chip>
          <Chip tone={reviewFlags.length ? "amber" : "green"} dot>
            {reviewFlags.length
              ? `${reviewFlags.length} review flag${reviewFlags.length === 1 ? "" : "s"}`
              : "No review flags"}
          </Chip>
          <Chip tone={blockedDeficiency ? "red" : "neutral"} dot={blockedDeficiency}>
            {blockedDeficiency ? "Human review required" : "Draft workflow"}
          </Chip>
          <Chip tone="blue">Prepared next action: {nextAction(state)}</Chip>
        </div>
        <div className="cf-hero__facts">
          <div className="cf-fact">
            <p className="cf-fact__label">Requesting agency</p>
            <p className="cf-fact__value" title={agencyName(request)}>
              {agencyName(request)}
            </p>
          </div>
          <div className="cf-fact">
            <p className="cf-fact__label">Legal process</p>
            <p className="cf-fact__value">{legalProcessLabel(request)}</p>
          </div>
          <div className="cf-fact">
            <p className="cf-fact__label">Case number</p>
            <p className="cf-fact__value">
              {request.requesting_agency?.case_number ?? "Pending extraction"}
            </p>
          </div>
          <div className="cf-fact">
            <p className="cf-fact__label">Received</p>
            <p className="cf-fact__value">{formatDate(request.date_received)}</p>
          </div>
          <div className="cf-fact">
            <p className="cf-fact__label">Production deadline</p>
            <p className="cf-fact__value">
              {request.special_handling.production_deadline_days
                ? `${request.special_handling.production_deadline_days} days`
                : "None stated"}
            </p>
          </div>
          <div className="cf-fact">
            <p className="cf-fact__label">Owner</p>
            <p className="cf-fact__value">{request.owner ?? "Unassigned"}</p>
          </div>
        </div>
        <div className="cf-detail-header__actions">
          <Button
            variant={canExtract ? "filled" : "tonal"}
            disabled={!canExtract || busy !== null}
            onClick={() => run("Extraction", () => api.extract(id))}
          >
            {busy === "Extraction" ? "Extracting…" : "Extract request"}
          </Button>
          <Button
            variant={canValidate ? "filled" : "tonal"}
            disabled={!canValidate || busy !== null}
            onClick={() => run("Validation", () => api.validate(id))}
          >
            {busy === "Validation" ? "Validating…" : "Validate request"}
          </Button>
          <Button
            variant={canRunRail && !hasRuns ? "filled" : "tonal"}
            glow={canRunRail && !hasRuns}
            disabled={!canRunRail || busy !== null}
            onClick={() => run("Six-agent workflow", () => api.runAgentRail(id))}
          >
            {busy === "Six-agent workflow"
              ? "Running six agents…"
              : "Run six-agent workflow"}
          </Button>
        </div>
        {actionError ? <p className="cf-review__error">{actionError}</p> : null}
      </header>

      <div className="cf-detail-grid">
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

      <section className="cf-detail-section">
        <h2>Six-Agent Workflow Rail</h2>
        <p className="cf-detail-section__hint">
          {hasRuns
            ? "Latest persisted run per agent; every run carries its audit event."
            : "Agents have not run yet. Each agent will appear here with status, output, evidence, and its audit event."}
        </p>
        <SixAgentWorkflowRail
          request={request}
          auditEvents={auditEvents}
          finalizationStatus={finalizationStatus}
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
      </section>

      <section className="cf-detail-section">
        <h2>Drafted artifacts</h2>
        <p className="cf-detail-section__hint">
          All drafts are pending human review; no draft can be finalized or
          sent by an agent.
        </p>
        <div className="cf-preview__row" style={{ marginBottom: "var(--space-4)" }}>
          <Button
            disabled={busy !== null || !hasRuns || blockedDeficiency}
            onClick={() =>
              run("Package drafting", () => api.draftProductionPackage(id))
            }
          >
            {busy === "Package drafting"
              ? "Drafting…"
              : "Draft response package"}
          </Button>
          <Button
            variant="outlined"
            disabled={busy !== null || !hasRuns}
            onClick={() =>
              run("Deficiency response drafting", () =>
                api.draftDeficiencyResponse(id),
              )
            }
          >
            {busy === "Deficiency response drafting"
              ? "Drafting…"
              : "Draft deficiency response"}
          </Button>
          {blockedDeficiency ? (
            <Chip tone="red" dot>
              Package drafting blocked by deficiency
            </Chip>
          ) : null}
        </div>

        {request.production_package ? (
          <ResponsePackageView
            pkg={request.production_package}
            onUpdated={handleUpdated}
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
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              No drafts yet. Run the six-agent workflow to produce notes and a
              response package draft.
            </p>
          </Card>
        ) : null}
      </section>
    </ConsoleShell>
  );
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
