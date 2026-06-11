import type { AgentActivity } from "../../api/types";
import { AGENT_RAIL_ORDER, AGENT_THEME } from "../../theme/agentTheme";
import Card from "../ui/Card";
import Chip from "../ui/Chip";
import ConfidenceBar from "../ui/ConfidenceBar";
import { dataConfidenceLabel } from "./MetricBarList";

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
  const officialActivity = AGENT_RAIL_ORDER.map((agentId) => byId.get(agentId));
  const activeAgents = officialActivity.filter(
    (activity) => (activity?.runs_total ?? 0) > 0,
  ).length;
  const exceptions = officialActivity.reduce(
    (total, activity) =>
      total +
      (activity?.runs_blocked ?? 0) +
      (activity?.runs_failed ?? 0) +
      (activity?.runs_needs_review ?? 0),
    0,
  );
  const auditEvents = officialActivity.reduce(
    (total, activity) => total + (activity?.audit_events ?? 0),
    0,
  );
  const confidenceValues = officialActivity
    .map((activity) => activity?.average_confidence)
    .filter((value): value is number => typeof value === "number");
  const averageConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((total, value) => total + value, 0) /
        confidenceValues.length
      : null;

  return (
    <Card
      variant="insight"
      className="cf-agent-coverage"
      title="RFP Agent Coverage"
      subtitle="Official six-agent operating coverage, with exceptions surfaced before totals."
    >
      <div className="cf-agent-coverage__summary" aria-label="Agent coverage summary">
        <div>
          <span>{activeAgents}/6</span>
          <small>agents active</small>
        </div>
        <div>
          <span>{auditEvents}</span>
          <small>audit events</small>
        </div>
        <div>
          <span>{exceptions}</span>
          <small>exceptions</small>
        </div>
        <div>
          <span>
            {averageConfidence === null
              ? "N/A"
              : `${Math.round(averageConfidence * 100)}%`}
          </span>
          <small>avg confidence</small>
        </div>
      </div>
      <div className="cf-coverage-grid">
        {AGENT_RAIL_ORDER.map((agentId) => {
          const theme = AGENT_THEME[agentId];
          const activity = byId.get(agentId);
          const blocked = activity?.runs_blocked ?? 0;
          const needsReview = activity?.runs_needs_review ?? 0;
          const failed = activity?.runs_failed ?? 0;
          return (
            <div
              className="cf-coverage-card"
              key={agentId}
              style={{ borderTopColor: theme.accent }}
            >
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
              <div className="cf-coverage-card__confidence">
                <span>Confidence</span>
                <ConfidenceBar value={activity?.average_confidence ?? null} />
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
              <div className="cf-coverage-card__confidence-label">
                <Chip tone="violet" title="Data confidence">
                  {dataConfidenceLabel(
                    activity?.data_confidence ?? "unavailable",
                  )}
                </Chip>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
