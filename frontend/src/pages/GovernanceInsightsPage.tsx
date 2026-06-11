import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { governanceApi } from "../api/client";
import type {
  AgentActivity,
  AuditReadinessReport,
  GovernanceMetric,
} from "../api/types";
import AgentCoverageModule from "../components/governance/AgentCoverageModule";
import MetricBarList, {
  dataConfidenceLabel,
  metricLabel,
} from "../components/governance/MetricBarList";
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

function metricValue(metric: GovernanceMetric | undefined): string {
  if (!metric) {
    return "0";
  }
  const rounded =
    Number.isInteger(metric.value) ? metric.value : metric.value.toFixed(1);
  switch (metric.unit) {
    case "percent":
      return `${rounded}%`;
    case "hours":
      return `${rounded}h`;
    case "days":
      return `${rounded}d`;
    default:
      return String(rounded);
  }
}

function findMetric(metrics: GovernanceMetric[], id: string) {
  return metrics.find((metric) => metric.metric_id === id);
}

function topMetric(metrics: GovernanceMetric[]) {
  return [...metrics].sort((a, b) => b.value - a.value)[0];
}

function missingEventLabel(value: string): string {
  return metricLabel({
    metric_id: `missing:${value}`,
    title: value,
    value: 0,
    unit: "count",
    dimension: null,
    period: null,
    data_confidence: "fully_tracked",
    evidence_ids: [],
  });
}

