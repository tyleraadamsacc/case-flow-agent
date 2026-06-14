import { describe, expect, it } from "vitest";

import { buildRequestGuidance } from "../lib/requestGuidance";
import { makeAgentRun, makeLegalRequest } from "./fixtures";

describe("buildRequestGuidance", () => {
  it("turns a received request into an extraction-first queue action", () => {
    const guidance = buildRequestGuidance({
      request: makeLegalRequest({
        workflow_state: "request_received",
        requesting_agency: null,
        legal_process: null,
      }),
    });

    expect(guidance.nextRequiredAction).toBe("Extract request");
    expect(guidance.primaryActionLabel).toBe("Extract request");
    expect(guidance.queueActionLabel).toBe("Open to extract request");
    expect(guidance.resultExpectation).toContain("structured fields");
    expect(guidance.secondaryActions.map((action) => action.label)).toEqual([
      "Inspect evidence",
      "Open audit trail",
    ]);
    expect(guidance.agentCommandMode).toBe("hidden");
  });

  it("routes an unstarted analyst-review request directly to the six-agent rail", () => {
    const guidance = buildRequestGuidance({ request: makeLegalRequest() });

    expect(guidance.recommendedTab).toBe("agents");
    expect(guidance.nextRequiredAction).toBe("Run six-agent workflow");
    expect(guidance.primaryActionLabel).toBe("Run six-agent workflow");
    expect(guidance.queueActionLabel).toBe("Open to run six-agent workflow");
    expect(guidance.agentCommandMode).toBe("recommended");
    expect(guidance.secondaryActions.map((action) => action.label)).toContain(
      "Inspect evidence",
    );
  });

  it("does not treat final approval attestations as blockers before agents run", () => {
    const guidance = buildRequestGuidance({
      request: makeLegalRequest(),
      finalizationStatus: {
        workflow_state: "analyst_review_pending",
        required_attestations: ["scope_verified", "identifiers_match"],
        attested: [],
        missing_attestations: ["scope_verified", "identifiers_match"],
        approvals_recorded: 0,
        approvals_required: 1,
        requires_senior_approval: false,
        senior_approval_present: false,
        blocked_agent_runs: [],
        blocking_reasons: [
          "missing_attestations: scope_verified, identifiers_match",
        ],
        ready_for_approval: false,
      },
    });

    expect(guidance.nextRequiredAction).toBe("Run six-agent workflow");
    expect(guidance.primaryActionKind).toBe("runAgents");
    expect(guidance.blockerTasks).toHaveLength(0);
  });

  it("makes a route recommendation a human decision-panel step", () => {
    const guidance = buildRequestGuidance({
      request: makeLegalRequest({
        workflow_state: "analyst_review_pending",
        agent_runs: {
          indexing_agent: makeAgentRun({ agent_id: "indexing_agent" }),
          triaging_agent: makeAgentRun({
            agent_id: "triaging_agent",
            agent_name: "Triaging Agent",
          }),
        },
        routing_recommendation: {
          target_queue: "LERS Response",
          target_owner: "analyst",
          escalation_target: null,
          reason: "Location-data warrant is ready for analyst routing.",
          sla_risk: false,
          requires_approval: true,
          evidence_ids: [],
          status: "recommended_pending_human",
        },
      }),
    });

    expect(guidance.nextRequiredAction).toBe("Approve route or request changes");
    expect(guidance.primaryActionKind).toBe("focusDecisionPanel");
    expect(guidance.queueActionLabel).toBe("Open decision panel");
    expect(guidance.reviewPanelMode).toBe("routeDecision");
    expect(guidance.agentCommandMode).toBe("available");
  });

  it("does not let final approval override the analyst-approved draft step", () => {
    const guidance = buildRequestGuidance({
      request: makeLegalRequest({
        workflow_state: "analyst_approved",
        reviews: [
          {
            review_id: "rev_test0001",
            legal_request_id: "LER-2026-004812",
            target_type: "route",
            reviewer_id: "analyst",
            role: "analyst",
            action: "approve",
            edits: {},
            comments: null,
            timestamp: "2026-06-10T08:45:00Z",
          },
        ],
      }),
      finalizationStatus: {
        workflow_state: "analyst_approved",
        required_attestations: [],
        attested: [],
        missing_attestations: [],
        approvals_recorded: 1,
        approvals_required: 1,
        requires_senior_approval: false,
        senior_approval_present: false,
        blocked_agent_runs: [],
        blocking_reasons: [],
        ready_for_approval: true,
      },
    });

    expect(guidance.nextRequiredAction).toBe("Draft response package");
    expect(guidance.primaryActionKind).toBe("openDrafts");
    expect(guidance.reviewPanelMode).toBe("supporting");
  });
});
