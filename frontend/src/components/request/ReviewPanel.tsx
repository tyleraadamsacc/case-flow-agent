import { useEffect, useState } from "react";

import { api, ApiError } from "../../api/client";
import type {
  AttestationItem,
  AuditEvent,
  FinalizationStatus,
  LegalRequest,
  PackageValidationFinding,
} from "../../api/types";
import { humanizeToken } from "../../lib/requestDisplay";
import { useOptionalActor } from "../identity/ActorContext";
import { getActor, roleLabel } from "../identity/actorStore";
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

const ATTESTATION_LABELS: Record<AttestationItem, string> = {
  scope_verified: "Scope verified",
  identifiers_match: "IDs match",
  nondisclosure_reviewed: "NDA reviewed",
  sealed_handling_acknowledged: "Sealed ack",
  content_scope_confirmed: "Content scope",
  authority_scope_match_confirmed: "Authority checked",
  ongoing_collection_reviewed: "Ongoing reviewed",
  package_completeness_confirmed: "Package complete",
  certification_reviewed: "Certification reviewed",
};

const BLOCKER_LABELS: Record<string, string> = {
  authority_scope_match_confirmed: "Authority checked",
  authority_scope_missing: "Authority missing",
  missing_authority: "Missing authority",
  package_completeness_confirmed: "Package complete",
  package_validation_blocking: "Package validation",
  record_count_mismatch: "Record count mismatch",
  certification_reviewed: "Certification review",
  certification_incomplete: "Certification incomplete",
  ongoing_collection_reviewed: "Ongoing reviewed",
};

interface ActionResult {
  request: LegalRequest;
  notice?: string;
}

