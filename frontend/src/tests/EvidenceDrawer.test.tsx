import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { evidenceApi } from "../api/client";
import { EvidenceProvider } from "../components/evidence/EvidenceContext";
import EvidenceLink from "../components/ui/EvidenceLink";

afterEach(() => vi.restoreAllMocks());

describe("Evidence click-through", () => {
  it("opens the drawer from any EvidenceLink and resolves the ids", async () => {
    vi.spyOn(evidenceApi, "get").mockResolvedValue({
      evidence_id: "ROUTE-LOCATION-P1",
      source_type: "routing_rule",
      title: "Location requests route to Location Response Review",
      snippet: "Synthetic routing rule for location-data requests.",
      confidence: 1.0,
    });

    render(
      <EvidenceProvider>
        <EvidenceLink evidenceIds={["ROUTE-LOCATION-P1"]} />
      </EvidenceProvider>,
    );

    fireEvent.click(screen.getByText("Evidence: ROUTE-LOCATION-P1"));

    expect(
      await screen.findByRole("dialog", { name: "Evidence" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Location requests route to Location Response Review",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Routing rule")).toBeInTheDocument();
    expect(evidenceApi.get).toHaveBeenCalledWith("ROUTE-LOCATION-P1");

    fireEvent.click(screen.getByLabelText("Close evidence panel"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps unresolvable ids visible instead of dropping them", async () => {
    vi.spyOn(evidenceApi, "get").mockRejectedValue(new Error("404"));

    render(
      <EvidenceProvider>
        <EvidenceLink evidenceIds={["EV-UNKNOWN-1", "EV-UNKNOWN-2"]} />
      </EvidenceProvider>,
    );

    fireEvent.click(screen.getByText("Evidence: 2"));
    expect(await screen.findByText("EV-UNKNOWN-1")).toBeInTheDocument();
    expect(screen.getByText("EV-UNKNOWN-2")).toBeInTheDocument();
    expect(
      await screen.findAllByText("Not resolvable in the local evidence index."),
    ).toHaveLength(2);
  });
});
