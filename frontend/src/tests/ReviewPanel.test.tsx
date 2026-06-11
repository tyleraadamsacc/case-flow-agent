import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import type { AuditEvent, FinalizationStatus } from "../api/types";
import { ActorProvider } from "../components/identity/ActorContext";
import { ACTOR_OPTIONS, setActor } from "../components/identity/actorStore";
import TopBar from "../components/layout/TopBar";
import ReviewPanel from "../components/request/ReviewPanel";
import { makeLegalRequest } from "./fixtures";

const AUDIT_EVENTS: AuditEvent[] = [];

function finalizationStatus(
  overrides: Partial<FinalizationStatus> = {},
): FinalizationStatus {
  return {
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
    approvals_required: 2,
    requires_senior_approval: true,
    senior_approval_present: false,
    blocked_agent_runs: [],
    blocking_reasons: [
      "missing_attestations: authority_scope_match_confirmed, ongoing_collection_reviewed, package_completeness_confirmed, certification_reviewed",
    ],
    ready_for_approval: false,
    ...overrides,
  };
}

function renderReview(status: FinalizationStatus) {
  vi.spyOn(api, "finalizationStatus").mockResolvedValue(status);
  return render(
    <ActorProvider>
      <ReviewPanel
        request={makeLegalRequest()}
        auditEvents={AUDIT_EVENTS}
        onUpdated={vi.fn()}
      />
    </ActorProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  setActor(ACTOR_OPTIONS[0]);
});

describe("ReviewPanel role-based review UX", () => {
  it("shows active actor, role, approval progress, senior co-sign state, and compact attestation labels", async () => {
    renderReview(finalizationStatus());

    const reviewer = await screen.findByLabelText("Active reviewer");
    expect(within(reviewer).getByText("Alex Park · Analyst")).toBeInTheDocument();
    expect(within(reviewer).getByText("Role: Analyst")).toBeInTheDocument();
    expect(screen.getByText("Approval 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Senior co-sign required")).toBeInTheDocument();
    expect(screen.getAllByText("Senior missing").length).toBeGreaterThan(0);

    expect(screen.getAllByText("Authority checked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ongoing reviewed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Package complete").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Certification reviewed").length).toBeGreaterThan(0);
  });

  it("explains disabled finalization with concise mapped reason rows", async () => {
    renderReview(finalizationStatus());

    const finalize = await screen.findByRole("button", {
      name: "Finalize request",
    });
    expect(finalize).toBeDisabled();

    const reasons = screen.getByRole("list", {
      name: "Disabled action reasons",
    });
    expect(within(reasons).getByText("Finalize disabled")).toBeInTheDocument();
    expect(
      within(reasons).getByText(
        "Missing attestations: Authority checked, Ongoing reviewed, Package complete, Certification reviewed",
      ),
    ).toBeInTheDocument();
  });

  it("shows senior present when a senior co-signer is already recorded", async () => {
    renderReview(
      finalizationStatus({
        approvals_recorded: 1,
        senior_approval_present: true,
        ready_for_approval: true,
        blocking_reasons: [],
        attested: [
          "authority_scope_match_confirmed",
          "ongoing_collection_reviewed",
          "package_completeness_confirmed",
          "certification_reviewed",
        ],
        missing_attestations: [],
      }),
    );

    expect(await screen.findByText("Approval 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Senior present")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Disabled action reasons" }),
    ).not.toBeInTheDocument();
  });
});

describe("TopBar active actor", () => {
  it("surfaces the active actor control and role separately", () => {
    setActor(ACTOR_OPTIONS[1]);

    render(
      <ActorProvider>
        <TopBar title="Review" />
      </ActorProvider>,
    );

    expect(screen.getByText("Active actor")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("senior.rivera");
    expect(screen.getByText("Role: Senior analyst")).toBeInTheDocument();
  });
});
