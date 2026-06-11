import type { AuditEvent, LegalRequest } from "../../api/types";
import { AGENT_RAIL_ORDER, AGENT_THEME, type AgentId } from "../../theme/agentTheme";
import Chip from "../ui/Chip";
import EvidenceLink from "../ui/EvidenceLink";
import StatusBadge from "../ui/StatusBadge";
import {
  buildWorkflowTimelineItems,
  type WorkflowTimelineItem,
} from "./workflowConsoleData";
import "./WorkflowConsole.css";

export interface WorkflowTimelineProps {
  request?: LegalRequest;
  auditEvents?: AuditEvent[];
  items?: WorkflowTimelineItem[];
  selectedAgentId?: AgentId | "all";
  onAgentChange?: (agentId: AgentId | "all") => void;
  onOpenEvidence?: (evidenceIds: string[]) => void;
}

export default function WorkflowTimeline({
  request,
  auditEvents = [],
  items = request ? buildWorkflowTimelineItems(request, auditEvents) : [],
  selectedAgentId = "all",
  onAgentChange,
  onOpenEvidence,
}: WorkflowTimelineProps) {
  const visibleItems =
    selectedAgentId === "all"
      ? items
      : items.filter((item) => item.agentId === selectedAgentId);

  return (
    <div className="workflow-console-timeline">
      <div className="workflow-console-timeline__header">
        <div>
          <h2>Audit timeline</h2>
          <p>Chronological actions with agent and human provenance.</p>
        </div>
        <Chip tone="violet" dot>
          Synthetic / mock data
        </Chip>
      </div>

      <div
        className="workflow-console-timeline__filters"
        aria-label="Filter audit timeline by agent"
      >
        <button
          type="button"
          className={filterClass(selectedAgentId === "all")}
          onClick={() => onAgentChange?.("all")}
        >
          All activity
        </button>
        {AGENT_RAIL_ORDER.map((agentId) => (
          <button
            type="button"
            className={filterClass(selectedAgentId === agentId)}
            key={agentId}
            onClick={() => onAgentChange?.(agentId)}
          >
            {AGENT_THEME[agentId].officialName}
          </button>
        ))}
      </div>

      {visibleItems.length ? (
        <ol className="workflow-console-timeline__list">
          {visibleItems.map((item) => (
            <li className="workflow-console-timeline__item" key={item.id}>
              <div className="workflow-console-timeline__marker" />
              <article className="workflow-console-timeline__card">
                <div className="workflow-console-timeline__meta">
                  <span>{item.timestamp}</span>
                  <span>{item.actorLabel}</span>
                </div>
                <div className="workflow-console-timeline__title-row">
                  <h3>{item.label}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <p>{item.summary || "Audit summary pending."}</p>
                <div className="workflow-console-timeline__links">
                  {item.confidence !== null ? (
                    <Chip tone="blue">
                      {Math.round(item.confidence * 100)}% confidence
                    </Chip>
                  ) : null}
                  {item.actorType === "agent" ? (
                    <Chip tone="cyan" dot>
                      Agent action
                    </Chip>
                  ) : null}
                  <EvidenceLink
                    evidenceIds={item.evidenceIds}
                    onOpen={onOpenEvidence}
                  />
                </div>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="workflow-console-timeline__empty">
          No audit entries match this filter yet.
        </p>
      )}
    </div>
  );
}

function filterClass(active: boolean): string {
  return [
    "workflow-console-timeline__filter",
    active ? "workflow-console-timeline__filter--active" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}
