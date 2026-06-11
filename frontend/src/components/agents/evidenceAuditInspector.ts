import type {
  AgentRun,
  AuditEvent,
  EvidenceReference,
  LegalRequest,
  SourceDocumentSection,
} from "../../api/types";
import {
  AGENT_RAIL_ORDER,
  AGENT_THEME,
  type AgentId,
} from "../../theme/agentTheme";
import { humanizeToken } from "../../lib/requestDisplay";

export type InspectorSourceType =
  | "sop"
  | "template"
  | "request_text"
  | "response_record"
  | "audit";

export type InspectorQuality =
  | "direct"
  | "inferred"
  | "missing"
  | "conflicting";

export interface SourceHighlightTarget {
  section_id: string;
  source_span: string | null;
  label?: string | null;
}

export interface InspectorEvidenceChip {
  id: string;
  label: string;
  detail: string;
  sourceType: InspectorSourceType;
  quality: InspectorQuality;
  evidenceIds: string[];
  auditEventId: string | null;
  sourceTarget: SourceHighlightTarget | null;
}

export interface InspectorEvidenceGroup {
  sourceType: InspectorSourceType;
  label: string;
  chips: InspectorEvidenceChip[];
}

export interface InspectorAuditGroup {
  id: string;
  label: string;
  events: AuditEvent[];
}

export interface EvidenceAuditInspectorModel {
  currentAgent: AgentRun | null;
  groups: InspectorEvidenceGroup[];
  auditGroups: InspectorAuditGroup[];
  qualityCounts: Record<InspectorQuality, number>;
}

export interface EvidenceAuditInspectorInput {
  request?: LegalRequest | null;
  runs?: AgentRun[] | Record<string, AgentRun> | null;
  currentAgentId?: string | null;
  auditEvents?: AuditEvent[];
  evidenceReferences?: EvidenceReference[] | Record<string, EvidenceReference | null>;
}

const SOURCE_GROUP_LABELS: Record<InspectorSourceType, string> = {
  sop: "SOP and rules",
  template: "Templates",
  request_text: "Request text",
  response_record: "Response records",
  audit: "Audit",
};

const SOURCE_GROUP_ORDER: InspectorSourceType[] = [
  "sop",
  "template",
  "request_text",
  "response_record",
  "audit",
];

export function buildEvidenceAuditInspectorModel({
  request,
  runs,
  currentAgentId,
  auditEvents = [],
  evidenceReferences,
}: EvidenceAuditInspectorInput): EvidenceAuditInspectorModel {
  const runList = normalizeRuns(runs ?? request?.agent_runs ?? []);
  const currentAgent =
    runList.find((run) => run.agent_id === currentAgentId) ??
    runList.find((run) => run.agent_run_id === currentAgentId) ??
    null;
  const referenceMap = normalizeReferences(evidenceReferences);
  const events = auditEvents.length > 0 ? auditEvents : inferAuditEvents(request);
  const scopedRuns = currentAgent ? [currentAgent] : runList;
  const chips: InspectorEvidenceChip[] = [];

  scopedRuns.forEach((run) => {
    if (run.evidence_ids.length === 0) {
      chips.push(missingChip(`missing-evidence-${run.agent_id}`, {
        label: `${agentLabel(run)} evidence`,
        detail: "This agent run did not provide evidence ids.",
        sourceType: "sop",
      }));
    } else {
      run.evidence_ids.forEach((evidenceId) => {
        chips.push(
          evidenceChip(evidenceId, {
            reference: referenceMap.get(evidenceId),
            detail: `${agentLabel(run)} output evidence`,
          }),
        );
      });
    }

    if (run.audit_event_id) {
      const event = events.find(
        (candidate) => candidate.audit_event_id === run.audit_event_id,
      );
      chips.push(
        auditChip(run.audit_event_id, {
          label: event ? humanizeToken(event.action) : "Agent audit event",
          detail: event?.summary ?? `${agentLabel(run)} recorded an audit event.`,
          quality: event ? "direct" : "inferred",
        }),
      );
    } else if (run.status !== "waiting") {
      chips.push(missingChip(`missing-audit-${run.agent_id}`, {
        label: `${agentLabel(run)} audit`,
        detail: "No audit event id is attached to this run.",
        sourceType: "audit",
      }));
    }
  });

  chips.push(...requestTextChips(request));
  chips.push(...responseRecordChips(request));
  chips.push(...auditEvidenceChips(events, referenceMap));
  chips.push(...conflictChips(chips, referenceMap));

  const groups = SOURCE_GROUP_ORDER.map((sourceType) => ({
    sourceType,
    label: SOURCE_GROUP_LABELS[sourceType],
    chips: dedupeChips(chips.filter((chip) => chip.sourceType === sourceType)),
  })).filter((group) => group.chips.length > 0);

  const qualityCounts = {
    direct: 0,
    inferred: 0,
    missing: 0,
    conflicting: 0,
  };
  groups.forEach((group) =>
    group.chips.forEach((chip) => {
      qualityCounts[chip.quality] += 1;
    }),
  );

  return {
    currentAgent,
    groups,
    auditGroups: groupAuditEvents(events),
    qualityCounts,
  };
}

