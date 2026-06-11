import type { LegalRequest } from "../../api/types";
import { statusMeta } from "../../theme/status";
import Chip from "../ui/Chip";
import StatusBadge from "../ui/StatusBadge";
import {
  buildWorkflowStorySummary,
  type WorkflowStorySummary,
} from "./workflowConsoleData";
import "./WorkflowConsole.css";

export interface WorkflowStoryHeaderProps {
  request?: LegalRequest;
  summary?: WorkflowStorySummary;
}

export default function WorkflowStoryHeader({
  request,
  summary = request ? buildWorkflowStorySummary(request) : undefined,
}: WorkflowStoryHeaderProps) {
  if (!summary) {
    return null;
  }

  const reviewTone = summary.reviewRequired ? "amber" : "green";
  const reviewLabel = summary.reviewRequired
    ? "Human review required"
    : "No open review flag";

  return (
    <header className="workflow-console-story">
      <div className="workflow-console-story__main">
        <div className="workflow-console-story__eyebrow">
          Request detail / six-agent workflow
        </div>
        <h1 className="workflow-console-story__title">{summary.requestId}</h1>
        <p className="workflow-console-story__subtitle">
          {summary.agency} request for {summary.process.toLowerCase()} across{" "}
          {summary.domains.join(", ")}.
        </p>
      </div>

      <div className="workflow-console-story__status">
        <StatusBadge
          status={request?.workflow_state ?? summary.workflowStateLabel}
          className="workflow-console-story__badge"
        />
        <Chip tone={reviewTone} dot>
          {reviewLabel}
        </Chip>
      </div>

      <dl className="workflow-console-story__facts">
        <div>
          <dt>Urgency</dt>
          <dd>{summary.urgency}</dd>
        </div>
        <div>
          <dt>Date range</dt>
          <dd>{summary.dateRange}</dd>
        </div>
        <div>
          <dt>Subjects</dt>
          <dd>{summary.subjectCount}</dd>
        </div>
        <div>
          <dt>Deficiencies</dt>
          <dd>{summary.deficiencyCount}</dd>
        </div>
      </dl>

      <div className="workflow-console-story__chips" aria-label="Risk context">
        {summary.specialHandling.length ? (
          summary.specialHandling.map((label) => (
            <Chip key={label} tone="amber" dot>
              {label}
            </Chip>
          ))
        ) : (
          <Chip tone="neutral">No special handling flag</Chip>
        )}
        {summary.riskFlags.slice(0, 3).map((flag) => (
          <Chip key={flag} tone="red" title={flag}>
            {flag}
          </Chip>
        ))}
      </div>
    </header>
  );
}

export function workflowStateLabel(status: string): string {
  return statusMeta(status).label;
}
