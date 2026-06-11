import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { governanceApi } from "../api/client";
import type {
  AgentActivity,
  AuditReadinessReport,
  GovernanceMetric,
} from "../api/types";
import AgentCoverageModule from "../components/governance/AgentCoverageModule";
import MetricBarList, { metricLabel } from "../components/governance/MetricBarList";
import MetricCard from "../components/governance/MetricCard";
import ConsoleShell from "../components/layout/ConsoleShell";
import Card from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import EvidenceLink from "../components/ui/EvidenceLink";

interface GovernanceData {
  summary: GovernanceMetric[];
  agents: AgentActivity[];
  productVolume: GovernanceMetric[];
  processingTime: GovernanceMetric[];
  bottlenecks: GovernanceMetric[];
  packageStatus: GovernanceMetric[];
  auditReadiness: AuditReadinessReport;
  attentionCount: number;
}

/** Governance & Insights — the landing screen (plan §13): executive
 * metric strip, the mandatory RFP Agent Coverage module, volume and
 * time views, response package status, and audit readiness. Every
 * metric carries its data-confidence label. Read-only: governance
 * observes the workflow, it never drives it. */
export default function GovernanceInsightsPage() {
  const [data, setData] = useState<GovernanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      governanceApi.summary(),
      governanceApi.agentActivity(),
      governanceApi.productVolume(),
      governanceApi.processingTimeByProduct(),
      governanceApi.bottlenecks(),
      governanceApi.responsePackageStatus(),
      governanceApi.auditReadiness(),
      governanceApi.workNeedingAttention(),
    ])
      .then(
        ([
          summary,
          agents,
          productVolume,
          processingTime,
          bottlenecks,
          packageStatus,
          auditReadiness,
          attention,
        ]) =>
          setData({
            summary: summary.metrics,
            agents: agents.agents,
            productVolume: productVolume.metrics,
            processingTime: processingTime.metrics,
            bottlenecks: bottlenecks.metrics,
            packageStatus: packageStatus.metrics,
            auditReadiness,
            attentionCount: attention.items.length,
          }),
      )
      .catch((cause: Error) => setError(cause.message));
  }, []);

  const topDomain = data
    ? [...data.productVolume].sort((a, b) => b.value - a.value)[0]
    : undefined;

  return (
    <ConsoleShell title="Governance & Insights">
      <div className="cf-page-header">
        <h1>Governance & Insights</h1>
        <p>
          Executive view of the human-led workflow: volume, timing, agent
          coverage, and audit readiness. All figures are synthetic and labeled
          with their data confidence.
        </p>
      </div>

      {error ? (
        <Card variant="soft">
          <p style={{ margin: 0, color: "var(--red)" }}>
            Could not load governance data: {error}. Is the backend running
            (`make dev-backend`)?
          </p>
        </Card>
      ) : null}

      {!data && !error ? (
        <div
          className="cf-skeleton"
          role="status"
          aria-label="Loading governance data"
        >
          <div className="cf-skeleton__row cf-skeleton__row--short" />
          <div className="cf-skeleton__row" />
          <div className="cf-skeleton__row" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="cf-metric-strip">
            {data.summary.map((metric) => (
              <MetricCard key={metric.metric_id} metric={metric} />
            ))}
            <Card className="cf-metric" title="Work needing attention">
              <span
                className="cf-metric__value"
                style={
                  data.attentionCount > 0 ? { color: "var(--red)" } : undefined
                }
              >
                {data.attentionCount}
              </span>
              <p className="cf-metric__caption">
                {data.attentionCount > 0
                  ? "Human decisions waiting"
                  : "Nothing waiting on a human"}
              </p>
              <div className="cf-preview__row">
                <Link to="/attention">Open the attention list</Link>
              </div>
            </Card>
          </div>

          <div className="cf-detail-section">
            <AgentCoverageModule agents={data.agents} />
          </div>

          {topDomain && topDomain.value > 0 ? (
            <div className="cf-detail-section">
              <Card
                variant="insight"
                title={`${metricLabel(topDomain)} leads request volume`}
                subtitle="Deterministic insight from synthetic metrics, pending human interpretation"
              >
                <p style={{ margin: "0 0 var(--space-3)", color: "var(--text-secondary)" }}>
                  {metricLabel(topDomain)} accounts for {topDomain.value} of the
                  classified requests in this synthetic dataset. Consider
                  reviewing queue staffing for this domain.
                </p>
                <div className="cf-preview__row">
                  <EvidenceLink evidenceIds={[topDomain.metric_id]} />
                  <Chip tone="violet">{topDomain.data_confidence}</Chip>
                </div>
              </Card>
            </div>
          ) : null}

          <div className="cf-governance-grid">
            <MetricBarList
              title="Product / domain volume"
              subtitle="Classified requests by product domain"
              metrics={data.productVolume}
            />
            <MetricBarList
              title="Processing time by product"
              subtitle="Synthetic timing from audit timestamps"
              metrics={data.processingTime}
              unit="h"
            />
            <MetricBarList
              title="Bottlenecks"
              subtitle="Slowest workflow states by dwell time"
              metrics={data.bottlenecks}
              unit="h"
            />
            <MetricBarList
              title="Response package status"
              subtitle="Draft / pending / approved counts"
              metrics={data.packageStatus}
            />
          </div>

          <div className="cf-detail-section">
            <Card
              title="Audit readiness"
              subtitle="Coverage of required audit events per request path"
            >
              <div className="cf-preview__row" style={{ marginBottom: "var(--space-3)" }}>
                <span className="cf-metric__value">
                  {data.auditReadiness.coverage_percent.toFixed(0)}%
                </span>
                <Chip tone="neutral">
                  {data.auditReadiness.requests_with_all_required_events} of{" "}
                  {data.auditReadiness.requests_total} requests complete
                </Chip>
                {data.auditReadiness.finalization_blocked_events > 0 ? (
                  <Chip tone="red" dot>
                    {data.auditReadiness.finalization_blocked_events} finalization
                    blocks
                  </Chip>
                ) : (
                  <Chip tone="green" dot>
                    No finalization blocks
                  </Chip>
                )}
                <Chip tone="violet">{data.auditReadiness.data_confidence}</Chip>
              </div>
              {Object.keys(data.auditReadiness.missing_events_by_request).length >
              0 ? (
                <ul className="cf-deficiency-list">
                  {Object.entries(
                    data.auditReadiness.missing_events_by_request,
                  ).map(([requestId, missing]) => (
                    <li key={requestId}>
                      <Link to={`/requests/${requestId}`}>{requestId}</Link>{" "}
                      <span className="cf-fields__muted">
                        awaiting: {missing.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </div>
        </>
      ) : null}
    </ConsoleShell>
  );
}
