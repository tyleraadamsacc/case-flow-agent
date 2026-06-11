import { fireEvent, render, screen, within } from "@testing-library/react";
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

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/requests/${id}`]}>
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

afterEach(() => vi.restoreAllMocks());

describe("RequestDetailPage", () => {
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

    const rail = await screen.findByRole("list", {
      name: "Six-Agent Workflow Rail",
    });
    for (const name of OFFICIAL_NAMES) {
      expect(within(rail).getByText(name)).toBeInTheDocument();
    }
    // Live run data flows onto the cards; agents without runs are waiting.
    expect(within(rail).getByText("Labeled the request.")).toBeInTheDocument();
    expect(
      screen.getByText(/Missing date range blocks mock retrieval\./),
    ).toBeInTheDocument();
    expect(within(rail).getAllByText("Waiting")).toHaveLength(4);
    // The audit inspector resolves the event id to its action name when
    // the reviewer switches into QA mode for audit-focused review.
    fireEvent.click(within(rail).getByRole("button", { name: /Indexing Agent/ }));
    fireEvent.click(screen.getByRole("button", { name: "QA" }));
    expect(
      await screen.findByText("request_indexed"),
    ).toBeInTheDocument();
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
      screen.getByRole("button", { name: "Finalize request" }),
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

    expect(
      await screen.findByText("PROD-LER-2026-004812-01"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Draft, pending analyst review · synthetic \/ mock data/),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft pending analyst review")).toBeInTheDocument();
    // Section provenance chips (scoped to the package — the rail also
    // shows the agents by name).
    const pkg = document.querySelector(".cf-package") as HTMLElement;
    expect(within(pkg).getByText("ETL Agent")).toBeInTheDocument();
    expect(within(pkg).getAllByText("Text Content Agent").length).toBeGreaterThan(0);
    // Synthetic record labeling on every record row.
    expect(within(pkg).getAllByText("synthetic_mock")).toHaveLength(2);
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

    const draftButton = await screen.findByRole("button", {
      name: "Draft response package",
    });
    expect(draftButton).toBeDisabled();
    expect(
      screen.getByText("Package drafting blocked by deficiency"),
    ).toBeInTheDocument();
  });
});