function normalizeRuns(
  runs: AgentRun[] | Record<string, AgentRun>,
): AgentRun[] {
  return Array.isArray(runs) ? runs : Object.values(runs);
}

function normalizeReferences(
  references:
    | EvidenceReference[]
    | Record<string, EvidenceReference | null>
    | undefined,
): Map<string, EvidenceReference | null> {
  if (!references) {
    return new Map();
  }
  if (Array.isArray(references)) {
    return new Map(
      references.map((reference) => [reference.evidence_id, reference]),
    );
  }
  return new Map(Object.entries(references));
}

function evidenceChip(
  evidenceId: string,
  {
    reference,
    detail,
  }: { reference: EvidenceReference | null | undefined; detail: string },
): InspectorEvidenceChip {
  const sourceType = reference
    ? sourceTypeFromReference(reference.source_type)
    : sourceTypeFromEvidenceId(evidenceId);
  return {
    id: `evidence-${evidenceId}`,
    label: reference?.title ?? evidenceId,
    detail: reference?.snippet ?? detail,
    sourceType,
    quality: reference ? "direct" : "inferred",
    evidenceIds: [evidenceId],
    auditEventId: null,
    sourceTarget: null,
  };
}

function auditChip(
  auditEventId: string,
  {
    label,
    detail,
    quality,
  }: { label: string; detail: string; quality: InspectorQuality },
): InspectorEvidenceChip {
  return {
    id: `audit-${auditEventId}`,
    label,
    detail,
    sourceType: "audit",
    quality,
    evidenceIds: [],
    auditEventId,
    sourceTarget: null,
  };
}

function missingChip(
  id: string,
  {
    label,
    detail,
    sourceType,
  }: { label: string; detail: string; sourceType: InspectorSourceType },
): InspectorEvidenceChip {
  return {
    id,
    label,
    detail,
    sourceType,
    quality: "missing",
    evidenceIds: [],
    auditEventId: null,
    sourceTarget: null,
  };
}

function requestTextChips(
  request: LegalRequest | null | undefined,
): InspectorEvidenceChip[] {
  if (!request) {
    return [
      missingChip("missing-request", {
        label: "Request details",
        detail: "No request object was provided to the inspector.",
        sourceType: "request_text",
      }),
    ];
  }

  const chips: InspectorEvidenceChip[] = [];
  if (request.source_sections.length === 0 && !request.raw_source_text) {
    chips.push(
      missingChip("missing-source-text", {
        label: "Source document",
        detail: "No raw source text or source sections are available.",
        sourceType: "request_text",
      }),
    );
  } else {
    chips.push({
      id: "request-source-text",
      label: request.raw_source_uri ?? "Source document",
      detail: `${request.source_sections.length} section${
        request.source_sections.length === 1 ? "" : "s"
      } available for trace highlighting.`,
      sourceType: "request_text",
      quality: "direct",
      evidenceIds: [],
      auditEventId: null,
      sourceTarget: firstSectionTarget(request.source_sections),
    });
  }

  request.subject_identifiers.forEach((identifier) => {
    chips.push({
      id: `identifier-${identifier.type}-${identifier.value}`,
      label: `${humanizeToken(identifier.type)}: ${identifier.value}`,
      detail: identifier.source_span
        ? "Identifier has a source span in the request text."
        : "Identifier has no source span.",
      sourceType: "request_text",
      quality: identifier.source_span ? "direct" : "missing",
      evidenceIds: [],
      auditEventId: null,
      sourceTarget: sectionTargetForSpan(
        request.source_sections,
        identifier.source_span,
        identifier.value,
      ),
    });
  });

  request.legal_authorities.forEach((authority) => {
    chips.push({
      id: `authority-${authority.citation}`,
      label: authority.citation,
      detail:
        authority.description ??
        (authority.source_span
          ? "Authority citation has request-text grounding."
          : "Authority citation has no request-text grounding."),
      sourceType: "request_text",
      quality: authority.source_span ? "direct" : "missing",
      evidenceIds: [],
      auditEventId: null,
      sourceTarget: sectionTargetForSpan(
        request.source_sections,
        authority.source_span,
        authority.citation,
      ),
    });
  });

  request.deficiency_findings.forEach((finding) => {
    finding.evidence_ids.forEach((evidenceId) => {
      chips.push({
        id: `deficiency-${finding.code}-${evidenceId}`,
        label: finding.code,
        detail: finding.message,
        sourceType: "sop",
        quality: "direct",
        evidenceIds: [evidenceId],
        auditEventId: null,
        sourceTarget: null,
      });
    });
  });

  return chips;
}

