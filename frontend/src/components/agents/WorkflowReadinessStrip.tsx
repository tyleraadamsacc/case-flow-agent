import type { AuditEvent, LegalRequest } from "../../api/types";
import Chip, { type ChipTone } from "../ui/Chip";
import {
  buildWorkflowReadinessSummary,
  type WorkflowReadinessItem,
  type WorkflowReadinessSummary,
} from "./workflowConsoleData";
import "./WorkflowConsole.css";

export interface WorkflowReadinessStripProps {
  request?: LegalRequest;
  auditEvents?: AuditEvent[];
  summary?: WorkflowReadinessSummary;
}

export default function WorkflowReadinessStrip({
  request,
  auditEvents = [],
  summary = request
    ? buildWorkflowReadinessSummary(request, auditEvents)
    : undefined,
}: WorkflowReadinessStripProps) {
  if (!summary) {
    return null;
  }

  return (
    <div className="workflow-console-readiness">
      <div className="workflow-console-readiness__summary">
        <div>
          <h2>Review readiness</h2>
          <p>
            Tracks agent coverage, audit events, package blockers, and human
            review records.
          </p>
        </div>
        <div className="workflow-console-readiness__counts">
          <Chip tone="green" dot>
            {summary.ready} ready
          </Chip>
          <Chip tone="amber" dot>
            {summary.attention} attention
          </Chip>
          <Chip tone="red" dot>
            {summary.blocked} blocked
          </Chip>
          <Chip tone="neutral" dot>
            {summary.pending} pending
          </Chip>
        </div>
      </div>

      <ul className="workflow-console-readiness__items">
        {summary.items.map((item) => (
          <ReadinessListItem item={item} key={item.id} />
        ))}
      </ul>
    </div>
  );
}

function ReadinessListItem({ item }: { item: WorkflowReadinessItem }) {
  return (
    <li
      className={`workflow-console-readiness__item workflow-console-readiness__item--${item.state}`}
    >
      <div className="workflow-console-readiness__item-title">
        <span aria-hidden="true" />
        <strong>{item.label}</strong>
      </div>
      <p>{item.detail}</p>
      <Chip tone={toneForState(item.state)}>{labelForState(item.state)}</Chip>
    </li>
  );
}

function toneForState(state: WorkflowReadinessItem["state"]): ChipTone {
  switch (state) {
    case "ready":
      return "green";
    case "attention":
      return "amber";
    case "blocked":
      return "red";
    case "pending":
      return "neutral";
  }
}

function labelForState(state: WorkflowReadinessItem["state"]): string {
  switch (state) {
    case "ready":
      return "Ready";
    case "attention":
      return "Needs attention";
    case "blocked":
      return "Blocked";
    case "pending":
      return "Pending";
  }
}