function packageStatusTone(metric: GovernanceMetric) {
  const label = metricLabel(metric).toLowerCase();
  if (label.includes("approved") || label.includes("complete")) {
    return "green" as const;
  }
  if (label.includes("none") || label.includes("without")) {
    return "amber" as const;
  }
  return "blue" as const;
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

  const topDomain = data ? topMetric(data.productVolume) : undefined;
  const topBottleneck = data ? topMetric(data.bottlenecks) : undefined;
  const totalRequests = data ? findMetric(data.summary, "total_requests") : undefined;
  const openRequests = data ? findMetric(data.summary, "open_requests") : undefined;
  const humanReview = data
    ? findMetric(data.summary, "requests_requiring_human_review")
    : undefined;
  const packageTotal = data
    ? data.packageStatus.reduce((total, metric) => total + metric.value, 0)
    : 0;
  const missingAuditEntries = data
    ? Object.entries(data.auditReadiness.missing_events_by_request)
    : [];

  return (
    <ConsoleShell title="Governance & Insights">
      <div className="cf-page-header cf-governance-hero">
        <div>
          <span className="cf-governance-hero__eyebrow">
            Human-led legal operations
          </span>
          <h1>Governance command center</h1>
          <p>
            Executive view of request volume, agent coverage, response package
            readiness, and audit integrity. Every signal keeps its data
            confidence visible.
          </p>
        </div>
        {data ? (
          <div className="cf-governance-hero__panel" aria-label="Executive summary">
            <div>
              <span>{metricValue(totalRequests)}</span>
              <small>total requests</small>
            </div>
            <div>
              <span>{data.auditReadiness.coverage_percent.toFixed(0)}%</span>
              <small>audit ready</small>
            </div>
            <div>
              <span>{data.attentionCount}</span>
              <small>need attention</small>
            </div>
          </div>
        ) : null}
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
          <div className="cf-metric-strip cf-metric-strip--executive">
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
                  ? "Human decisions waiting in the work queue"
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

          <div className="cf-detail-section">
            <Card
              variant="insight"
              className="cf-governance-insight"
              title={
                topDomain && topDomain.value > 0
                  ? `${metricLabel(topDomain)} is the leading demand signal`
                  : "Demand signal will appear after request classification"
              }
              subtitle="Frontend-derived interpretation of the current governance metrics."
            >
              <div className="cf-governance-insight__body">
                <p>
                  {topDomain && topDomain.value > 0
                    ? `${metricLabel(topDomain)} accounts for ${topDomain.value} classified requests. Use this as a staffing and SME-routing signal before changing queue policy.`
                    : "No classified product-domain volume is available yet. Once requests are classified, the leading domain and staffing implication will appear here."}
                </p>
                <dl>
                  <div>
                    <dt>Open work</dt>
                    <dd>{metricValue(openRequests)}</dd>
                  </div>
                  <div>
                    <dt>Human review</dt>
                    <dd>{metricValue(humanReview)}</dd>
                  </div>
                  <div>
                    <dt>Slowest state</dt>
                    <dd>{topBottleneck ? metricLabel(topBottleneck) : "None"}</dd>
                  </div>
                </dl>
              </div>
              <div className="cf-preview__row">
                {topDomain ? (
                  <EvidenceLink evidenceIds={[topDomain.metric_id]} />
                ) : null}
                <Chip tone="violet">
                  {dataConfidenceLabel(
                    topDomain?.data_confidence ?? "synthetic_mock",
                  )}
                </Chip>
              </div>
            </Card>
          </div>

          <div className="cf-governance-grid">
            <MetricBarList
              title="Top product domains"
              subtitle="Ranked by classified request volume"
              metrics={data.productVolume}
              emptyMessage="No product domains have been classified yet."
            />
            <MetricBarList
              title="Processing time by product"
              subtitle="Average elapsed time from audit timestamps"
              metrics={data.processingTime}
              unit="h"
              emptyMessage="Timing will appear after at least two audit events exist for a request."
            />
            <MetricBarList
              title="Workflow bottlenecks"
              subtitle="Open requests ranked by dwell time"
              metrics={data.bottlenecks}
              unit="h"
              emptyMessage="No open workflow state has enough audit history to estimate dwell time."
            />
            <Card
              className="cf-package-module"
              title="Response package status"
              subtitle="Drafting coverage and pending package posture."
            >
              {data.packageStatus.length === 0 ? (
                <div className="cf-governance-empty">
                  <span className="cf-governance-empty__mark" aria-hidden="true" />
                  <p>No response package status has been recorded yet.</p>
                </div>
              ) : (
                <>
                  <div className="cf-package-module__summary">
                    <span>{packageTotal}</span>
                    <small>requests represented</small>
                  </div>
                  <ul className="cf-package-module__list">
                    {data.packageStatus
                      .slice()
                      .sort((a, b) => b.value - a.value)
                      .map((metric) => (
                        <li key={metric.metric_id}>
                          <span>{metricLabel(metric)}</span>
                          <Chip tone={packageStatusTone(metric)}>
                            {metricValue(metric)}
                          </Chip>
                        </li>
                      ))}
                  </ul>
                  <div className="cf-package-module__footer">
                    <Chip tone="violet">
                      {dataConfidenceLabel(data.packageStatus[0].data_confidence)}
                    </Chip>
                    <span className="cf-fields__muted">
                      Draft status only; no production action is taken here.
                    </span>
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="cf-detail-section">
            <Card
              variant="insight"
              className="cf-audit-readiness"
              title="Audit readiness"
              subtitle="Coverage of required audit events before approval is recorded."
            >
              <div className="cf-audit-readiness__body">
                <div className="cf-audit-readiness__score">
                  <span>{data.auditReadiness.coverage_percent.toFixed(0)}%</span>
                  <small>required event coverage</small>
                  <div className="cf-audit-readiness__track" aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, data.auditReadiness.coverage_percent),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="cf-audit-readiness__facts">
                  <Chip tone="neutral">
                    {data.auditReadiness.requests_with_all_required_events} of{" "}
                    {data.auditReadiness.requests_total} requests complete
                  </Chip>
                  {data.auditReadiness.finalization_blocked_events > 0 ? (
                    <Chip tone="red" dot>
                      {data.auditReadiness.finalization_blocked_events} approval
                      block{data.auditReadiness.finalization_blocked_events === 1 ? "" : "s"}
                    </Chip>
                  ) : (
                    <Chip tone="green" dot>
                      No approval blocks
                    </Chip>
                  )}
                  <Chip tone="violet">
                    {dataConfidenceLabel(data.auditReadiness.data_confidence)}
                  </Chip>
                </div>
              </div>
              {missingAuditEntries.length > 0 ? (
                <ul className="cf-deficiency-list">
                  {missingAuditEntries.slice(0, 5).map(([requestId, missing]) => (
                    <li key={requestId}>
                      <Link to={`/requests/${requestId}`}>{requestId}</Link>{" "}
                      <span className="cf-fields__muted">
                        awaiting: {missing.map(missingEventLabel).join(", ")}
                      </span>
                    </li>
                  ))}
                  {missingAuditEntries.length > 5 ? (
                    <li className="cf-fields__muted">
                      +{missingAuditEntries.length - 5} more requests with
                      missing required events
                    </li>
                  ) : null}
                </ul>
              ) : (
                <div className="cf-governance-empty cf-governance-empty--ready">
                  <span className="cf-governance-empty__mark" aria-hidden="true" />
                  <p>All tracked requests include the required audit events.</p>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </ConsoleShell>
  );
}
