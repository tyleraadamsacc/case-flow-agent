import type { AgentRun } from "../../api/types";
import Button from "../ui/Button";
import Chip from "../ui/Chip";
import {
  deriveDownstreamStaleMarkers,
  downstreamAgentIds,
  type DownstreamStaleMarker,
} from "./agentWorkflowUtils";

export interface StaleDependencyNoticeProps {
  changedAgentId: string;
  changedAt?: string | null;
  runs: AgentRun[] | Record<string, AgentRun>;
  dependencyReasons?: string[];
  markers?: DownstreamStaleMarker[];
  onRerunDownstream?: (agentIds: string[], instruction: string) => Promise<void> | void;
}

export default function StaleDependencyNotice({
  changedAgentId,
  changedAt,
  runs,
  dependencyReasons = [],
  markers,
  onRerunDownstream,
}: StaleDependencyNoticeProps) {
  const staleMarkers =
    markers ?? deriveDownstreamStaleMarkers(changedAgentId, runs, { changedAt });
  const staleAgents = staleMarkers.filter((marker) => marker.stale);
  const downstreamIds = downstreamAgentIds(changedAgentId);
  const hasDependencyReasons = dependencyReasons.length > 0;

  if (staleAgents.length === 0 && !hasDependencyReasons) {
    return null;
  }

  return (
    <dl className="cf-agent-card__details" aria-label="Downstream dependency status">
      {hasDependencyReasons ? (
        <div>
          <dt>Dependencies</dt>
          <dd className="cf-preview__row">
            {dependencyReasons.map((reason) => (
              <Chip tone="red" dot key={reason}>
                {reason}
              </Chip>
            ))}
          </dd>
        </div>
      ) : null}

      {staleAgents.length > 0 ? (
        <div>
          <dt>Stale downstream work</dt>
          <dd>
            <ul className="cf-deficiency-list">
              {staleAgents.map((marker) => (
                <li key={marker.agentId}>{marker.reason}</li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}

      {onRerunDownstream && downstreamIds.length > 0 ? (
        <div className="cf-agent-card__action-row">
          <Button
            size="sm"
            variant="outlined"
            onClick={() =>
              void onRerunDownstream(
                downstreamIds,
                "Refresh downstream agents after upstream human decision.",
              )
            }
          >
            Rerun downstream agents
          </Button>
        </div>
      ) : null}
    </dl>
  );
}
