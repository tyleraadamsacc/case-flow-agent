import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import RequestQueuePage from "../pages/RequestQueuePage";
import { makeAgentRun, makeLegalRequest } from "./fixtures";

afterEach(() => vi.restoreAllMocks());

describe("RequestQueuePage", () => {
  it("renders the seeded requests with polished queue status and next human action", async () => {
    vi.spyOn(api, "listAgentRuns").mockImplementation(async (requestId) => {
      if (requestId === "LER-2026-004821") {
        return [
          makeAgentRun({
            legal_request_id: requestId,
            agent_id: "triaging_agent",
            requires_human_review: true,
            audit_event_id: "evt_review",
          }),
        ];
      }
      return [];
    });

    vi.spyOn(api, "listLegalRequests").mockResolvedValue([
      makeLegalRequest({
        legal_request_id: "LER-2026-004812",
        workflow_state: "request_received",
        requesting_agency: null,
        legal_process: null,
      }),
      makeLegalRequest({
        legal_request_id: "LER-2026-004821",
        workflow_state: "analyst_review_pending",
        deficiency_findings: [
          {
            code: "missing_date_range",
            severity: "blocking",
            message: "Requested period missing.",
            requires_human_review: true,
            suggested_resolution: null,
            evidence_ids: [],
          },
        ],
      }),
    ]);

    render(
      <MemoryRouter>
        <RequestQueuePage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("LER-2026-004812")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("LER-2026-004821").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /All requests/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Ready for decision/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("Guided processing path")).toBeInTheDocument();
    expect(screen.getByText("Queue insight")).toBeInTheDocument();
    expect(screen.getAllByText("Extract request").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Analyst review pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Resolve review flags").length).toBeGreaterThan(0);
    expect(screen.getByText("1 blocking deficiency")).toBeInTheDocument();
    expect(screen.getByText(/Blocking deficiency review/)).toBeInTheDocument();
    expect(await screen.findByText(/1 audit event linked/)).toBeInTheDocument();
    expect(screen.getAllByText("Six-agent workflow not started").length).toBeGreaterThan(0);
    expect(screen.getByText("2 of 2 requests")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Open request LER-2026-004821.*Next required action: Resolve review flags/,
      }),
    ).toBeInTheDocument();
  });

  it("shows a backend-unreachable message on load failure", async () => {
    vi.spyOn(api, "listLegalRequests").mockRejectedValue(
      new Error("fetch failed"),
    );
    render(
      <MemoryRouter>
        <RequestQueuePage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Could not load the queue/)).toBeInTheDocument();
  });

  it("filters to blocked requests while preserving next-action affordance copy", async () => {
    vi.spyOn(api, "listAgentRuns").mockResolvedValue([]);
    vi.spyOn(api, "listLegalRequests").mockResolvedValue([
      makeLegalRequest({
        legal_request_id: "LER-2026-004812",
        workflow_state: "request_received",
        requesting_agency: null,
        legal_process: null,
      }),
      makeLegalRequest({
        legal_request_id: "LER-2026-004821",
        workflow_state: "analyst_review_pending",
        deficiency_findings: [
          {
            code: "missing_date_range",
            severity: "blocking",
            message: "Requested period missing.",
            requires_human_review: true,
            suggested_resolution: null,
            evidence_ids: [],
          },
        ],
      }),
    ]);

    render(
      <MemoryRouter>
        <RequestQueuePage />
      </MemoryRouter>,
    );

    const blockedControls = await screen.findAllByRole("button", { name: /Blocked/ });
    fireEvent.click(blockedControls[0]);

    expect(blockedControls[0]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("LER-2026-004812")).not.toBeInTheDocument();
    expect(screen.getAllByText("LER-2026-004821").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Next required action").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Resolve review flags").length).toBeGreaterThan(0);
    expect(screen.getByText(/Blocking deficiency review/)).toBeInTheDocument();
  });

  it("filters the queue with human-readable status chips", async () => {
    vi.spyOn(api, "listLegalRequests").mockResolvedValue([
      makeLegalRequest({
        legal_request_id: "LER-2026-004812",
        workflow_state: "request_received",
        requesting_agency: null,
        legal_process: null,
      }),
      makeLegalRequest({
        legal_request_id: "LER-2026-004821",
        workflow_state: "analyst_review_pending",
      }),
    ]);
    vi.spyOn(api, "listAgentRuns").mockResolvedValue([]);

    render(
      <MemoryRouter>
        <RequestQueuePage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Awaiting intake" }));

    expect(screen.getByRole("button", { name: "Awaiting intake" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByText("LER-2026-004812").length).toBeGreaterThan(0);
    expect(screen.queryByText("LER-2026-004821")).not.toBeInTheDocument();
    expect(screen.getAllByText("Synthetic / mock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Human review required").length).toBeGreaterThan(0);
  });

  it("shows an empty queue view without losing filter controls", async () => {
    vi.spyOn(api, "listLegalRequests").mockResolvedValue([]);

    render(
      <MemoryRouter>
        <RequestQueuePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No requests in this view")).toBeInTheDocument();
    expect(screen.getByText(/Seeded requests appear here/)).toBeInTheDocument();
    expect(screen.getByLabelText("Filter requests")).toBeInTheDocument();
    expect(screen.getByText("0 of 0 requests")).toBeInTheDocument();
  });

  it("shows loading state before queue data resolves", () => {
    vi.spyOn(api, "listLegalRequests").mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <RequestQueuePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("status", { name: "Loading requests" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Filter requests")).toBeInTheDocument();
  });

  it("navigates from a queue row to the selected request detail route", async () => {
    vi.spyOn(api, "listAgentRuns").mockResolvedValue([]);
    vi.spyOn(api, "listLegalRequests").mockResolvedValue([
      makeLegalRequest({
        legal_request_id: "LER-2026-004821",
        workflow_state: "analyst_review_pending",
      }),
    ]);

    render(
      <MemoryRouter initialEntries={["/requests"]}>
        <Routes>
          <Route path="/requests" element={<RequestQueuePage />} />
          <Route path="/requests/:id" element={<div>Request detail route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /Open request LER-2026-004821/ }),
    );

    expect(await screen.findByText("Request detail route")).toBeInTheDocument();
  });

  it("does not render forbidden autonomous-action phrases", async () => {
    const forbidden = [
      "sent automatically",
      "production released",
      "final certified output",
      "disclosure complete",
      "autonomous legal response",
      "approved by agent",
      "fully automated",
    ];
    vi.spyOn(api, "listLegalRequests").mockResolvedValue([
      makeLegalRequest({
        legal_request_id: "LER-2026-004812",
        workflow_state: "request_received",
      }),
    ]);
    vi.spyOn(api, "listAgentRuns").mockResolvedValue([]);

    const { container } = render(
      <MemoryRouter>
        <RequestQueuePage />
      </MemoryRouter>,
    );

    await screen.findAllByText("LER-2026-004812");
    const text = (container.textContent ?? "").toLowerCase();
    for (const phrase of forbidden) {
      expect(text).not.toContain(phrase);
    }
  });
});