function blockerLabel(reason: string): string {
  if (reason.startsWith("missing_attestations:")) {
    const missing = reason
      .replace("missing_attestations:", "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => ATTESTATION_LABELS[item as AttestationItem] ?? blockerLabel(item));
    return `Missing attestations: ${missing.join(", ")}`;
  }
  if (reason.startsWith("blocked_agent_runs:")) {
    return `Blocked agents: ${reason.replace("blocked_agent_runs:", "").trim()}`;
  }
  return BLOCKER_LABELS[reason] ?? humanizeToken(reason);
}

function seniorStateLabel(status: FinalizationStatus): string {
  if (!status.requires_senior_approval) {
    return "Senior co-sign not required";
  }
  return status.senior_approval_present ? "Senior present" : "Senior missing";
}

function approvalStepLabel(status: FinalizationStatus): string {
  const nextApproval = Math.min(
    status.approvals_recorded + 1,
    status.approvals_required,
  );
  return `Approval ${nextApproval} of ${status.approvals_required}`;
}

function finalizeDisabledReasons(
  status: FinalizationStatus | null,
  busy: string | null,
  complete: boolean,
): string[] {
  if (busy !== null) {
    return ["Action in progress"];
  }
  if (complete) {
    return ["Request already finalized"];
  }
  if (!status) {
    return ["Checking approval readiness"];
  }
  if (status.ready_for_approval) {
    return [];
  }
  return status.blocking_reasons.length > 0
    ? status.blocking_reasons.map(blockerLabel)
    : ["Checklist or approval policy is incomplete"];
}

function approvalDisabledReasons(busy: string | null, complete: boolean): string[] {
  if (busy !== null) {
    return ["Action in progress"];
  }
  return complete ? ["Request already finalized"] : [];
}

function uniqueFindings(
  findings: PackageValidationFinding[],
): PackageValidationFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.code}:${finding.section}:${finding.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/** The human decision surface (plan §13 Human Review): the agent
 * recommendation as context, risk/review reasons, attestations, dual
 * control, and human-only actions. Every decision here is made by a person;
 * the panel exposes no agent-side approval. */
export default function ReviewPanel({
  request,
  auditEvents,
  onUpdated,
}: ReviewPanelProps) {
  const actorContext = useOptionalActor();
  const actor = actorContext?.actor ?? getActor();
  const [comments, setComments] = useState("");
  const [routeOverride, setRouteOverride] = useState(
    request.routing_recommendation?.target_queue ?? "",
  );
  const [finalizationStatus, setFinalizationStatus] =
    useState<FinalizationStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const classification = request.classification;
  const routing = request.routing_recommendation;
  const reviewReasons = classification?.review_reasons ?? [];
  const riskFlags = Object.values(request.agent_runs ?? {}).flatMap(
    (run) => run.risk_flags,
  );
  const scopeAuthorityChecks = request.scope_authority_checks ?? [];
  const packageValidationFindings = request.package_validation_findings ?? [];
  const authorityBlockers = scopeAuthorityChecks.filter(
    (check) => check.status === "missing_authority",
  );
  const packageBlockers = uniqueFindings([
    ...packageValidationFindings,
    ...(request.production_package?.validation_findings ?? []),
  ]).filter((finding) => finding.severity === "blocking");
  const trimmed = comments.trim();
  const attested = new Set(finalizationStatus?.attested ?? []);
  const readyForApproval = finalizationStatus?.ready_for_approval ?? false;
  const complete = request.workflow_state === "audit_complete";
  const routeApprovalDisabledReasons = approvalDisabledReasons(busy, complete);
  const finalizeReasons = finalizeDisabledReasons(
    finalizationStatus,
    busy,
    complete,
  );
  const routeApprovalDisabled = routeApprovalDisabledReasons.length > 0;
  const finalizeDisabled = finalizeReasons.length > 0;
  const primaryActionLabel = finalizeDisabled
    ? routeApprovalDisabled
      ? "Resolve review blockers"
      : "Approve route"
    : "Record approval";
  const checklistDone =
    finalizationStatus?.required_attestations.filter((item) => attested.has(item))
      .length ?? 0;
  const checklistTotal = finalizationStatus?.required_attestations.length ?? 0;

  useEffect(() => {
    setRouteOverride(request.routing_recommendation?.target_queue ?? "");
  }, [request.legal_request_id, request.routing_recommendation?.target_queue]);

  async function refreshFinalizationStatus() {
    try {
      setFinalizationStatus(await api.finalizationStatus(request.legal_request_id));
    } catch {
      setFinalizationStatus(null);
    }
  }

  useEffect(() => {
    void refreshFinalizationStatus();
  }, [
    request.legal_request_id,
    request.workflow_state,
    request.attestations?.length,
  ]);

  async function act(name: string, call: () => Promise<ActionResult>) {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      const result = await call();
      onUpdated(result.request);
      setComments("");
      setNotice(result.notice ?? `${name} recorded. Audit event logged.`);
      await refreshFinalizationStatus();
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

  return (
    <div className="cf-review">
      <Card title="Human review" subtitle="All decisions are made by a person">
        <div className="cf-review__hero">
          <div>
            <p className="cf-review__eyebrow">Current decision surface</p>
            <h3>{primaryActionLabel}</h3>
            <p>
              {readyForApproval
                ? "Checklist is ready for recorded human approval."
                : "Review the route, risk flags, and checklist before recording the next human action."}
            </p>
          </div>
          <StatusBadge status={request.workflow_state} />
        </div>
        <div className="cf-review__approval-state" aria-label="Active reviewer">
          <Chip tone={actor.role === "senior_analyst" ? "green" : "blue"} dot>
            {actor.label}
          </Chip>
          <Chip tone="neutral">Role: {roleLabel(actor.role)}</Chip>
          <Chip tone="violet">Synthetic / mock data</Chip>
        </div>

        {routing ? (
          <div className="cf-review__recommendation">
            <div className="cf-review__route-card">
              <span className="cf-review__eyebrow">Recommended route</span>
              <strong>{routing.target_queue ?? "pending"}</strong>
              {routing.reason ? <p>{routing.reason}</p> : null}
              <Chip tone="amber" dot>
                Pending review
              </Chip>
            </div>
            <div className="cf-review__inline-action">
              <input
                className="cf-input"
                value={routeOverride}
                aria-label="Override recommended route"
                onChange={(event) => setRouteOverride(event.target.value)}
              />
              <Button
                size="sm"
                variant="outlined"
                disabled={busy !== null || !routeOverride.trim()}
                onClick={() =>
                  act("Route override", async () => {
                    const response = await api.override(request.legal_request_id, {
                      target: "recommended_queue",
                      text_value: routeOverride.trim(),
                      reason: trimmed || "Reviewer corrected the recommended route.",
                    });
                    return {
                      request: response.legal_request,
                      notice: "Route override recorded. Audit event logged.",
                    };
                  })
                }
              >
                Apply
              </Button>
            </div>
          </div>
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

        {authorityBlockers.length > 0 || packageBlockers.length > 0 ? (
          <div className="cf-review__reasons">
            <h4 className="cf-fields__label">Quality blockers</h4>
            <ul className="cf-deficiency-list">
              {authorityBlockers.map((check) => (
                <li key={`authority-${check.category}`}>
                  <Chip tone="red" dot>
                    Authority
                  </Chip>{" "}
                  {check.message || humanizeToken(check.category)}
                </li>
              ))}
              {packageBlockers.map((finding) => {
                const section = finding.section.toLowerCase();
                const area =
                  section.includes("certification") ||
                  finding.code.includes("certification")
                    ? "Certification"
                    : "Package";
                return (
                  <li key={`package-${finding.code}-${finding.section}`}>
                    <Chip tone="red" dot>
                      {area}
                    </Chip>{" "}
                    {finding.message}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="cf-review__finalization">
          <div className="cf-review__section-heading">
            <h4 className="cf-fields__label">Finalization checklist</h4>
            {finalizationStatus ? (
              <Chip tone={readyForApproval ? "green" : "amber"} dot>
                {checklistDone}/{checklistTotal} attested
              </Chip>
            ) : null}
          </div>
          {finalizationStatus ? (
            <>
              <div className="cf-review__approval-state">
                <Chip tone={readyForApproval ? "green" : "amber"} dot>
                  {approvalStepLabel(finalizationStatus)}
                </Chip>
                {finalizationStatus.requires_senior_approval ? (
                  <Chip
                    tone={
                      finalizationStatus.senior_approval_present ? "green" : "amber"
                    }
                    dot
                  >
                    Senior co-sign required
                  </Chip>
                ) : null}
                <Chip
                  tone={
                    finalizationStatus.requires_senior_approval &&
                    !finalizationStatus.senior_approval_present
                      ? "amber"
                      : "green"
                  }
                  dot={finalizationStatus.requires_senior_approval}
                >
                  {seniorStateLabel(finalizationStatus)}
                </Chip>
              </div>
              <div className="cf-review__checklist">
                {finalizationStatus.required_attestations.map((item) => {
                  const done = attested.has(item);
                  return (
                    <div className="cf-review__check" key={item}>
                      <Chip tone={done ? "green" : "amber"} dot>
                        {ATTESTATION_LABELS[item]}
                      </Chip>
                      <Button
                        size="sm"
                        variant="outlined"
                        disabled={busy !== null || done || complete}
                        onClick={() =>
                          act(ATTESTATION_LABELS[item], async () => {
                            const response = await api.attest(
                              request.legal_request_id,
                              { item },
                            );
                            return {
                              request: response.legal_request,
                              notice: `${ATTESTATION_LABELS[item]} attested.`,
                            };
                          })
                        }
                      >
                        {done ? "Attested" : "Attest"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              {finalizationStatus.blocking_reasons.length > 0 ? (
                <ul
                  className="cf-review__blockers"
                  aria-label="Finalization blockers"
                >
                  {finalizationStatus.blocking_reasons.map((reason) => (
                    <li key={reason}>
                      <Chip tone="red" dot>
                        {blockerLabel(reason)}
                      </Chip>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="cf-fields__muted">Checking approval readiness...</p>
          )}
        </div>

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
            disabled={routeApprovalDisabled}
            onClick={() =>
              act("Route approval", async () => {
                const reviewed = await api.review(request.legal_request_id, {
                  action: "approve",
                  comments: trimmed || undefined,
                });
                return { request: reviewed.legal_request };
              })
            }
          >
            {busy === "Route approval" ? "Approving..." : "Approve route"}
          </Button>
          <Button
            variant="filled"
            disabled={finalizeDisabled}
            onClick={() =>
              act("Approval", async () => {
                const response = await api.approve(request.legal_request_id, {
                  comments: trimmed || undefined,
                });
                const finalNotice = response.awaiting_approval
                  ? `Approval ${response.approvals_recorded} of ${response.approvals_required} recorded. A senior reviewer must co-sign when required.`
                  : response.finalized
                    ? "Approval recorded. Audit event logged."
                    : "Approval recorded. Audit completion is still blocked.";
                return { request: response.legal_request, notice: finalNotice };
              })
            }
          >
            {busy === "Approval" ? "Recording..." : "Record approval"}
          </Button>
        </div>

        <div className="cf-review__supporting-actions">
          <Button
            disabled={busy !== null}
            onClick={() =>
              act("Change request", async () => {
                const response = await api.review(request.legal_request_id, {
                  action: "request_changes",
                  comments: trimmed || undefined,
                });
                return { request: response.legal_request };
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
                return { request: response.legal_request };
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
                return { request: response.legal_request };
              })
            }
          >
            Send to QA
          </Button>
        </div>
        {routeApprovalDisabledReasons.length > 0 || finalizeReasons.length > 0 ? (
          <ul className="cf-review__blockers" aria-label="Disabled action reasons">
            {routeApprovalDisabledReasons.map((reason) => (
              <li key={`route-${reason}`}>
                <Chip tone="amber" dot>
                  Approve route disabled
                </Chip>{" "}
                {reason}
              </li>
            ))}
            {finalizeReasons.map((reason) => (
              <li key={`finalize-${reason}`}>
                <Chip tone="amber" dot>
                  Approval recording disabled
                </Chip>{" "}
                {reason}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="cf-review__hint">
          Approving the route records your routing decision. Use agent redraft
          controls for blocked runs, then record approval once the checklist
          and approval policy pass.
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
