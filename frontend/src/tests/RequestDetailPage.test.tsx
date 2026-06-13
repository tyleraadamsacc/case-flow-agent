import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import type { AuditEvent } from "../api/types";
import RequestDetailPage from "../pages/RequestDetailPage";
import {
  makeAgentRun,
  makeLegalRequest,
  makeProductionPackage,
} from "./fixtures";

const OFFICIAL_NAMES = [
  "Indexing Agent",
  "Triaging Agent",
  "ETL Agent",
  "Note Taking and Data Entry Agent",
  "Text Content Agent",
  "Automation Agent",
];

function renderDetail(id: string, initialEntry = `/requests/${id}`) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/requests/:id" element={<RequestDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const AUDIT_EVENT: AuditEvent = {
  audit_event_id: "evt_test0001",
  legal_request_id: "LER-2026-004812",
  timestamp: "2026-06-10T08:43:01Z",
  actor_type: "agent",
  actor_id: "indexing_agent",
  action: "request_indexed",
  before_state: "request_validated",
  after_state: "request_validated",
  summary: "Indexing Agent labeled the request.",
  evidence_ids: [],
  confidence: 0.95,
  approval_id: null,
  correlation_id: null,
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RequestDetailPage", () => {
  it("turns queue next intent into one pulsing primary action and focuses it", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(makeLegalRequest());
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      renderDetail(
        "LER-2026-004812",
        "/requests/LER-2026-004812?intent=next",
      );

      const primaryButton = await screen.findByRole("button", {
        name: "Run six-agent workflow",
      });
      expect(primaryButton).toHaveClass("cf-button--guided-pulse");
      expect(
        within(screen.getByLabelText("Next guided action")).getByRole("button", {
          name: "Show next button",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: "Run six-agent workflow" }),
      ).toHaveLength(1);

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
      expect(document.activeElement).toBe(primaryButton);
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: unknown })
          .scrollIntoView;
      }
    }
  });

  it("renders a guided request command center with the active next step selected", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(makeLegalRequest());
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    expect(await screen.findByRole("heading", { name: "LER-2026-004812" }))
      .toBeInTheDocument();
    expect(screen.getAllByText("Next required action").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Run six-agent workflow").length).toBeGreaterThan(0);
    expect(screen.getByText("Workflow map")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Workflow map"));
    expect(
      screen.getByRole("list", { name: "Guided request steps" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Agent outputs" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Review brief" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Evidence & fields" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Draft package" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Audit trail" })).toBeInTheDocument();
  });

  it("uses support buttons instead of an unselected tablist when the decision panel is current", async () => {
    const request = makeLegalRequest({
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
      agent_runs: {
        indexing_agent: makeAgentRun(),
        triaging_agent: makeAgentRun({
          agent_id: "triaging_agent",
          agent_name: "Triaging Agent",
        }),
      },
    });
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(request);
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail(request.legal_request_id);

    expect(
      await screen.findByRole("heading", { name: "Human decision controls" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tablist", { name: "Request sections" }),
    ).not.toBeInTheDocument();
    const supportLinks = screen.getByLabelText("Supporting workspaces");
    expect(supportLinks).toBeInTheDocument();

    fireEvent.click(within(supportLinks).getByRole("button", { name: "Agent outputs" }));
    expect(
      await screen.findByRole("tablist", { name: "Request sections" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Agent outputs" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("surfaces non-blocking warnings when supporting status cannot refresh", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(makeLegalRequest());
    vi.spyOn(api, "auditTimeline").mockRejectedValue(new Error("audit offline"));
    vi.spyOn(api, "finalizationStatus").mockRejectedValue(
      new Error("readiness offline"),
    );

    renderDetail("LER-2026-004812");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Could not refresh audit trail and approval readiness.",
    );
  });

  it("switches tabs to show evidence and agent workspaces", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(makeLegalRequest());
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    fireEvent.click(await screen.findByRole("tab", { name: "Evidence & fields" }));
    expect(screen.getByRole("tab", { name: "Evidence & fields" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await screen.findByRole("document", {
        name: "Source request document sections",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Agent outputs" }));
    expect(screen.getByRole("tab", { name: "Agent outputs" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await screen.findByRole("list", { name: "Six-Agent Workflow Rail" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Draft package" }));
    expect(screen.getByRole("tab", { name: "Draft package" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText(/No drafts yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Audit trail" }));
    expect(screen.getByRole("tab", { name: "Audit trail" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("No audit events yet.")).toBeInTheDocument();
  });

  it("renders the rail with all six official agents and live run data", async () => {
    const request = makeLegalRequest({
      agent_runs: {
        indexing_agent: makeAgentRun(),
        etl_agent: makeAgentRun({
          agent_id: "etl_agent",
          agent_name: "ETL Agent",
          status: "blocked",
          blocked_reason: "Missing date range blocks mock retrieval.",
          output_summary: "Mock retrieval halted pending clarification.",
          confidence: null,
          audit_event_id: "evt_test0002",
        }),
      },
    });
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(request);
    vi.spyOn(api, "auditTimeline").mockResolvedValue([AUDIT_EVENT]);

    renderDetail(request.legal_request_id);

    fireEvent.click(await screen.findByRole("tab", { name: "Agent outputs" }));

    const rail = await screen.findByRole("list", {
      name: "Six-Agent Workflow Rail",
    });
    for (const name of OFFICIAL_NAMES) {
      expect(within(rail).getByText(name)).toBeInTheDocument();
    }
    // Live run data flows onto the cards; agents without runs are waiting.
    expect(within(rail).getByText("Labeled the request.")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Missing date range blocks mock retrieval\./).length,
    ).toBeGreaterThan(0);
    expect(within(rail).getAllByText("Waiting")).toHaveLength(4);
    // The audit inspector resolves the event id to its action name when
    // the reviewer switches into QA mode for audit-focused review.
    fireEvent.click(within(rail).getByRole("button", { name: /Indexing Agent/ }));
    fireEvent.click(screen.getByRole("button", { name: "QA" }));
    expect(
      await screen.findByText("request_indexed"),
    ).toBeInTheDocument();
  });

  it("keeps a blocked agent review focused on the agent output before human decisions", async () => {
    const request = makeLegalRequest({
      agent_runs: {
        indexing_agent: makeAgentRun(),
        triaging_agent: makeAgentRun({
          agent_id: "triaging_agent",
          agent_name: "Triaging Agent",
        }),
        etl_agent: makeAgentRun({
          agent_id: "etl_agent",
          agent_name: "ETL Agent",
          status: "blocked",
          blocked_reason: "sme_escalation_pending",
          risk_flags: ["sme_escalation_pending"],
          output_summary: "SME escalation is pending before mock retrieval can proceed.",
        }),
        note_taking_agent: makeAgentRun({
          agent_id: "note_taking_agent",
          agent_name: "Note Taking and Data Entry Agent",
        }),
        text_content_agent: makeAgentRun({
          agent_id: "text_content_agent",
          agent_name: "Text Content Agent",
        }),
        automation_agent: makeAgentRun({
          agent_id: "automation_agent",
          agent_name: "Automation Agent",
        }),
      },
    });
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(request);
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail(request.legal_request_id);

    expect(
      await screen.findByRole("heading", { name: "Review ETL Agent blocker" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open ETL Agent output" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Next guided action")).getByRole("button", {
        name: "Open workspace",
      }),
    ).toHaveClass("cf-button--guided-pulse");
    expect(
      screen.getByRole("button", { name: "Open ETL Agent output" }),
    ).not.toHaveClass("cf-button--guided-pulse");
    expect(screen.getByRole("tab", { name: "Agent outputs" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: "Agent outputs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve route" }),
    ).not.toBeVisible();

    fireEvent.click(screen.getByText("Human decision controls"));
    expect(
      await screen.findByRole("button", { name: "Approve route" }),
    ).toBeVisible();
  });

  it("offers the five human review actions and no agent-side approval", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(makeLegalRequest());
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    expect(
      await screen.findByRole("button", { name: "Approve route" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request changes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Escalate to SME" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send to QA" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Record approval" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("All decisions are made by a person"),
    ).toBeInTheDocument();
  });

  it("renders LERS quality sections, authority checks, ongoing cadence, and new attestations", async () => {
    const request = makeLegalRequest({
      legal_process: {
        type: "search_warrant",
        components: ["search_warrant", "stored_communications"],
        court_order_included: true,
        ex_parte_order: false,
        pen_register: false,
        trap_and_trace: false,
        location_tracking: true,
        stored_communications: true,
      },
      special_handling: {
        ...makeLegalRequest().special_handling,
        ongoing_access_requested: true,
        ongoing_duration_days: 30,
        ongoing_update_interval_minutes: 360,
      },
      scope_authority_checks: [
        {
          category: "location_records",
          status: "covered",
          required_citations: ["18 U.S.C. §2703"],
          matched_citations: ["18 U.S.C. §2703"],
          message: "Location records are covered by the warrant.",
        },
        {
          category: "subscriber_notice",
          status: "needs_review",
          required_citations: ["18 U.S.C. §2705"],
          matched_citations: [],
          message: "Confirm non-disclosure authority before production.",
        },
        {
          category: "content_records",
          status: "missing_authority",
          required_citations: ["18 U.S.C. §2703(a)"],
          matched_citations: [],
          message: "Content records are requested without matched authority.",
        },
      ],
      package_validation_findings: [
        {
          code: "record_count_mismatch",
          severity: "blocking",
          section: "record_index",
          message: "Record count mismatch: summary reports 3 but index has 2.",
        },
      ],
    });
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(request);
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);
    vi.spyOn(api, "finalizationStatus").mockResolvedValue({
      workflow_state: "analyst_review_pending",
      required_attestations: [
        "authority_scope_match_confirmed",
        "ongoing_collection_reviewed",
        "package_completeness_confirmed",
        "certification_reviewed",
      ],
      attested: [],
      missing_attestations: [
        "authority_scope_match_confirmed",
        "ongoing_collection_reviewed",
        "package_completeness_confirmed",
        "certification_reviewed",
      ],
      approvals_recorded: 0,
      approvals_required: 1,
      requires_senior_approval: false,
      senior_approval_present: false,
      blocked_agent_runs: [],
      blocking_reasons: [
        "missing_authority",
        "record_count_mismatch",
        "certification_incomplete",
      ],
      ready_for_approval: false,
    });

    renderDetail(request.legal_request_id);

    fireEvent.click(await screen.findByRole("tab", { name: "Evidence & fields" }));

    const doc = await screen.findByRole("document", {
      name: "Source request document sections",
    });
    fireEvent.click(screen.getByRole("button", { name: "Requested records" }));
    expect(within(doc).getByText("Requested records").closest("section")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(within(doc).getByText("Line 2")).toBeInTheDocument();

    expect(screen.getByText("Stored communications")).toBeInTheDocument();
    expect(screen.getByText("Ongoing access")).toBeInTheDocument();
    expect(screen.getByText("Ongoing duration: 30 days")).toBeInTheDocument();
    expect(screen.getByText("Updates every 6 hours")).toBeInTheDocument();
    expect(screen.getByText("Scope authority checks")).toBeInTheDocument();
    expect(screen.getByText("Covered")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getAllByText("Missing authority").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Content records are requested without matched authority."),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Authority checked"),
    ).toBeInTheDocument();
    expect(screen.getByText("Ongoing reviewed")).toBeInTheDocument();
    expect(screen.getByText("Package complete")).toBeInTheDocument();
    expect(screen.getByText("Certification reviewed")).toBeInTheDocument();
    expect(
      screen.getByText("Record count mismatch: summary reports 3 but index has 2."),
    ).toBeInTheDocument();
    const blockers = screen.getByRole("list", {
      name: "Finalization blockers",
    });
    expect(within(blockers).getByText("Certification incomplete")).toBeInTheDocument();
  });

  it("jumps from extracted source-backed fields to the matching source section", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(makeLegalRequest());
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    fireEvent.click(await screen.findByRole("tab", { name: "Evidence & fields" }));

    const doc = await screen.findByRole("document", {
      name: "Source request document sections",
    });
    expect(within(doc).getByText("Caption and authority").closest("section")).toHaveAttribute(
      "aria-current",
      "true",
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /Account id: ACC-7784512/ }),
    );

    expect(within(doc).getByText("Requested records").closest("section")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(within(doc).getByText("account ACC-7784512")).toBeInTheDocument();
  });

  it("renders fields without source evidence without creating source jump buttons", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(
      makeLegalRequest({
        subject_identifiers: [
          {
            type: "account_id",
            value: "ACC-NO-EVIDENCE",
            confidence: 0.7,
            source_span: null,
          },
        ],
        source_sections: [
          {
            section_id: "caption",
            title: "Caption",
            start_line: 1,
            end_line: 1,
            text: "SEARCH WARRANT (SYNTHETIC).",
          },
        ],
      }),
    );
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    fireEvent.click(await screen.findByRole("tab", { name: "Evidence & fields" }));

    expect(await screen.findByText("Account id: ACC-NO-EVIDENCE")).toHaveAttribute(
      "title",
      "No source evidence available",
    );
    expect(
      screen.queryByRole("button", { name: /Account id: ACC-NO-EVIDENCE/ }),
    ).not.toBeInTheDocument();
  });

  it("renders the response package with section provenance and pending statuses", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(
      makeLegalRequest({ production_package: makeProductionPackage() }),
    );
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    fireEvent.click(await screen.findByRole("tab", { name: "Draft package" }));

    expect(
      await screen.findByText("PROD-LER-2026-004812-01"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Draft pending analyst review").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("Synthetic / mock data").length).toBeGreaterThan(0);
    // Section provenance chips (scoped to the package — the rail also
    // shows the agents by name).
    const pkg = document.querySelector(".cf-package") as HTMLElement;
    expect(within(pkg).getAllByText(/ETL Agent/).length).toBeGreaterThan(0);
    expect(within(pkg).getAllByText(/Text Content Agent/).length).toBeGreaterThan(
      0,
    );
    // Synthetic record labeling on every record row.
    expect(within(pkg).getAllByText("Synthetic / mock")).toHaveLength(2);
    expect(within(pkg).getByText("Draft pending approval")).toBeInTheDocument();
  });

  it("disables package drafting and explains why when a blocking deficiency exists", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(
      makeLegalRequest({
        agent_runs: { indexing_agent: makeAgentRun() },
        deficiency_findings: [
          {
            code: "missing_date_range",
            severity: "blocking",
            message: "Requested period missing.",
            requires_human_review: true,
            suggested_resolution: "Request a date range from the agency.",
            evidence_ids: [],
          },
        ],
      }),
    );
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    fireEvent.click(await screen.findByRole("tab", { name: "Draft package" }));

    const draftButton = await screen.findByRole("button", {
      name: "Draft response package",
    });
    expect(draftButton).toBeDisabled();
    expect(
      screen.getByText("Package drafting blocked by deficiency"),
    ).toBeInTheDocument();
  });

  it("uses guided shortcuts to open supporting workspaces", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(makeLegalRequest());
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    fireEvent.click(await screen.findByRole("button", { name: "Inspect evidence" }));
    expect(screen.getByRole("tab", { name: "Evidence & fields" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await screen.findByRole("document", {
        name: "Source request document sections",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Agent outputs" }));
    expect(screen.getByRole("tab", { name: "Agent outputs" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows a result receipt and the next button after a state-changing click", async () => {
    const initial = makeLegalRequest({
      workflow_state: "request_received",
      requesting_agency: null,
      legal_process: null,
    });
    const extracted = makeLegalRequest({
      workflow_state: "request_extracted",
    });
    vi.spyOn(api, "getLegalRequest")
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(extracted);
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);
    vi.spyOn(api, "extract").mockResolvedValue({
      legal_request: extracted,
      deficiency_findings: [],
      audit_event: {
        ...AUDIT_EVENT,
        action: "request_extracted",
        after_state: "request_extracted",
        summary: "Extraction completed.",
      },
    });

    renderDetail(initial.legal_request_id);

    fireEvent.click(await screen.findByRole("button", { name: "Extract request" }));

    expect(await screen.findByText("Extraction complete")).toBeInTheDocument();
    expect(screen.getByText("Current state: Request extracted.")).toBeInTheDocument();
    expect(screen.getByText("Audit: Extraction completed.")).toBeInTheDocument();
    expect(screen.getByText("Next: Validate extracted fields")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Validate request" }),
    ).toBeInTheDocument();
  });

  it("shows a timed Gemini run and then returns to agent review", async () => {
    const initial = makeLegalRequest({
      workflow_state: "request_validated",
      agent_runs: {},
    });
    const updated = makeLegalRequest({
      workflow_state: "analyst_review_pending",
      agent_runs: {
        indexing_agent: makeAgentRun({
          agent_id: "indexing_agent",
          agent_name: "Indexing Agent",
        }),
        triaging_agent: makeAgentRun({
          agent_id: "triaging_agent",
          agent_name: "Triaging Agent",
          requires_human_review: true,
          review_reasons: ["location_scope_review"],
        }),
        etl_agent: makeAgentRun({
          agent_id: "etl_agent",
          agent_name: "ETL Agent",
        }),
        note_taking_and_data_entry_agent: makeAgentRun({
          agent_id: "note_taking_and_data_entry_agent",
          agent_name: "Note Taking and Data Entry Agent",
        }),
        text_content_agent: makeAgentRun({
          agent_id: "text_content_agent",
          agent_name: "Text Content Agent",
        }),
        automation_agent: makeAgentRun({
          agent_id: "automation_agent",
          agent_name: "Automation Agent",
        }),
      },
    });
    vi.spyOn(api, "getLegalRequest")
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(updated);
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);
    vi.spyOn(api, "finalizationStatus").mockResolvedValue({
      workflow_state: "analyst_review_pending",
      required_attestations: [],
      attested: [],
      missing_attestations: [],
      approvals_recorded: 0,
      approvals_required: 1,
      requires_senior_approval: false,
      senior_approval_present: false,
      blocked_agent_runs: [],
      blocking_reasons: [],
      ready_for_approval: false,
    });
    vi.spyOn(api, "runAgentRail").mockResolvedValue({
      legal_request: updated,
      agent_runs: Object.values(updated.agent_runs),
    });

    renderDetail(
      initial.legal_request_id,
      `/requests/${initial.legal_request_id}?demoSpeed=fast`,
    );

    fireEvent.click(await screen.findByRole("button", {
      name: "Run six-agent workflow",
    }));

    expect(
      screen.getByRole("region", { name: "Synthetic Gemini live agent run" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Gemini agents are running")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show live run" })).toBeEnabled();
    expect(screen.getByText("Source packet")).toBeInTheDocument();

    expect(
      await screen.findByText("Gemini agent run complete", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Six-agent workflow complete").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/6 agent outputs refreshed/).length).toBeGreaterThan(0);
    expect(
      within(screen.getByLabelText("Next guided action")).getByRole("button", {
        name: "Open workspace",
      }),
    ).toBeInTheDocument();
  });

  it("exposes stable accessibility labels for the guided request workspace", async () => {
    vi.spyOn(api, "getLegalRequest").mockResolvedValue(makeLegalRequest());
    vi.spyOn(api, "auditTimeline").mockResolvedValue([]);

    renderDetail("LER-2026-004812");

    expect(
      await screen.findByRole("heading", { name: "Run six-agent workflow" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Request readiness summary")).toBeInTheDocument();
    expect(screen.getByText("Workflow map")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Request sections" })).toBeInTheDocument();
    expect(screen.getByLabelText("Request review workspace")).toBeInTheDocument();
    expect(screen.getByText("Human decision controls")).toBeInTheDocument();
    expect(screen.getByLabelText("Current step checklist")).toBeInTheDocument();
  });
});
