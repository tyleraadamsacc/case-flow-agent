import type { AgentRun } from "../../api/types";
import { AGENT_RAIL_ORDER, AGENT_THEME } from "../../theme/agentTheme";

/** Compact six-agent strip for queue rows: one segment per agent in rail
 * order, colored by the latest run status. Agents without a run render
 * as waiting segments — the rail always reads as six, never collapsed
 * into an aggregate. Each segment names its agent for screen readers
 * and on hover. */
export default function MiniRail({
  runs,
}: {
  runs: Record<string, AgentRun>;
}) {
  const statuses = AGENT_RAIL_ORDER.map(
    (agentId) => runs[agentId]?.status ?? "waiting",
  );
  const complete = statuses.filter((status) => status === "complete").length;
  const blocked = statuses.filter(
    (status) => status === "blocked" || status === "failed",
  ).length;
  const summary =
    `Six-agent workflow: ${complete} of 6 complete` +
    (blocked > 0 ? `, ${blocked} blocked` : "");

  return (
    <span className="cf-minirail" role="img" aria-label={summary} title={summary}>
      {AGENT_RAIL_ORDER.map((agentId, index) => {
        const status = statuses[index];
        return (
          <span
            key={agentId}
            className={`cf-minirail__seg cf-minirail__seg--${status}`}
            title={`${AGENT_THEME[agentId].officialName}: ${status.replace("_", " ")}`}
          />
        );
      })}
    </span>
  );
}