function responseRecordChips(
  request: LegalRequest | null | undefined,
): InspectorEvidenceChip[] {
  if (!request?.production_package) {
    return [
      missingChip("missing-production-package", {
        label: "Production package",
        detail: "No response package draft is attached to this request.",
        sourceType: "response_record",
      }),
    ];
  }

  const packageDraft = request.production_package;
  const chips: InspectorEvidenceChip[] = [];
  if (packageDraft.records.length === 0) {
    chips.push(
      missingChip("missing-responsive-records", {
        label: "Responsive records",
        detail: "The package draft contains no responsive records.",
        sourceType: "response_record",
      }),
    );
  } else {
    chips.push({
      id: "responsive-record-count",
      label: `${packageDraft.records.length} responsive record${
        packageDraft.records.length === 1 ? "" : "s"
      }`,
      detail: "Record count comes from the response package payload.",
      sourceType: "response_record",
      quality: "direct",
      evidenceIds: [],
      auditEventId: null,
      sourceTarget: null,
    });
  }

  Object.entries(packageDraft.section_provenance).forEach(
    ([section, provenance]) => {
      chips.push({
        id: `section-provenance-${section}`,
        label: humanizeToken(section),
        detail: provenance || "Section provenance is empty.",
        sourceType: sourceTypeFromEvidenceId(provenance),
        quality: provenance ? "direct" : "missing",
        evidenceIds: provenance ? [provenance] : [],
        auditEventId: null,
        sourceTarget: null,
      });
    },
  );

  packageDraft.validation_findings.forEach((finding) => {
    chips.push({
      id: `package-finding-${finding.code}`,
      label: finding.code,
      detail: finding.message,
      sourceType: "audit",
      quality: finding.severity === "blocking" ? "conflicting" : "direct",
      evidenceIds: [],
      auditEventId: null,
      sourceTarget: null,
    });
  });

  return chips;
}

function auditEvidenceChips(
  events: AuditEvent[],
  referenceMap: Map<string, EvidenceReference | null>,
): InspectorEvidenceChip[] {
  if (events.length === 0) {
    return [
      missingChip("missing-audit-events", {
        label: "Audit timeline",
        detail: "No audit events were provided or inferred for this request.",
        sourceType: "audit",
      }),
    ];
  }

  return events.flatMap((event) => [
    auditChip(event.audit_event_id, {
      label: humanizeToken(event.action),
      detail: event.summary,
      quality: "direct",
    }),
    ...event.evidence_ids.map((evidenceId) =>
      evidenceChip(evidenceId, {
        reference: referenceMap.get(evidenceId),
        detail: `Evidence id referenced by audit event ${event.audit_event_id}.`,
      }),
    ),
  ]);
}

