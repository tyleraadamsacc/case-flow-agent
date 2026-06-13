import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  summarizeGuidedActionResult,
  type GuidedActionReceipt as GuidedActionReceiptModel,
} from "../lib/guidedActionResult";
import {
  buildRequestGuidance,
  type RequestAgentCommandMode,
  type RequestGuidedActionKind,
  type RequestGuidance,
  type RequestWorkbenchTab,
} from "../lib/requestGuidance";
import {
  agencyName,
  formatDate,
  humanizeToken,
  legalProcessLabel,
} from "../lib/requestDisplay";

type RequestDetailTab = RequestWorkbenchTab;

const REQUEST_TABS: Array<{ id: RequestDetailTab; label: string }> = [
  { id: "overview", label: "Review brief" },
  { id: "evidence", label: "Evidence & fields" },
  { id: "agents", label: "Agent outputs" },
  { id: "drafts", label: "Draft package" },
  { id: "audit", label: "Audit trail" },
];

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
  const [supportingDataWarning, setSupportingDataWarning] = useState<string | null>(
    null,
  );
  const [actionReceipt, setActionReceipt] =
    useState<GuidedActionReceiptModel | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTraceTarget, setActiveTraceTarget] =
    useState<SourceTraceTarget | null>(null);
  const reviewRegionRef = useRef<HTMLDivElement | null>(null);
  const refreshSerialRef = useRef(0);

  const refreshSupportingData = useCallback((refreshSerial: number) => {
    void Promise.allSettled([
      api.auditTimeline(id),
      api.finalizationStatus(id),
    ]).then(([auditResult, finalizationResult]) => {
      if (refreshSerial !== refreshSerialRef.current) {
        return;
      }
      const warnings: string[] = [];
      if (auditResult.status === "fulfilled") {
        setAuditEvents(auditResult.value);
      } else {
        setAuditEvents([]);
        warnings.push("audit trail");
      }
      if (finalizationResult.status === "fulfilled") {
        setFinalizationStatus(finalizationResult.value);
      } else {
        setFinalizationStatus(null);
        warnings.push("approval readiness");
      }
      setSupportingDataWarning(
        warnings.length > 0
          ? `Could not refresh ${warnings.join(" and ")}. The request detail is shown, but supporting status may be incomplete.`
          : null,
      );
    });
  }, [id]);

  const refresh = useCallback(async () => {
    const refreshSerial = refreshSerialRef.current + 1;
    refreshSerialRef.current = refreshSerial;
    const detail = await api.getLegalRequest(id);
    if (refreshSerial !== refreshSerialRef.current) {
      return;
    }
    setRequest(detail);
    setLoadError(null);
    setSupportingDataWarning(null);

    refreshSupportingData(refreshSerial);
  }, [id, refreshSupportingData]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoadError(
        `Request ${id} did not load. Check that the matching backend is running.`,
      );
    }, 10000);

    refresh()
      .catch((cause: Error) => setLoadError(cause.message))
      .finally(() => window.clearTimeout(timeout));

    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const auditActions = useMemo(
    () =>
      Object.fromEntries(
        auditEvents.map((event) => [event.audit_event_id, event.action]),
      ),
    [auditEvents],
  );

  async function run(name: string, call: () => Promise<unknown>): Promise<void> {
    setBusy(name);
    setActionError(null);
    setActionReceipt(null);
    try {
      const result = await call();
      const receipt = summarizeGuidedActionResult(name, result);
      await refresh();
      setActionReceipt(receipt);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("tab");
      nextParams.delete("intent");
      setSearchParams(nextParams, { replace: true });
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
    const refreshSerial = refreshSerialRef.current + 1;
    refreshSerialRef.current = refreshSerial;
    setRequest(updated);
    setSupportingDataWarning(null);
    refreshSupportingData(refreshSerial);
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

  const currentRequest = request;
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

  const sourceBackedIdentifiers = request.subject_identifiers.filter((identifier) =>
    Boolean(identifier.source_span),
  ).length;
  const blockingFindings = request.deficiency_findings.filter(
    (finding) => finding.severity === "blocking",
  ).length;
  const latestAuditEvent = auditEvents[auditEvents.length - 1];
  const guidance = buildRequestGuidance({
    request,
    auditEvents,
    finalizationStatus,
    completedAgents,
    reviewFlags,
    sourceBackedIdentifiers,
    blockingFindings,
  });
  const tabParam = searchParams.get("tab");
  const intentParam = searchParams.get("intent");
  const decisionIntent = intentParam === "decision";
  const decisionPanelCanLead =
    guidance.primaryActionKind === "focusDecisionPanel" ||
    guidance.reviewPanelMode === "routeDecision" ||
    guidance.reviewPanelMode === "finalApproval" ||
    guidance.reviewPanelMode === "complete";
  const reviewPanelActive =
    (decisionPanelCanLead || decisionIntent) && !isRequestDetailTab(tabParam);
  const selectedTab: RequestDetailTab = isRequestDetailTab(tabParam)
    ? tabParam
    : decisionIntent
      ? "overview"
    : intentParam === "next"
      ? guidance.recommendedTab
    : guidance.recommendedTab;
  const activeWorkspaceLabel = reviewPanelActive
    ? "Human decision controls"
    : REQUEST_TABS.find((tab) => tab.id === selectedTab)?.label ?? "Review workspace";
  const activeWorkspaceHelper = reviewPanelActive
    ? "Record the human route, escalation, QA handoff, or final approval when the checklist is ready."
    : "Use this supporting workspace to finish the current guided task.";

  function handleTabChange(tab: RequestDetailTab) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("intent");
    if (!decisionPanelCanLead && tab === guidance.recommendedTab) {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }
    setSearchParams(nextParams, { replace: true });
  }

  function focusDecisionPanel() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("tab");
    nextParams.set("intent", "decision");
    setSearchParams(nextParams, { replace: true });
    window.requestAnimationFrame(() => {
      reviewRegionRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
      reviewRegionRef.current?.focus({ preventScroll: true });
    });
  }

  function guidedActionDisabled(kind: RequestGuidedActionKind): boolean {
    if (busy !== null) {
      return true;
    }
    if (kind === "extract") {
      return !canExtract;
    }
    if (kind === "validate") {
      return !canValidate;
    }
    if (kind === "runAgents") {
      return !canRunRail;
    }
    if (
      kind === "openEvidence" ||
      kind === "openAgents" ||
      kind === "openDrafts" ||
      kind === "openAudit" ||
      kind === "focusDecisionPanel"
    ) {
      return false;
    }
    return kind === "none";
  }

  function handleGuidedAction(kind: RequestGuidedActionKind) {
    switch (kind) {
      case "extract":
        void run("Extraction", () => api.extract(id));
        return;
      case "validate":
        void run("Validation", () => api.validate(id));
        return;
      case "runAgents":
        void run("Six-agent workflow", () => api.runAgentRail(id));
        return;
      case "openEvidence":
        handleTabChange("evidence");
        return;
      case "openAgents":
        handleTabChange("agents");
        return;
      case "openDrafts":
        handleTabChange("drafts");
        return;
      case "openAudit":
        handleTabChange("audit");
        return;
      case "focusDecisionPanel":
        focusDecisionPanel();
        return;
      case "none":
      default:
        return;
    }
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

  function renderReviewPanel() {
    return (
      <ReviewPanel
        request={currentRequest}
        auditEvents={auditEvents}
        reviewPanelMode={guidance.reviewPanelMode}
        onUpdated={handleUpdated}
        onActionResult={(notice, updated) =>
          setActionReceipt({
            actionName: "Human decision",
            title: "Human decision recorded",
            summary: `${notice} Current state: ${humanizeToken(
              updated.workflow_state,
            )}.`,
            workflowState: updated.workflow_state,
            auditSummaries: [],
          })
        }
      />
    );
  }

  function renderSelectedWorkspace() {
    if (selectedTab === "overview") {
      return (
        <OverviewTab
          request={currentRequest}
          completedAgents={completedAgents}
          reviewFlags={reviewFlags}
          blockedDeficiency={blockedDeficiency}
          sourceBackedIdentifiers={sourceBackedIdentifiers}
          blockingFindings={blockingFindings}
          onOpenEvidence={() => handleTabChange("evidence")}
          onOpenAgents={() => handleTabChange("agents")}
          onOpenDrafts={() => handleTabChange("drafts")}
        />
      );
    }

    if (selectedTab === "evidence") {
      return (
        <section
          aria-labelledby="request-tab-evidence"
          className="cf-request-tab-panel"
          id="request-panel-evidence"
          role="tabpanel"
        >
          <div className="cf-detail-grid cf-detail-grid--evidence">
            <SourceDocumentPanel
              request={currentRequest}
              activeTraceTarget={activeTraceTarget}
            />
            <ExtractedFieldsPanel
              request={currentRequest}
              onUpdated={handleUpdated}
              onTraceTarget={setActiveTraceTarget}
              resolveTraceTarget={resolveTraceTarget}
            />
          </div>
        </section>
      );
    }

    if (selectedTab === "agents") {
      return (
        <AgentsTab
          request={currentRequest}
          auditEvents={auditEvents}
          finalizationStatus={finalizationStatus}
          hasRuns={hasRuns}
          runs={toRailRuns(
            currentRequest.agent_runs,
            auditActions,
            currentRequest.agent_run_reviews,
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
          agentCommandMode={guidance.agentCommandMode}
        />
      );
    }

    if (selectedTab === "drafts") {
      return (
        <DraftsTab
          request={currentRequest}
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
      );
    }

    return <AuditTab auditEvents={auditEvents} />;
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
              label="Next required action"
              value={guidance.nextRequiredAction}
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

        {supportingDataWarning ? (
          <p className="cf-request-support-warning" role="status">
            {supportingDataWarning}
          </p>
        ) : null}

        <GuidedReviewWorkbench
          guidance={guidance}
          actionReceipt={actionReceipt}
          primaryActionDisabled={guidedActionDisabled(guidance.primaryActionKind)}
          busyLabel={busy}
          onAction={handleGuidedAction}
          onStepSelect={(step) => {
            if (step.status !== "pending") {
              handleTabChange(step.tab);
            }
          }}
        />

        <section className="cf-guided-stage" aria-label="Request review workspace">
          <div className="cf-guided-stage__header">
            <div>
              <span className="cf-guided-workbench__eyebrow">Current workspace</span>
              <h2>{activeWorkspaceLabel}</h2>
              <p>{activeWorkspaceHelper}</p>
            </div>
            {reviewPanelActive ? (
              <Chip tone="blue" dot>
                Decision step
              </Chip>
            ) : null}
          </div>
          {reviewPanelActive ? (
            <div
              className="cf-guided-support-links"
              aria-label="Supporting workspaces"
            >
              {REQUEST_TABS.map((tab) => (
                <Button
                  key={tab.id}
                  variant="outlined"
                  size="sm"
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          ) : (
            <RequestTabNav selectedTab={selectedTab} onTabChange={handleTabChange} />
          )}
          <div
            className="cf-guided-stage__body"
            ref={reviewPanelActive ? reviewRegionRef : undefined}
            tabIndex={reviewPanelActive ? -1 : undefined}
          >
            {reviewPanelActive ? renderReviewPanel() : renderSelectedWorkspace()}
          </div>
        </section>

        {!reviewPanelActive ? (
          <details
            className="cf-guided-disclosure cf-guided-decision-disclosure"
          >
            <summary>
              <span>Human decision controls</span>
              <small>
                Approve, request changes, escalate, send to QA, or record final approval.
              </small>
            </summary>
            <div className="cf-guided-disclosure__body">{renderReviewPanel()}</div>
          </details>
        ) : null}
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

function GuidedReviewWorkbench({
  guidance,
  actionReceipt,
  primaryActionDisabled,
  busyLabel,
  onAction,
  onStepSelect,
}: {
  guidance: RequestGuidance;
  actionReceipt: GuidedActionReceiptModel | null;
  primaryActionDisabled: boolean;
  busyLabel: string | null;
  onAction: (kind: RequestGuidedActionKind) => void;
  onStepSelect: (step: RequestGuidance["steps"][number]) => void;
}) {
  const primaryChangesState = ["extract", "validate", "runAgents"].includes(
    guidance.primaryActionKind,
  );
  const primaryBusy =
    busyLabel === "Extraction" ||
    busyLabel === "Validation" ||
    busyLabel === "Six-agent workflow";
  const primaryLabel = primaryBusy
    ? busyLabel === "Extraction"
      ? "Extracting..."
      : busyLabel === "Validation"
        ? "Validating..."
        : "Running six agents..."
    : guidance.primaryActionLabel;
  const primaryBlocker = guidance.blockerTasks[0];

  return (
    <section
      className="cf-guided-workbench"
      aria-labelledby="guided-review-heading"
    >
      <div className="cf-guided-workbench__focus">
        <span className="cf-guided-workbench__eyebrow">Next required action</span>
        <h2 id="guided-review-heading">{guidance.nextRequiredAction}</h2>
        <p>{guidance.nextActionReason}</p>
        <p className="cf-guided-expectation">{guidance.resultExpectation}</p>
        {primaryBlocker ? (
          <div className="cf-guided-blocker-callout">
            <Chip tone="red" dot>
              {primaryBlocker.label}
            </Chip>
            <div>
              <strong>{primaryBlocker.detail}</strong>
              <Button
                size="sm"
                variant="text"
                onClick={() => onAction(primaryBlocker.actionKind)}
              >
                {primaryBlocker.actionLabel}
              </Button>
            </div>
          </div>
        ) : null}
        {actionReceipt ? (
          <GuidedActionReceipt
            receipt={actionReceipt}
            nextAction={guidance.nextRequiredAction}
          />
        ) : null}
        <ul className="cf-guided-checklist" aria-label="Current step checklist">
          {guidance.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {guidance.disabledReasons.length > 0 ? (
          <ul className="cf-guided-disabled-reasons" aria-label="Disabled action reasons">
            {guidance.disabledReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        <div className="cf-guided-workbench__actions">
          <Button
            variant={primaryChangesState ? "filled" : "tonal"}
            glow={primaryChangesState && !primaryActionDisabled}
            disabled={primaryActionDisabled}
            onClick={() => onAction(guidance.primaryActionKind)}
          >
            {primaryLabel}
          </Button>
          {guidance.secondaryActions.map((action) => (
            <Button
              key={`${action.kind}-${action.label}`}
              variant="outlined"
              onClick={() => onAction(action.kind)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="cf-guided-disclosures">
        <details className="cf-guided-disclosure">
          <summary>
            <span>Workflow map</span>
            <small>See every request step and jump to completed workspaces.</small>
          </summary>
          <div className="cf-guided-disclosure__body">
            <ol aria-label="Guided request steps" className="cf-guided-steps">
              {guidance.steps.map((step, index) => (
                <li key={step.id}>
                  <button
                    type="button"
                    className={`cf-guided-step cf-guided-step--${step.status}`}
                    aria-current={step.id === guidance.currentStepId ? "step" : undefined}
                    disabled={step.status === "pending"}
                    onClick={() => onStepSelect(step)}
                  >
                    <span className="cf-guided-step__index">{index + 1}</span>
                    <span className="cf-guided-step__copy">
                      <strong>{step.label}</strong>
                      <small>{step.description}</small>
                    </span>
                    <Chip tone={stepTone(step.status)} dot={step.status !== "pending"}>
                      {stepStatusLabel(step.status)}
                    </Chip>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </details>

        <details className="cf-guided-disclosure">
          <summary>
            <span>
              {guidance.blockerTasks.length > 0 ? "Issue details" : "Approval gates"}
            </span>
            <small>
              {guidance.blockerTasks.length > 0
                ? `${guidance.blockerTasks.length} item${
                    guidance.blockerTasks.length === 1 ? "" : "s"
                  } must be cleared.`
                : "No blocking gate is active."}
            </small>
          </summary>
          <div className="cf-guided-disclosure__body">
            {guidance.blockerTasks.length > 0 ? (
              <ul className="cf-guided-blockers" aria-label="Guided review blockers">
                {guidance.blockerTasks.map((blocker) => (
                  <li key={blocker.detail}>
                    <Chip tone="red" dot>
                      {blocker.label}
                    </Chip>
                    <span>{blocker.detail}</span>
                    <Button
                      size="sm"
                      variant="text"
                      onClick={() => onAction(blocker.actionKind)}
                    >
                      {blocker.actionLabel}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="cf-guided-ready">
                <Chip tone="green" dot>
                  No blocking gate
                </Chip>
                <p>Use the decision controls when the current step checks are complete.</p>
              </div>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}

function GuidedActionReceipt({
  receipt,
  nextAction,
}: {
  receipt: GuidedActionReceiptModel;
  nextAction: string;
}) {
  return (
    <div className="cf-guided-receipt" role="status" aria-live="polite">
      <Chip tone="green" dot>
        Result
      </Chip>
      <div>
        <strong>{receipt.title}</strong>
        <p>{receipt.summary}</p>
        {receipt.auditSummaries.slice(0, 2).map((summary) => (
          <small key={summary}>Audit: {summary}</small>
        ))}
        <small>Next: {nextAction}</small>
      </div>
    </div>
  );
}

function stepTone(
  status: RequestGuidance["steps"][number]["status"],
): "green" | "blue" | "amber" | "red" | "neutral" {
  switch (status) {
    case "complete":
      return "green";
    case "current":
      return "blue";
    case "blocked":
      return "red";
    case "pending":
    default:
      return "neutral";
  }
}

function stepStatusLabel(status: RequestGuidance["steps"][number]["status"]) {
  switch (status) {
    case "complete":
      return "Done";
    case "current":
      return "Now";
    case "blocked":
      return "Blocked";
    case "pending":
    default:
      return "Pending";
  }
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
              Evidence & fields
            </Button>
            <Button variant="outlined" onClick={onOpenAgents}>
              Agent outputs
            </Button>
            <Button variant="outlined" onClick={onOpenDrafts}>
              Draft package
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
  agentCommandMode,
  onOpenSourceTrace,
  onAcceptAgent,
  onRerunAgent,
}: {
  request: LegalRequest;
  auditEvents: AuditEvent[];
  finalizationStatus: FinalizationStatus | null;
  hasRuns: boolean;
  runs: ReturnType<typeof toRailRuns>;
  agentCommandMode: RequestAgentCommandMode;
  onOpenSourceTrace: (
    sourceSpan: string | null | undefined,
    fallbackTerms?: string[],
  ) => void;
  onAcceptAgent: (agentId: string) => Promise<void> | void;
  onRerunAgent: (agentId: string, instruction: string) => Promise<void> | void;
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
        agentCommandMode={agentCommandMode}
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
