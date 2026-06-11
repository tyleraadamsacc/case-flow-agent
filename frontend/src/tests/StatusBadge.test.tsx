import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatusBadge from "../components/ui/StatusBadge";
import { STATUS_META, statusMeta } from "../theme/status";

describe("StatusBadge", () => {
  it.each([
    ["waiting", "Pending"],
    ["running", "Preparing"],
    ["complete", "Complete"],
    ["blocked", "Blocked"],
    ["failed", "Review required"],
    ["needs_review", "Human review required"],
    ["draft", "Draft"],
    ["prepared", "Prepared"],
    ["pending_approval", "Pending review"],
    ["audit_complete", "Audit event logged"],
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

  it.each([
    ["sent_to_qa", "Pending QA review"],
    ["analyst_approved", "Analyst review recorded"],
    ["approved_by_analyst", "Analyst review recorded"],
    ["prepared_pending_human", "Prepared, pending review"],
  ])("maps raw backend status %s to human-led label %s", (status, label) => {
    expect(statusMeta(status).label).toBe(label);
  });

  it("degrades unknown statuses to a humanized neutral label", () => {
    render(<StatusBadge status="future_backend_status" />);
    expect(screen.getByText("Future backend status")).toBeInTheDocument();
    expect(statusMeta("future_backend_status").tone).toBe("neutral");
  });
});
