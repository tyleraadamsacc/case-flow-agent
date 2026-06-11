import type { WorkflowState } from "../../api/types";

const STEPS = [
  "Received",
  "Extracted",
  "Validated",
  "Agent drafts",
  "Analyst review",
  "Approved",
  "Audit complete",
] as const;

/** The furthest step a state has reached. Review-family states all sit
 * on "Analyst review": changes requested, escalation, and QA are loops
 * within the human decision, not separate progress. */
function stepIndex(state: WorkflowState): number {
  switch (state) {
    case "request_received":
      return 0;
    case "request_extracted":
    case "request_indexed":
    case "request_classified":
      return 1;
    case "request_validated":
      return 2;
    case "route_recommended":
    case "etl_simulated":
    case "note_drafted":
    case "response_package_drafted":
    case "deficiency_response_drafted":
      return 3;
    case "analyst_review_pending":
    case "changes_requested":
    case "escalated":
    case "sent_to_qa":
      return 4;
    case "analyst_approved":
      return 5;
    case "audit_complete":
      return 6;
    default:
      return 0;
  }
}

/** The request's journey on one line: done, current, upcoming. The
 * current step carries the same gradient signal the rail uses for a
 * running agent. "Approved" and everything after it are human steps by
 * construction — the indicator can only advance past "Analyst review"
 * through a recorded human decision. */
export default function WorkflowProgress({ state }: { state: WorkflowState }) {
  const current = stepIndex(state);
  return (
    <ol
      className="cf-flow"
      aria-label={`Workflow progress: step ${current + 1} of ${STEPS.length}, ${STEPS[current]}`}
    >
      {STEPS.map((label, index) => {
        const variant =
          index < current ? "done" : index === current ? "current" : "upcoming";
        return (
          <li
            key={label}
            className={`cf-flow__step cf-flow__step--${variant}`}
            aria-current={index === current ? "step" : undefined}
          >
            <span className="cf-flow__node" aria-hidden="true" />
            {label}
          </li>
        );
      })}
    </ol>
  );
}
