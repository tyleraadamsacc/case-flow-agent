import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProductionPackage } from "../api/types";
import ResponsePackageView from "../components/package/ResponsePackageView";
import { makeProductionPackage } from "./fixtures";

describe("ResponsePackageView", () => {
  it("renders package validation findings with blocking and warning severity", () => {
    const pkg = {
      ...makeProductionPackage(),
      validation_findings: [
        {
          code: "record_count_mismatch",
          severity: "blocking",
          section: "record_index",
          message: "Record count mismatch: summary reports 3 but index has 2.",
        },
        {
          code: "certification_incomplete",
          severity: "warning",
          section: "certification",
          message: "Certification incomplete: representative title is missing.",
        },
      ],
    } satisfies ProductionPackage;

    render(<ResponsePackageView pkg={pkg} />);

    const findings = screen.getByRole("list", {
      name: "Package validation findings",
    });
    expect(findings).toHaveTextContent(
      "Record count mismatch: summary reports 3 but index has 2.",
    );
    expect(findings).toHaveTextContent(
      "Certification incomplete: representative title is missing.",
    );

    const blocking = within(findings).getByText("Blocking");
    const warning = within(findings).getByText("Warning");
    expect(blocking.className).toContain("cf-chip--red");
    expect(warning.className).toContain("cf-chip--amber");
  });
});
