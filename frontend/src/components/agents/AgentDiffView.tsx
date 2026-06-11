import Chip from "../ui/Chip";
import {
  simplePreviousCurrentDiff,
  type PreviousCurrentDiff,
} from "./agentWorkflowUtils";

export interface AgentDiffViewProps {
  previous: unknown;
  current: unknown;
  diffs?: PreviousCurrentDiff[];
  title?: string;
  emptyLabel?: string;
  maxRows?: number;
}

export default function AgentDiffView({
  previous,
  current,
  diffs,
  title = "Previous / current diff",
  emptyLabel = "No previous/current changes available",
  maxRows = 12,
}: AgentDiffViewProps) {
  const rows = (diffs ?? simplePreviousCurrentDiff(previous, current)).slice(0, maxRows);

  return (
    <dl className="cf-agent-card__details" aria-label={title}>
      <div>
        <dt>{title}</dt>
        <dd>
          {rows.length === 0 ? (
            <span className="cf-muted">{emptyLabel}</span>
          ) : (
            <table className="cf-table">
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Change</th>
                  <th scope="col">Previous</th>
                  <th scope="col">Current</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((diff) => (
                  <tr key={`${diff.kind}:${diff.path}`}>
                    <th scope="row">{diff.path}</th>
                    <td>
                      <Chip tone={diffTone(diff.kind)}>{diff.kind}</Chip>
                    </td>
                    <td>{diff.previous}</td>
                    <td>{diff.current}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </dd>
      </div>
    </dl>
  );
}

function diffTone(kind: PreviousCurrentDiff["kind"]) {
  if (kind === "added") {
    return "green";
  }
  if (kind === "removed") {
    return "red";
  }
  return "amber";
}
