import { useState } from "react";
import type { ReactNode } from "react";

import { api, ApiError } from "../../api/client";
import type { LegalRequest, ScopeAuthorityCheck } from "../../api/types";
import {
  formatDate,
  humanizeToken,
  specialHandlingBadges,
} from "../../lib/requestDisplay";
import Card from "../ui/Card";
import Chip from "../ui/Chip";
import Button from "../ui/Button";
import type { SourceTraceTarget } from "./SourceDocumentPanel";

type ResolveTraceTarget = (
  sourceSpan: string | null | undefined,
  fallbackTerms?: string[],
) => SourceTraceTarget | null;

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cf-fields__group">
      <h4 className="cf-fields__label">{label}</h4>
      <div className="cf-fields__value">{children}</div>
    </div>
  );
}

const AUTHORITY_STATUS_LABELS: Record<ScopeAuthorityCheck["status"], string> = {
  covered: "Covered",
  needs_review: "Needs review",
  missing_authority: "Missing authority",
};

function authorityTone(status: ScopeAuthorityCheck["status"]) {
  switch (status) {
    case "covered":
      return "green" as const;
    case "needs_review":
      return "amber" as const;
    case "missing_authority":
      return "red" as const;
  }
}

function formatOngoingCadence(minutes: number): string {
  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minutes`;
}

function specialHandlingKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function deficiencyTraceTerms(code: string): string[] {
  switch (code) {
    case "missing_date_range":
    case "invalid_date_range":
      return ["following time period", "between the dates", "date range"];
    case "missing_identifier":
      return ["following account", "subject account", "account"];
    case "overbroad_scope":
      return ["following records", "all data", "all records"];
    case "ambiguous_request_type":
      return ["affidavit", "search warrant", "court order", "subpoena"];
    case "unresolved_template_placeholder":
      return ["please delete", "your name here", "date of interest"];
    case "scope_authority_mismatch":
      return ["18 U.S.C.", "legal authority", "pursuant"];
    default:
      return [code];
  }
}

/** Structured extraction view (plan §13 Extracted Fields panel): legal
 * process, identifiers, data categories, period validity, special
 * handling, authorities, and deficiencies. Empty before extraction runs. */
export default function ExtractedFieldsPanel({
  request,
  onUpdated,
  onTraceTarget,
  resolveTraceTarget,
}: {
  request: LegalRequest;
  onUpdated?: (request: LegalRequest) => void;
  onTraceTarget?: (target: SourceTraceTarget) => void;
  resolveTraceTarget?: ResolveTraceTarget;
}) {
  const extracted = request.workflow_state !== "request_received";
  const badges = specialHandlingBadges(request.special_handling);
  const period = request.requested_period;
  const processComponents = request.legal_process?.components ?? [];
  const subjectIdentifiers = request.subject_identifiers ?? [];
  const requestedDataCategories = request.requested_data_categories ?? [];
  const legalAuthorities = request.legal_authorities ?? [];
  const scopeAuthorityChecks = request.scope_authority_checks ?? [];
  const deficiencyFindings = request.deficiency_findings ?? [];
  const [periodStart, setPeriodStart] = useState(
    period?.start ? period.start.slice(0, 10) : "",
  );
  const [periodEnd, setPeriodEnd] = useState(
    period?.end ? period.end.slice(0, 10) : "",
  );
  const [processType, setProcessType] = useState(request.legal_process?.type ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function trace(
    sourceSpan: string | null | undefined,
    fallbackTerms: string[] = [],
  ): SourceTraceTarget | null {
    return resolveTraceTarget?.(sourceSpan, fallbackTerms) ?? null;
  }

  function traceClick(
    sourceSpan: string | null | undefined,
    fallbackTerms: string[] = [],
  ) {
    const target = trace(sourceSpan, fallbackTerms);
    return target && onTraceTarget ? () => onTraceTarget(target) : undefined;
  }

  function traceTitle(target: SourceTraceTarget | null): string | undefined {
    return target
      ? `Show source: ${target.label ?? target.section_id}`
      : "No source evidence available";
  }

  const specialHandlingTerms: Record<string, string[]> = {
    sealed: ["sealed"],
    non_disclosure: ["not disclose", "non-disclosure", "subscriber"],
    no_adverse_action: ["no adverse action"],
    pen_register: ["pen register"],
    trap_and_trace: ["trap and trace"],
    ongoing_access: ["ongoing access", "once every", "daily"],
    location_tracking: ["location", "gps", "sensorvault"],
    content: ["contents", "emails", "attachments"],
    tombstone: ["tombstone"],
  };

  if (!extracted) {
    return (
      <Card title="Extracted fields" subtitle="Pending extraction">
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Run “Extract request” to parse the source document into structured
          fields.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Extracted fields" subtitle="Parsed from the source document">
      <div className="cf-fields">
        <Group label="Legal process">
          <Chip tone="blue">
            {request.legal_process
              ? humanizeToken(request.legal_process.type)
              : "Unknown"}
          </Chip>
          {request.legal_process?.court_order_included ? (
            <Chip tone="neutral">Court order included</Chip>
          ) : null}
          {processComponents.length > 1
            ? processComponents.map((component) => (
                <Chip
                  key={component}
                  tone="cyan"
                  title="Legal process component"
                >
                  {humanizeToken(component)}
                </Chip>
              ))
            : null}
          {onUpdated ? (
            <div className="cf-inline-edit">
              <select
                className="cf-input"
                value={processType}
                aria-label="Override legal process type"
                onChange={(event) => setProcessType(event.target.value)}
              >
                <option value="">Select type</option>
                <option value="search_warrant">Search warrant</option>
                <option value="ex_parte_order">Ex parte order</option>
                <option value="subpoena">Subpoena</option>
                <option value="court_order">Court order</option>
                <option value="pen_register">Pen register</option>
                <option value="trap_and_trace">Trap and trace</option>
                <option value="legal_process_request">Legal process request</option>
                <option value="unknown">Unknown</option>
              </select>
              <Button
                size="sm"
                variant="outlined"
                disabled={busy !== null || !processType}
                onClick={() =>
                  void applyOverride("process", {
                    target: "legal_process_type",
                    text_value: processType,
                    reason: "Reviewer corrected the legal-process type.",
                  })
                }
              >
                Apply
              </Button>
            </div>
          ) : null}
        </Group>

        <Group label="Requesting agency">
          {request.requesting_agency?.agency ?? "Not extracted"}
          {request.requesting_agency?.case_number ? (
            <span className="cf-fields__muted">
              {" "}
              · case {request.requesting_agency.case_number}
            </span>
          ) : null}
          {request.requesting_agency?.officer ? (
            <span className="cf-fields__muted">
              {" "}
              · {request.requesting_agency.officer}
            </span>
          ) : null}
        </Group>

        <Group label="Subject identifiers">
          {subjectIdentifiers.length === 0 ? (
            <Chip tone="red" dot>
              No identifiers extracted
            </Chip>
          ) : (
            subjectIdentifiers.map((identifier) => {
              const target = trace(identifier.source_span, [identifier.value]);
              return (
                <Chip
                  key={`${identifier.type}-${identifier.value}`}
                  tone="neutral"
                  onClick={traceClick(identifier.source_span, [identifier.value])}
                  title={traceTitle(target)}
                >
                  {humanizeToken(identifier.type)}: {identifier.value}
                </Chip>
              );
            })
          )}
        </Group>

        <Group label="Requested data categories">
          {requestedDataCategories.length === 0
            ? "None extracted"
            : requestedDataCategories.map((category) => {
                const terms = [
                  category.category,
                  category.product_domain,
                  category.content_type ?? "",
                ];
                const target = trace(null, terms);
                return (
                  <Chip
                    key={category.category}
                    tone={category.requires_sme_review ? "amber" : "cyan"}
                    onClick={traceClick(null, terms)}
                    title={target ? traceTitle(target) : `Domain: ${category.product_domain}`}
                  >
                    {humanizeToken(category.category)}
                  </Chip>
                );
              })}
        </Group>

        <Group label="Requested period">
          {period ? (
            <Chip
              tone={period.valid ? "neutral" : "red"}
              onClick={traceClick(null, [
                "following time period",
                "between the dates",
                period.start?.slice(0, 10) ?? "",
                period.end?.slice(0, 10) ?? "",
              ])}
              title={traceTitle(
                trace(null, [
                  "following time period",
                  "between the dates",
                  period.start?.slice(0, 10) ?? "",
                  period.end?.slice(0, 10) ?? "",
                ]),
              )}
            >
              {formatDate(period.start)} → {formatDate(period.end)}{" "}
              {period.valid
                ? "Valid"
                : `Invalid${period.issues.length ? `: ${period.issues[0]}` : ""}`}
            </Chip>
          ) : (
            <Chip tone="red" dot>
              Missing date range
            </Chip>
          )}
          {onUpdated ? (
            <div className="cf-inline-edit">
              <input
                className="cf-input"
                type="date"
                aria-label="Override requested period start"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
              <input
                className="cf-input"
                type="date"
                aria-label="Override requested period end"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
              />
              <Button
                size="sm"
                variant="outlined"
                disabled={busy !== null || !periodStart || !periodEnd}
                onClick={() =>
                  void applyOverride("period", {
                    target: "requested_period",
                    period_start: periodStart,
                    period_end: periodEnd,
                    reason: "Reviewer corrected the requested period.",
                  })
                }
              >
                Apply
              </Button>
            </div>
          ) : null}
        </Group>

        <Group label="Special handling">
          {badges.length === 0
            ? "None"
            : badges.map((badge) => {
                const flag = specialHandlingKey(badge);
                const terms = specialHandlingTerms[flag] ?? [badge];
                const target = trace(null, terms);
                return (
                  <Chip
                    key={badge}
                    tone="violet"
                    dot
                    onClick={traceClick(null, terms)}
                    title={traceTitle(target)}
                  >
                    {badge}
                  </Chip>
                );
              })}
          {request.special_handling.production_deadline_days ? (
            <Chip
              tone="neutral"
              onClick={traceClick(null, ["produce", "production deadline"])}
              title={traceTitle(trace(null, ["produce", "production deadline"]))}
            >
              {request.special_handling.production_deadline_days}-day production
              deadline
            </Chip>
          ) : null}
          {request.special_handling.ongoing_duration_days != null ? (
            <Chip tone="neutral">
              Ongoing duration: {request.special_handling.ongoing_duration_days}{" "}
              day
              {request.special_handling.ongoing_duration_days === 1 ? "" : "s"}
            </Chip>
          ) : null}
          {request.special_handling.ongoing_update_interval_minutes != null ? (
            <Chip tone="neutral">
              Updates every{" "}
              {formatOngoingCadence(
                request.special_handling.ongoing_update_interval_minutes,
              )}
            </Chip>
          ) : null}
        </Group>

        <Group label="Legal authorities">
          {legalAuthorities.length === 0
            ? "None cited"
            : legalAuthorities.map((authority) => {
                const target = trace(authority.source_span, [authority.citation]);
                return (
                  <Chip
                    key={authority.citation}
                    tone="neutral"
                    onClick={traceClick(authority.source_span, [authority.citation])}
                    title={
                      target
                        ? traceTitle(target)
                        : authority.description ?? "No source evidence available"
                    }
                  >
                    {authority.citation}
                  </Chip>
                );
              })}
        </Group>

        {scopeAuthorityChecks.length > 0 ? (
          <Group label="Scope authority checks">
            <ul className="cf-deficiency-list">
              {scopeAuthorityChecks.map((check) => (
                <li key={`${check.category}-${check.status}`}>
                  <Chip
                    tone={authorityTone(check.status)}
                    dot
                    onClick={traceClick(null, [
                      check.category,
                      ...check.matched_citations,
                      ...check.required_citations,
                    ])}
                    title={traceTitle(
                      trace(null, [
                        check.category,
                        ...check.matched_citations,
                        ...check.required_citations,
                      ]),
                    )}
                  >
                    {AUTHORITY_STATUS_LABELS[check.status]}
                  </Chip>{" "}
                  <strong>{humanizeToken(check.category)}</strong>
                  {check.message ? (
                    <span className="cf-fields__muted"> · {check.message}</span>
                  ) : null}
                  {check.required_citations.length > 0 ? (
                    <span className="cf-fields__muted">
                      {" "}
                      Required: {check.required_citations.join(", ")}
                    </span>
                  ) : null}
                  {check.matched_citations.length > 0 ? (
                    <span className="cf-fields__muted">
                      {" "}
                      Matched: {check.matched_citations.join(", ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Group>
        ) : null}

        {deficiencyFindings.length > 0 ? (
          <Group label="Deficiencies">
            <ul className="cf-deficiency-list">
              {deficiencyFindings.map((finding) => (
                <li key={finding.code}>
                  <Chip
                    tone={finding.severity === "blocking" ? "red" : "amber"}
                    dot
                    onClick={traceClick(null, deficiencyTraceTerms(finding.code))}
                    title={traceTitle(trace(null, deficiencyTraceTerms(finding.code)))}
                  >
                    {humanizeToken(finding.severity)}
                  </Chip>{" "}
                  {finding.message}
                  {finding.suggested_resolution ? (
                    <span className="cf-fields__muted">
                      {" "}
                      Suggested: {finding.suggested_resolution}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Group>
        ) : null}
        {message ? <p className="cf-review__notice">{message}</p> : null}
      </div>
    </Card>
  );

  async function applyOverride(
    name: string,
    body: Parameters<typeof api.override>[1],
  ) {
    if (!onUpdated) {
      return;
    }
    setBusy(name);
    setMessage(null);
    try {
      const response = await api.override(request.legal_request_id, body);
      onUpdated(response.legal_request);
      setMessage("Override recorded. Audit event logged.");
    } catch (cause) {
      const detail =
        cause instanceof ApiError
          ? typeof cause.detail === "string"
            ? cause.detail
            : JSON.stringify(cause.detail)
          : (cause as Error).message;
      setMessage(`Override refused: ${detail}`);
    } finally {
      setBusy(null);
    }
  }
}
