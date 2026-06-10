import type { AgentActivity } from "../../api/types";
import { AGENT_RAIL_ORDER, AGENT_THEME } from "../../theme/agentTheme";
import Card from "../ui/Card";
import Chip from "../ui/Chip";
import ConfidenceBar from "../ui/ConfidenceBar";

/** RFP Agent Coverage — the mandatory governance module (plan §14).
 * Always lists all six agents by exact official name in rail order,
 * even if the backend response is missing one: an agent with no
 * activity renders as zeros, never disappears. */
export default function AgentCoverageModule({
  agents,
}: {
  agents: AgentActivity[];
}) {
  const byId = new Map(agents.map((agent) => [agent.agent_id, agent]));

  return (
    <Card
      variant="insight"
      title="RFP Agent Coverage"
      subtitle="All six agents, by official name — runs, blocked runs, audit events, confidence"
    >
      <div className="cf-coverage">
        <div className="cf-coverage__row cf-coverage__row--head" aria-hidden="true">
          <span>Agent</span>
          <span>Runs</span>
          <span>Blocked</span>
          <span>Needs review</span>
          <span>Audit events</span>
          <span>Avg confidence</span>
          <span>Requests</span>
        </div>
        {AGENT_RAIL_ORDER.map((agentId) => {
          const theme = AGENT_THEME[agentId];
          const activity = byId.get(agentId);
          return (
            <div className="cf-coverage__row" key={agentId}>
              <span className="cf-coverage__agent">
                <span
                  className="cf-agent-card__ordinal"
                  style={{ background: theme.accentSoft, color: theme.accent }}
                  aria-hidden="true"
                >
                  {theme.ordinal}
                </span>
                {theme.officialName}
              </span>
              <span data-label="Runs">{activity?.runs_total ?? 0}</span>
              <span data-label="Blocked">
                {activity && activity.runs_blocked > 0 ? (
                  <Chip tone="red" dot>
                    {activity.runs_blocked}
                  </Chip>
                ) : (
                  0
                )}
              </span>
              <span data-label="Needs review">
                {activity && activity.runs_needs_review > 0 ? (
                  <Chip tone="amber" dot>
                    {activity.runs_needs_review}
                  </Chip>
                ) : (
                  0
                )}
              </span>
              <span data-label="Audit events">{activity?.audit_events ?? 0}</span>
              <span data-label="Avg confidence">
                <ConfidenceBar value={activity?.average_confidence ?? null} />
              </span>
              <span data-label="Requests">
                {activity?.requests_covered.length ?? 0}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
