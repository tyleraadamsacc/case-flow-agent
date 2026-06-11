import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import RequestQueuePage from "../pages/RequestQueuePage";
import { makeAgentRun, makeLegalRequest } from "./fixtures";

afterEach(() => vi.restoreAllMocks());

describe("RequestQueuePage", () => {
  it("renders the seeded requests with state and next human action", async () => {
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

    expect(await screen.findByText("LER-2026-004812")).toBeInTheDocument();
    expect(screen.getByText("LER-2026-004821")).toBeInTheDocument();
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("Extract request")).toBeInTheDocument();
    expect(screen.getAllByText("Analyst review pending").length).toBeGreaterThan(0);
    expect(screen.getByText("Review agent output")).toBeInTheDocument();
    expect(screen.getByText("Blocking deficiency")).toBeInTheDocument();
    expect(screen.getByText("Blocking deficiency review")).toBeInTheDocument();
    expect(screen.getByText("1 audit event linked")).toBeInTheDocument();
    expect(screen.getByText("Demo walkthrough")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 requests")).toBeInTheDocument();
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
});
