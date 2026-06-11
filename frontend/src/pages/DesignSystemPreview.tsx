import type { ReactNode } from "react";

import AgentRunCard from "../components/agents/AgentRunCard";
import SixAgentWorkflowRail from "../components/agents/SixAgentWorkflowRail";
import type { AgentRunLike } from "../components/agents/SixAgentWorkflowRail";
import AppShell from "../components/layout/AppShell";
import SideNav from "../components/layout/SideNav";
import TopBar from "../components/layout/TopBar";
import AuditLink from "../components/ui/AuditLink";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import ConfidenceBar from "../components/ui/ConfidenceBar";
import EvidenceLink from "../components/ui/EvidenceLink";
import StatusBadge from "../components/ui/StatusBadge";
import { STATUS_META } from "../theme/status";

/** Sample rail data shaped like Scenario C: a pen-register request where
 * the ETL Agent is blocked pending SME escalation. All sample copy
 * follows the UI language guardrails — drafts, preparation, and pending
 * human decisions only. */
const SCENARIO_C_RUNS: AgentRunLike[] = [
  {
    agentId: "indexing_agent",
    status: "complete",
    confidence: 0.95,
    inputSummary: "LER-2026-004835: court order, 2 identifiers, 1 data category.",
    outputSummary: "Labeled Pen Register / Trap and Trace; matched 2 intake SOP entries.",
    evidenceIds: ["SOP-PEN-001", "SOP-INTAKE-002"],
    auditEventId: "evt_3f9a01",
    auditAction: "request_indexed",
    timestamp: "2026-06-10 08:43 UTC",
  },
  {
    agentId: "triaging_agent",
    status: "complete",
    confidence: 0.9,
    inputSummary: "Indexing labels + extracted fields.",
    outputSummary: "Classified as Pen Register / Trap and Trace. Route: SME Review.",
    evidenceIds: ["ROUTE-SME-001"],
    auditEventId: "evt_3f9a02",
    auditAction: "request_classified",
    requiresHumanReview: true,
    reviewReasons: ["pen_register", "non_disclosure"],
    timestamp: "2026-06-10 08:43 UTC",
  },
  {
    agentId: "etl_agent",
    status: "blocked",
    blockedReason:
      "SME escalation pending; mock retrieval is on hold until a human approves the route.",
    riskFlags: ["sme_escalation_pending"],
    auditEventId: "evt_3f9a03",
    auditAction: "etl_simulated",
    timestamp: "2026-06-10 08:44 UTC",
  },
  {
    agentId: "note_taking_and_data_entry_agent",
    status: "complete",
    confidence: 0.88,
    outputSummary: "Drafted routing rationale note, pending analyst approval.",
    auditEventId: "evt_3f9a04",
    auditAction: "note_drafted",
    requiresHumanReview: true,
    timestamp: "2026-06-10 08:44 UTC",
  },
  {
    agentId: "text_content_agent",
    status: "complete",
    confidence: 0.91,
    outputSummary: "Drafted SME notification, pending analyst approval.",
    evidenceIds: ["TMPL-SME-001"],
    auditEventId: "evt_3f9a05",
    auditAction: "sme_notification_drafted",
    requiresHumanReview: true,
    timestamp: "2026-06-10 08:45 UTC",
  },
  {
    agentId: "automation_agent",
    status: "complete",
    outputSummary: "Prepared SME escalation, pending analyst approval.",
    auditEventId: "evt_3f9a06",
    auditAction: "workflow_action_prepared",
    requiresHumanReview: true,
    timestamp: "2026-06-10 08:45 UTC",
  },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="cf-preview__section">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  );
}

/** Dev-only preview of the design system at /design-system.
 * Not a business screen — a living reference for the visual direction. */