function conflictChips(
  chips: InspectorEvidenceChip[],
  referenceMap: Map<string, EvidenceReference | null>,
): InspectorEvidenceChip[] {
  const conflicts: InspectorEvidenceChip[] = [];
  referenceMap.forEach((reference, evidenceId) => {
    if (!reference) {
      return;
    }
    const inferred = sourceTypeFromEvidenceId(evidenceId);
    const referenced = sourceTypeFromReference(reference.source_type);
    if (inferred !== referenced) {
      conflicts.push({
        id: `conflict-${evidenceId}`,
        label: evidenceId,
        detail: `Reference type ${humanizeToken(
          reference.source_type,
        )} conflicts with the id pattern grouped as ${SOURCE_GROUP_LABELS[inferred]}.`,
        sourceType: "audit",
        quality: "conflicting",
        evidenceIds: [evidenceId],
        auditEventId: null,
        sourceTarget: null,
      });
    }
  });

  const auditActionById = new Map<string, string>();
  chips.forEach((chip) => {
    if (!chip.auditEventId) {
      return;
    }
    const previous = auditActionById.get(chip.auditEventId);
    if (previous && previous !== chip.label) {
      conflicts.push({
        id: `conflict-audit-${chip.auditEventId}`,
        label: chip.auditEventId,
        detail: `Audit id appears with both ${previous} and ${chip.label}.`,
        sourceType: "audit",
        quality: "conflicting",
        evidenceIds: [],
        auditEventId: chip.auditEventId,
        sourceTarget: null,
      });
    }
    auditActionById.set(chip.auditEventId, chip.label);
  });

  return conflicts;
}

function groupAuditEvents(events: AuditEvent[]): InspectorAuditGroup[] {
  const groups = new Map<string, InspectorAuditGroup>();
  events.forEach((event) => {
    const agentId = normalizeAgentId(event.actor_id);
    const key = agentId ?? event.actor_type;
    const label = agentId ? AGENT_THEME[agentId].officialName : humanizeToken(key);
    const group = groups.get(key) ?? { id: key, label, events: [] };
    group.events.push(event);
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => ({
    ...group,
    events: [...group.events].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp),
    ),
  }));
}

function sourceTypeFromReference(sourceType: string): InspectorSourceType {
  switch (sourceType) {
    case "response_template":
      return "template";
    case "record":
    case "mock_record":
      return "response_record";
    default:
      return "sop";
  }
}

function sourceTypeFromEvidenceId(evidenceId: string): InspectorSourceType {
  if (/^(TMPL|TPL|TEMPLATE)-/i.test(evidenceId)) {
    return "template";
  }
  if (/^(REC|RECORD|MOCK_RECORD|RR)-/i.test(evidenceId)) {
    return "response_record";
  }
  if (/^(AUDIT|EVT|EVENT)-/i.test(evidenceId)) {
    return "audit";
  }
  return "sop";
}

function firstSectionTarget(
  sections: SourceDocumentSection[],
): SourceHighlightTarget | null {
  const section = sections[0];
  if (!section) {
    return null;
  }
  return {
    section_id: section.section_id,
    source_span: section.text.slice(0, 80) || null,
    label: section.title,
  };
}

function sectionTargetForSpan(
  sections: SourceDocumentSection[],
  sourceSpan: string | null | undefined,
  label: string,
): SourceHighlightTarget | null {
  if (!sourceSpan) {
    return null;
  }
  const section =
    sections.find((candidate) => candidate.text.includes(sourceSpan)) ??
    sections[0];
  if (!section) {
    return null;
  }
  return {
    section_id: section.section_id,
    source_span: sourceSpan,
    label,
  };
}

function inferAuditEvents(request: LegalRequest | null | undefined): AuditEvent[] {
  if (!request) {
    return [];
  }
  const events: AuditEvent[] = [];
  Object.values(request.agent_runs).forEach((run) => {
    if (!run.audit_event_id) {
      return;
    }
    events.push({
      audit_event_id: run.audit_event_id,
      legal_request_id: request.legal_request_id,
      timestamp: run.completed_at ?? run.started_at ?? "",
      actor_type: "agent",
      actor_id: run.agent_id,
      action: run.validation_status || run.status,
      before_state: null,
      after_state: request.workflow_state,
      summary: run.output_summary || run.rationale || "Agent run audited.",
      evidence_ids: run.evidence_ids,
      confidence: run.confidence,
      approval_id: null,
      correlation_id: run.agent_run_id,
    });
  });
  return events;
}

function dedupeChips(chips: InspectorEvidenceChip[]): InspectorEvidenceChip[] {
  const seen = new Set<string>();
  return chips.filter((chip) => {
    if (seen.has(chip.id)) {
      return false;
    }
    seen.add(chip.id);
    return true;
  });
}

function agentLabel(run: AgentRun): string {
  const agentId = normalizeAgentId(run.agent_id) as AgentId | null;
  return agentId ? AGENT_THEME[agentId].officialName : run.agent_name;
}

function normalizeAgentId(value: string | null | undefined): AgentId | null {
  if (!value) {
    return null;
  }
  return AGENT_RAIL_ORDER.includes(value as AgentId) ? (value as AgentId) : null;
}
