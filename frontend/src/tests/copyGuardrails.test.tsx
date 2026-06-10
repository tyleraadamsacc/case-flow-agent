/** UI language guardrails (plan §4, §13): the interface must never imply
 * an agent sent, released, disclosed, finalized, or approved anything.
 * Checked two ways: every rendered string on the design-system preview
 * (which exercises all shared components with realistic copy), and a raw
 * scan of all component/theme source files. */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SixAgentWorkflowRail from "../components/agents/SixAgentWorkflowRail";
import DesignSystemPreview from "../pages/DesignSystemPreview";

// Built by concatenation so this file never matches its own scan.
const FORBIDDEN_PHRASES = [
  "sent " + "automatically",
  "send " + "automatically",
  "sends " + "automatically",
  "production " + "released",
  "released " + "by agent",
  "released " + "by the agent",
  "final " + "certified",
  "disclosure " + "complete",
  "approved " + "by agent",
  "approved " + "by the agent",
  "fully " + "automated",
  "autonomous " + "legal",
  "auto-" + "approved",
];

const SOURCE_FILES = import.meta.glob(
  [
    "../components/**/*.tsx",
    "../theme/*.ts",
    "../pages/**/*.tsx",
    "../lib/*.ts",
    "../api/*.ts",
  ],
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

describe("UI copy guardrails", () => {
  it("the design-system preview renders no autonomous send/release/production language", () => {
    const { container } = render(<DesignSystemPreview />);
    const text = (container.textContent ?? "").toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(text).not.toContain(phrase);
    }
  });

  it("an all-states rail renders no autonomous send/release/production language", () => {
    const { container } = render(
      <SixAgentWorkflowRail
        runs={[
          { agentId: "indexing_agent", status: "complete" },
          { agentId: "triaging_agent", status: "needs_review" },
          { agentId: "etl_agent", status: "blocked", blockedReason: "Missing date range." },
          { agentId: "note_taking_and_data_entry_agent", status: "running" },
          { agentId: "text_content_agent", status: "failed", blockedReason: "Run error." },
        ]}
      />,
    );
    const text = (container.textContent ?? "").toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(text).not.toContain(phrase);
    }
  });

  it("no component, theme, or page source contains forbidden phrases", () => {
    const files = Object.keys(SOURCE_FILES);
    expect(files.length).toBeGreaterThanOrEqual(15);
    for (const [file, source] of Object.entries(SOURCE_FILES)) {
      const lowered = source.toLowerCase();
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(lowered, `${file} contains "${phrase}"`).not.toContain(phrase);
      }
    }
  });
});
