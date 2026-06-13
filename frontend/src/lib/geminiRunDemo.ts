import { AGENT_RAIL_ORDER, AGENT_THEME, type AgentId } from "../theme/agentTheme";

export type GeminiRunDemoSpeed = "fast" | "normal" | "slow";
export type GeminiRunDemoStepStatus = "queued" | "running" | "complete" | "blocked";
export type GeminiRunDemoTone = "blue" | "green" | "amber" | "red" | "neutral";

export interface GeminiRunDemoStep {
  agentId: AgentId;
  agentName: string;
  ordinal: number;
  startMs: number;
  durationMs: number;
  workLabel: string;
  detail: string;
  tools: string[];
  receipt: string;
  tone: GeminiRunDemoTone;
}

const SPEED_SCALE: Record<GeminiRunDemoSpeed, number> = {
  fast: 0.22,
  normal: 1,
  slow: 1.45,
};

const BASE_STEPS: Array<
  Omit<GeminiRunDemoStep, "agentName" | "ordinal" | "startMs" | "durationMs"> & {
    start: number;
    duration: number;
  }
> = [
  {
    agentId: "indexing_agent",
    start: 0,
    duration: 1050,
    workLabel: "Reading request packet",
    detail: "Finding source sections, identifiers, dates, and cited authority.",
    tools: ["Source packet", "Identifier scan", "Citation locator"],
    receipt: "Indexed request facts and source-backed identifiers.",
    tone: "green",
  },
  {
    agentId: "triaging_agent",
    start: 760,
    duration: 1320,
    workLabel: "Classifying workflow route",
    detail: "Comparing request type, product domain, urgency, and review policy.",
    tools: ["Policy matrix", "Queue classifier", "Review policy"],
    receipt: "Prepared route recommendation for human review.",
    tone: "amber",
  },
  {
    agentId: "etl_agent",
    start: 2050,
    duration: 1480,
    workLabel: "Checking mock retrieval scope",
    detail: "Matching requested categories and date range to synthetic responsive records.",
    tools: ["Scope check", "Mock record lookup", "Data minimization"],
    receipt: "Prepared read-only retrieval summary and any blocker flags.",
    tone: "amber",
  },
  {
    agentId: "note_taking_and_data_entry_agent",
    start: 3180,
    duration: 1180,
    workLabel: "Drafting workflow notes",
    detail: "Preparing field updates and analyst notes without changing final state.",
    tools: ["Field mapper", "Note draft", "Audit context"],
    receipt: "Drafted notes and field updates pending human approval.",
    tone: "green",
  },
  {
    agentId: "text_content_agent",
    start: 4210,
    duration: 1540,
    workLabel: "Composing draft response package",
    detail: "Assembling package language, provenance, and deficiency response options.",
    tools: ["Package outline", "Provenance linker", "Draft generator"],
    receipt: "Prepared draft package text for analyst review.",
    tone: "green",
  },
  {
    agentId: "automation_agent",
    start: 5600,
    duration: 1120,
    workLabel: "Preparing next human action",
    detail: "Summarizing gates, blockers, and the next safe reviewer action.",
    tools: ["Gate checker", "Action planner", "Audit receipt"],
    receipt: "Prepared next action. A human still decides the route.",
    tone: "blue",
  },
];

export function normalizeGeminiRunDemoSpeed(
  value: string | null | undefined,
): GeminiRunDemoSpeed {
  if (value === "fast" || value === "slow") {
    return value;
  }
  return "normal";
}

export function buildGeminiRunDemoSteps(
  speed: GeminiRunDemoSpeed,
): GeminiRunDemoStep[] {
  const scale = SPEED_SCALE[speed];
  return BASE_STEPS.map((step) => {
    const theme = AGENT_THEME[step.agentId];
    return {
      agentId: step.agentId,
      agentName: theme.officialName,
      ordinal: AGENT_RAIL_ORDER.indexOf(step.agentId) + 1,
      startMs: Math.round(step.start * scale),
      durationMs: Math.max(240, Math.round(step.duration * scale)),
      workLabel: step.workLabel,
      detail: step.detail,
      tools: step.tools,
      receipt: step.receipt,
      tone: step.tone,
    };
  });
}

export function geminiRunDemoTotalMs(speed: GeminiRunDemoSpeed): number {
  const steps = buildGeminiRunDemoSteps(speed);
  return Math.max(...steps.map((step) => step.startMs + step.durationMs));
}

export function geminiRunDemoStepStatus(
  step: GeminiRunDemoStep,
  elapsedMs: number,
): GeminiRunDemoStepStatus {
  if (elapsedMs < step.startMs) {
    return "queued";
  }
  if (elapsedMs < step.startMs + step.durationMs) {
    return "running";
  }
  return step.tone === "red" ? "blocked" : "complete";
}
