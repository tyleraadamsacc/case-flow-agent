import { AGENT_RAIL_ORDER, AGENT_THEME } from "../../theme/agentTheme";
import AgentRunCard from "./AgentRunCard";
import type { AgentRunCardProps } from "./AgentRunCard";

/** An agent run as the rail consumes it — typically a backend AgentRun
 * record. Name, ordinal, and role come from the agent registry, not the
 * caller. */
export type AgentRunLike = Omit<
  AgentRunCardProps,
  "agentName" | "ordinal" | "roleDescription"
>;

export interface SixAgentWorkflowRailProps {
  runs?: AgentRunLike[];
  onOpenEvidence?: (evidenceIds: string[]) => void;
  onOpenAudit?: (auditEventId: string | null) => void;
}

/** The Six-Agent Workflow Rail — the product's hard requirement.
 *
 * Always renders all six RFP agents by official name in fixed order:
 * Indexing Agent → Triaging Agent → ETL Agent →
 * Note Taking and Data Entry Agent → Text Content Agent →
 * Automation Agent.
 *
 * An agent with no run yet renders as waiting — agents are never
 * omitted, and blocked runs stay visible with their reason. */
export default function SixAgentWorkflowRail({
  runs = [],
  onOpenEvidence,
  onOpenAudit,
}: SixAgentWorkflowRailProps) {
  return (
    // The wrapper is a size container: the rail picks 3x2, six-across,
    // or vertical from its own width (it renders beside a context panel
    // on Request Detail and full-width elsewhere).
    <div className="cf-rail-viewport">
      <ol className="cf-rail" aria-label="Six-Agent Workflow Rail">
        {AGENT_RAIL_ORDER.map((agentId) => {
          const theme = AGENT_THEME[agentId];
          const run = runs.find((candidate) => candidate.agentId === agentId);
          return (
            <li className="cf-rail__item" key={agentId}>
              <AgentRunCard
                {...(run ?? { agentId, status: "waiting" })}
                agentName={theme.officialName}
                ordinal={theme.ordinal}
                roleDescription={theme.roleDescription}
                onOpenEvidence={run?.onOpenEvidence ?? onOpenEvidence}
                onOpenAudit={run?.onOpenAudit ?? onOpenAudit}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