export default function DesignSystemPreview() {
  return (
    <AppShell
      topBar={<TopBar title="Design system preview" />}
      nav={<SideNav activeId="governance" />}
    >
      <h1 style={{ fontSize: "var(--font-display)", marginBottom: "var(--space-2)" }}>
        CaseFlow design system
      </h1>
      <p style={{ color: "var(--text-secondary)", maxWidth: 640, marginTop: 0 }}>
        Gemini-inspired legal operations console: calm, airy, rounded, and
        explainable. Reference: frontend/UI_THEME_AND_GEMINI_UX_GUIDE.md.
      </p>

      <Section
        title="Six-Agent Workflow Rail"
        description="The product's most important component. All six RFP agents, by
          official name, in fixed order; blocked runs stay visible with their
          reason. Sample data mirrors Scenario C (pen register, SME escalation)."
      >
        <SixAgentWorkflowRail runs={SCENARIO_C_RUNS} />
      </Section>

      <Section
        title="Agent card states"
        description="Waiting, running, needs review, and failed: the states not
          shown in the Scenario C rail above."
      >
        <div className="cf-preview__grid">
          <AgentRunCard
            agentId="etl_agent"
            agentName="ETL Agent"
            ordinal={3}
            status="running"
            roleDescription="Simulates a read-only responsive-records pull from mock data."
            outputSummary="Querying mock GPS repository for the requested period…"
          />
          <AgentRunCard
            agentId="triaging_agent"
            agentName="Triaging Agent"
            ordinal={2}
            status="needs_review"
            roleDescription="Classifies the request and recommends a route for human approval."
            outputSummary="Legal process type is unclear; classification needs human review."
            confidence={0.55}
            requiresHumanReview
            reviewReasons={["low_confidence_classification"]}
          />
          <AgentRunCard
            agentId="indexing_agent"
            agentName="Indexing Agent"
            ordinal={1}
            status="waiting"
            roleDescription="Labels and ranks the request; matches intake SOPs."
          />
          <AgentRunCard
            agentId="automation_agent"
            agentName="Automation Agent"
            ordinal={6}
            status="failed"
            roleDescription="Prepares the next workflow action; a human always executes it."
            blockedReason="Run raised an unexpected error. Retry available; the failure was audited."
          />
        </div>
      </Section>

      <Section
        title="Status badges"
        description="Every state carries a text label; color never stands alone.
          Running is the only gradient-treated status."
      >
        <div className="cf-preview__row">
          {Object.keys(STATUS_META).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </Section>

      <Section
        title="Buttons"
        description="Tonal by default; one filled primary action per screen. The
          gradient glow is reserved for the single most important action."
      >
        <div className="cf-preview__row">
          <Button variant="filled" glow>
            Approve route
          </Button>
          <Button variant="filled">Send to QA</Button>
          <Button variant="tonal">Request changes</Button>
          <Button variant="outlined">Escalate to SME</Button>
          <Button variant="text">View evidence</Button>
          <Button variant="filled" disabled>
            Approve route
          </Button>
        </div>
      </Section>

      <Section title="Chips">
        <div className="cf-preview__row">
          <Chip tone="neutral">Subpoena</Chip>
          <Chip tone="blue" dot>
            Draft
          </Chip>
          <Chip tone="green" dot>
            Audit event logged
          </Chip>
          <Chip tone="amber" dot>
            Human review required
          </Chip>
          <Chip tone="red" dot>
            Missing date range
          </Chip>
          <Chip tone="violet">Synthetic / mock data</Chip>
          <Chip tone="cyan">8 synthetic GPS records</Chip>
        </div>
      </Section>

      <Section
        title="Confidence"
        description="Green at or above 0.75 (the backend's review threshold), amber
          to 0.5, red below. Missing scores say so."
      >
        <div className="cf-preview__grid">
          <ConfidenceBar value={0.94} />
          <ConfidenceBar value={0.62} />
          <ConfidenceBar value={0.35} />
          <ConfidenceBar value={null} />
        </div>
      </Section>

      <Section title="Evidence and audit links">
        <div className="cf-preview__row">
          <EvidenceLink evidenceIds={["SOP-LOC-001"]} />
          <EvidenceLink evidenceIds={["SOP-LOC-001", "ROUTE-LOC-002", "TMPL-PROD-001"]} />
          <AuditLink auditEventId="evt_3f9a02" action="request_classified" />
          <AuditLink auditEventId="evt_3f9a07" />
        </div>
      </Section>

      <Section
        title="Cards"
        description="Default, soft, tint, and insight variants. Insight cards carry
          the gradient as a thin top accent only."
      >
        <div className="cf-preview__grid">
          <Card title="Open backlog" subtitle="Synthetic / mock data">
            <span style={{ fontSize: "var(--font-display)", fontWeight: 500 }}>14</span>
          </Card>
          <Card
            variant="insight"
            title="Location requests are driving SLA risk"
            subtitle="Suggested action, pending human decision"
          >
            <p style={{ margin: "0 0 var(--space-3)", color: "var(--text-secondary)" }}>
              Maps / Location requests represent 38% of open backlog and 62% of
              SLA-risk items. Suggested: shift one analyst to Location Response
              Review for the afternoon window.
            </p>
            <div className="cf-preview__row">
              <EvidenceLink
                evidenceIds={["metric:product-volume-location", "metric:sla-risk-location"]}
              />
              <Chip tone="violet">synthetic_mock</Chip>
            </div>
          </Card>
          <Card variant="soft" title="Work needing attention" subtitle="Curated, prioritized">
            <div className="cf-preview__row" style={{ marginBottom: "var(--space-2)" }}>
              <StatusBadge status="needs_review" />
              <Chip tone="neutral">LER-2026-004835</Chip>
            </div>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              Triaging Agent flagged special handling. Automation Agent prepared
              an SME escalation. Next action: review escalation.
            </p>
          </Card>
        </div>
      </Section>
    </AppShell>
  );
}
