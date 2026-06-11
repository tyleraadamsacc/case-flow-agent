import { useMemo } from "react";
import type { CSSProperties } from "react";

import type {
  AgentRun,
  AuditEvent,
  EvidenceReference,
  LegalRequest,
} from "../../api/types";
import { formatDateTime } from "../../lib/requestDisplay";
import Chip, { type ChipTone } from "../ui/Chip";
import {
  buildEvidenceAuditInspectorModel,
  type InspectorQuality,
  type SourceHighlightTarget,
} from "./evidenceAuditInspector";

export interface EvidenceAuditInspectorProps {
  request?: LegalRequest | null;
  runs?: AgentRun[] | Record<string, AgentRun> | null;
  currentAgentId?: string | null;
  auditEvents?: AuditEvent[];
  evidenceReferences?: EvidenceReference[] | Record<string, EvidenceReference | null>;
  onOpenEvidence?: (evidenceIds: string[]) => void;
  onOpenAudit?: (auditEventId: string | null) => void;
  onHighlightSource?: (target: SourceHighlightTarget) => void;
}

const QUALITY_TONE: Record<InspectorQuality, ChipTone> = {
  direct: "green",
  inferred: "blue",
  missing: "amber",
  conflicting: "red",
};

/** Read-only evidence/audit inspector for the workflow console. It groups
 * grounding by source family and labels whether each claim is directly
 * grounded, inferred from available metadata, missing, or conflicting. */
export default function EvidenceAuditInspector({
  request,
  runs,
  currentAgentId,
  auditEvents = [],
  evidenceReferences,
  onOpenEvidence,
  onOpenAudit,
  onHighlightSource,
}: EvidenceAuditInspectorProps) {
  const model = useMemo(
    () =>
      buildEvidenceAuditInspectorModel({
        request,
        runs,
        currentAgentId,
        auditEvents,
        evidenceReferences,
      }),
    [auditEvents, currentAgentId, evidenceReferences, request, runs],
  );

  return (
    <section
      className="cf-agent-inspector"
      aria-label="Evidence and audit inspector"
    >
      <header style={headerStyle}>
        <div>
          <h3 style={titleStyle}>Evidence and audit inspector</h3>
          <p style={hintStyle}>
            {model.currentAgent
              ? `${model.currentAgent.agent_name} grounding`
              : "All visible workflow grounding"}
          </p>
        </div>
        <div className="cf-preview__row" aria-label="Evidence quality counts">
          {(["direct", "inferred", "missing", "conflicting"] as const).map(
            (quality) => (
              <Chip
                key={quality}
                tone={QUALITY_TONE[quality]}
                dot={model.qualityCounts[quality] > 0}
              >
                {quality}: {model.qualityCounts[quality]}
              </Chip>
            ),
          )}
        </div>
      </header>

      <div style={gridStyle}>
        {model.groups.map((group) => (
          <section key={group.sourceType} style={panelStyle}>
            <h4 style={groupTitleStyle}>{group.label}</h4>
            <div className="cf-preview__row">
              {group.chips.map((chip) => {
                const canOpenEvidence =
                  chip.evidenceIds.length > 0 && Boolean(onOpenEvidence);
                const canOpenAudit =
                  Boolean(chip.auditEventId) && Boolean(onOpenAudit);
                const canHighlight =
                  Boolean(chip.sourceTarget) && Boolean(onHighlightSource);
                const onClick = canOpenEvidence
                  ? () => onOpenEvidence?.(chip.evidenceIds)
                  : canOpenAudit
                    ? () => onOpenAudit?.(chip.auditEventId ?? null)
                    : canHighlight && chip.sourceTarget
                      ? () => onHighlightSource?.(chip.sourceTarget)
                      : undefined;
                return (
                  <Chip
                    key={chip.id}
                    tone={QUALITY_TONE[chip.quality]}
                    dot
                    onClick={onClick}
                    title={chip.detail}
                  >
                    {chip.label} · {chip.quality}
                  </Chip>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section style={auditPanelStyle} aria-label="Audit groups">
        <h4 style={groupTitleStyle}>Audit grouping</h4>
        {model.auditGroups.length === 0 ? (
          <p style={emptyStyle}>No audit events available.</p>
        ) : (
          <div style={auditGridStyle}>
            {model.auditGroups.map((group) => (
              <article key={group.id} style={auditGroupStyle}>
                <div style={auditGroupHeaderStyle}>
                  <strong>{group.label}</strong>
                  <Chip tone="neutral">{group.events.length}</Chip>
                </div>
                <ul style={auditListStyle}>
                  {group.events.map((event) => (
                    <li key={event.audit_event_id} style={auditListItemStyle}>
                      <button
                        type="button"
                        className="cf-meta-link"
                        onClick={() => onOpenAudit?.(event.audit_event_id)}
                        disabled={!onOpenAudit}
                        title={event.summary}
                      >
                        {event.action}
                      </button>
                      <span style={auditTimeStyle}>
                        {formatDateTime(event.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
  alignItems: "flex-start",
  marginBottom: "1rem",
} satisfies CSSProperties;

const titleStyle = {
  margin: 0,
  fontSize: "1rem",
} satisfies CSSProperties;

const hintStyle = {
  margin: "0.25rem 0 0",
  color: "var(--text-secondary)",
  fontSize: "0.85rem",
} satisfies CSSProperties;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0.75rem",
} satisfies CSSProperties;

const panelStyle = {
  border: "1px solid var(--border-subtle)",
  borderRadius: "8px",
  padding: "0.75rem",
  background: "var(--surface)",
} satisfies CSSProperties;

const auditPanelStyle = {
  ...panelStyle,
  marginTop: "0.75rem",
} satisfies CSSProperties;

const groupTitleStyle = {
  margin: "0 0 0.5rem",
  fontSize: "0.8rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-muted)",
} satisfies CSSProperties;

const emptyStyle = {
  margin: 0,
  color: "var(--text-secondary)",
} satisfies CSSProperties;

const auditGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0.75rem",
} satisfies CSSProperties;

const auditGroupStyle = {
  border: "1px solid var(--border-subtle)",
  borderRadius: "8px",
  padding: "0.65rem",
} satisfies CSSProperties;

const auditGroupHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.5rem",
  alignItems: "center",
} satisfies CSSProperties;

const auditListStyle = {
  listStyle: "none",
  padding: 0,
  margin: "0.5rem 0 0",
} satisfies CSSProperties;

const auditListItemStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "0.5rem",
  alignItems: "center",
  padding: "0.25rem 0",
} satisfies CSSProperties;

const auditTimeStyle = {
  color: "var(--text-muted)",
  fontSize: "0.78rem",
} satisfies React.CSSProperties;
