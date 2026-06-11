import type { AgentActivity } from "../../api/types";
import { AGENT_RAIL_ORDER, AGENT_THEME } from "../../theme/agentTheme";
import Card from "../ui/Card";
import Chip from "../ui/Chip";
import ConfidenceBar from "../ui/ConfidenceBar";

/** RFP Agent Coverage — the mandatory governance module (plan §14).
 * Six agent-ops tiles in the rail's own 3x2 shape, always all six
 * agents by exact official name in rail order. An agent with no
 * activity renders as zeros, never disappears. Blocked and
 * needs-review counts surface as chips so exceptions read before
 * totals do. */
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
      subtitle="All six agents by official name: runs, exceptions, audit events, confidence"
    >
      <div className="cf-coverage-grid">
        {AGENT_RAIL_ORDER.map((agentId) => {
          const theme = AGENT_THEME[agentId];
          const activity = byId.get(agentId);
          const blocked = activity?.runs_blocked ?? 0;
          const needsReview = activity?.runs_needs_review ?? 0;
          const failed = activity?.runs_failed ?? 0;
          return (
            <div className="cf-coverage-card" key={agentId}>
              <div className="cf-coverage-card__head">
                <span
                  className="cf-agent-card__ordinal"
                  style={{ background: theme.accentSoft, color: theme.accent }}
                  aria-hidden="true"
                >
                  {theme.ordinal}
                </span>
                <span className="cf-coverage-card__name">
                  {theme.officialName}
                </span>
              </div>
              <dl className="cf-coverage-card__stats">
                <div>
                  <dt>Runs</dt>
                  <dd>{activity?.runs_total ?? 0}</dd>
                </div>
                <div>
                  <dt>Audit events</dt>
                  <dd>{activity?.audit_events ?? 0}</dd>
                </div>
                <div>
                  <dt>Requests</dt>
                  <dd>{activity?.requests_covered.length ?? 0}</dd>
                </div>
              </dl>
              <ConfidenceBar value={activity?.average_confidence ?? null} />
              {blocked > 0 || needsReview > 0 || failed > 0 ? (
                <div className="cf-coverage-card__flags">
                  {blocked > 0 ? (
                    <Chip tone="red" dot>
                      {blocked} blocked
                    </Chip>
                  ) : null}
                  {failed > 0 ? (
                    <Chip tone="red" dot>
                      {failed} failed
                    </Chip>
                  ) : null}
                  {needsReview > 0 ? (
                    <Chip tone="amber" dot>
                      {needsReview} need review
                    </Chip>
                  ) : null}
                </div>
              ) : (
                <div className="cf-coverage-card__flags">
                  <Chip tone="neutral">No exceptions</Chip>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
