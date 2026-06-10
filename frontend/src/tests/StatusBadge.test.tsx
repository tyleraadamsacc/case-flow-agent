import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatusBadge from "../components/ui/StatusBadge";
import { STATUS_META, statusMeta } from "../theme/status";

describe("StatusBadge", () => {
  it.each([
    ["waiting", "Waiting"],
    ["running", "Running"],
    ["complete", "Complete"],
    ["blocked", "Blocked"],
    ["failed", "Failed"],
    ["needs_review", "Needs review"],
    ["draft", "Draft"],
    ["prepared", "Prepared"],
    ["pending_approval", "Pending approval"],
    ["audit_complete", "Audit complete"],
    ["audit_exception", "Audit exception"],
    ["synthetic_mock", "Synthetic / mock data"],
  ])("maps %s to the label %s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("covers every status key in STATUS_META", () => {
    // The table above must stay in sync with the status map.
    expect(Object.keys(STATUS_META)).toHaveLength(12);
  });

  it("degrades unknown statuses to a humanized neutral label", () => {
    render(<StatusBadge status="future_backend_status" />);
    expect(screen.getByText("Future backend status")).toBeInTheDocument();
    expect(statusMeta("future_backend_status").tone).toBe("neutral");
  });
});
