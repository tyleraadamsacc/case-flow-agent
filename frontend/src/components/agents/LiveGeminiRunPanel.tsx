import { forwardRef, useEffect, useMemo, useState } from "react";

import {
  buildGeminiRunDemoSteps,
  geminiRunDemoStepStatus,
  geminiRunDemoTotalMs,
  type GeminiRunDemoSpeed,
  type GeminiRunDemoStep,
  type GeminiRunDemoStepStatus,
} from "../../lib/geminiRunDemo";
import type { GuidedActionReceipt } from "../../lib/guidedActionResult";
import Chip, { type ChipTone } from "../ui/Chip";
import "./WorkflowConsole.css";

export type LiveGeminiRunStatus = "running" | "complete" | "error";

export interface LiveGeminiRunPanelProps {
  status: LiveGeminiRunStatus;
  startedAt: number;
  speed: GeminiRunDemoSpeed;
  receipt?: GuidedActionReceipt | null;
  errorMessage?: string | null;
}

const LiveGeminiRunPanel = forwardRef<HTMLElement, LiveGeminiRunPanelProps>(
  function LiveGeminiRunPanel(
    { status, startedAt, speed, receipt, errorMessage },
    ref,
  ) {
    const steps = useMemo(() => buildGeminiRunDemoSteps(speed), [speed]);
    const totalMs = useMemo(() => geminiRunDemoTotalMs(speed), [speed]);
    const [elapsedMs, setElapsedMs] = useState(() =>
      status === "running" ? Math.max(0, Date.now() - startedAt) : totalMs,
    );

    useEffect(() => {
      if (status !== "running") {
        setElapsedMs(totalMs);
        return undefined;
      }

      const tick = () => {
        setElapsedMs(Math.min(totalMs, Math.max(0, Date.now() - startedAt)));
      };
      tick();
      const interval = window.setInterval(tick, speed === "fast" ? 90 : 220);
      return () => window.clearInterval(interval);
    }, [speed, startedAt, status, totalMs]);

    const activeStep =
      steps.find((step) => geminiRunDemoStepStatus(step, elapsedMs) === "running") ??
      steps.find((step) => geminiRunDemoStepStatus(step, elapsedMs) === "queued") ??
      steps[steps.length - 1];
    const completedSteps = steps.filter((step) =>
      ["complete", "blocked"].includes(geminiRunDemoStepStatus(step, elapsedMs)),
    );
    const running = status === "running";
    const waitingForReceipt = running && elapsedMs >= totalMs;
    const progress =
      status === "error"
        ? Math.min(100, (elapsedMs / totalMs) * 100)
        : status === "complete"
          ? 100
          : Math.min(99, (elapsedMs / totalMs) * 100);

    return (
      <section
        ref={ref}
        className={`cf-live-agent-run cf-live-agent-run--${status}`}
        aria-label="Synthetic Gemini live agent run"
        aria-live={running ? "polite" : "off"}
        tabIndex={-1}
      >
        <header className="cf-live-agent-run__header">
          <div>
            <span className="cf-live-agent-run__eyebrow">Synthetic Gemini run</span>
            <h2>{titleForStatus(status)}</h2>
            <p>
              Demo timing shows observable work, tool activity, and receipts. Agent
              output remains draft-only until a person records the decision.
            </p>
          </div>
          <div className="cf-live-agent-run__status">
            <Chip tone={chipToneForStatus(status)} dot={status !== "complete"}>
              {statusLabel(status)}
            </Chip>
            <span>{formatElapsed(elapsedMs)} elapsed</span>
          </div>
        </header>

        <div className="cf-live-agent-run__progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="cf-live-agent-run__body">
          <ol className="cf-live-agent-run__agents" aria-label="Gemini agent progress">
            {steps.map((step) => (
              <AgentProgressRow
                key={step.agentId}
                step={step}
                status={
                  status === "error"
                    ? "queued"
                    : geminiRunDemoStepStatus(step, elapsedMs)
                }
              />
            ))}
          </ol>

          <div className="cf-live-agent-run__activity">
            <div className="cf-live-agent-run__activity-header">
              <div>
                <span className="cf-live-agent-run__eyebrow">Current activity</span>
                <h3>
                  {status === "error"
                    ? "Run stopped before outputs refreshed"
                    : waitingForReceipt
                      ? "Finalizing run receipt"
                      : activeStep.workLabel}
                </h3>
              </div>
              <Chip tone={status === "error" ? "red" : "blue"} dot={running}>
                {status === "complete"
                  ? "Receipts ready"
                  : status === "error"
                    ? "Needs retry"
                    : waitingForReceipt
                      ? "Persisting output"
                      : activeStep.agentName}
              </Chip>
            </div>
            <p>
              {status === "error"
                ? errorMessage ?? "The backend refused the workflow run."
                : waitingForReceipt
                  ? "Waiting for the persisted agent outputs and audit receipt to refresh."
                  : activeStep.detail}
            </p>
            <div className="cf-live-agent-run__tools" aria-label="Visible tool activity">
              {(status === "error" ? activeStep.tools.slice(0, 1) : activeStep.tools).map(
                (tool, index) => (
                  <ToolPill
                    key={tool}
                    label={tool}
                    state={toolState(activeStep, elapsedMs, index, status)}
                  />
                ),
              )}
            </div>
            {receipt && status === "complete" ? (
              <div className="cf-live-agent-run__receipt" role="status">
                <Chip tone="green" dot>
                  Result
                </Chip>
                <div>
                  <strong>{receipt.title}</strong>
                  <p>{receipt.summary}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {completedSteps.length > 0 ? (
          <div className="cf-live-agent-run__receipts" aria-label="Agent receipts">
            {completedSteps.slice(-4).map((step) => (
              <div key={step.agentId}>
                <span>{step.agentName}</span>
                <strong>{step.receipt}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    );
  },
);

export default LiveGeminiRunPanel;

function AgentProgressRow({
  step,
  status,
}: {
  step: GeminiRunDemoStep;
  status: GeminiRunDemoStepStatus;
}) {
  return (
    <li className={`cf-live-agent-run__agent cf-live-agent-run__agent--${status}`}>
      <span className="cf-live-agent-run__ordinal">{step.ordinal}</span>
      <span className="cf-live-agent-run__agent-copy">
        <strong>{step.agentName}</strong>
        <small>{statusCopy(status, step)}</small>
      </span>
      <Chip tone={toneForStepStatus(status, step)} dot={status === "running"}>
        {labelForStepStatus(status)}
      </Chip>
    </li>
  );
}

function ToolPill({
  label,
  state,
}: {
  label: string;
  state: "queued" | "running" | "complete" | "error";
}) {
  return (
    <span className={`cf-live-agent-run__tool cf-live-agent-run__tool--${state}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

function toolState(
  step: GeminiRunDemoStep,
  elapsedMs: number,
  index: number,
  runStatus: LiveGeminiRunStatus,
): "queued" | "running" | "complete" | "error" {
  if (runStatus === "error") {
    return "error";
  }
  if (runStatus === "complete") {
    return "complete";
  }
  const localElapsed = elapsedMs - step.startMs;
  if (localElapsed <= 0) {
    return "queued";
  }
  const slot = step.durationMs / step.tools.length;
  if (localElapsed >= slot * (index + 1)) {
    return "complete";
  }
  if (localElapsed >= slot * index) {
    return "running";
  }
  return "queued";
}

function titleForStatus(status: LiveGeminiRunStatus) {
  if (status === "complete") {
    return "Gemini agent run complete";
  }
  if (status === "error") {
    return "Gemini agent run needs attention";
  }
  return "Gemini agents are preparing draft outputs";
}

function statusLabel(status: LiveGeminiRunStatus) {
  if (status === "complete") {
    return "Complete";
  }
  if (status === "error") {
    return "Stopped";
  }
  return "Running";
}

function chipToneForStatus(status: LiveGeminiRunStatus): ChipTone {
  if (status === "complete") {
    return "green";
  }
  if (status === "error") {
    return "red";
  }
  return "blue";
}

function labelForStepStatus(status: GeminiRunDemoStepStatus) {
  if (status === "complete") {
    return "Complete";
  }
  if (status === "blocked") {
    return "Flagged";
  }
  if (status === "running") {
    return "Running";
  }
  return "Queued";
}

function toneForStepStatus(
  status: GeminiRunDemoStepStatus,
  step: GeminiRunDemoStep,
): ChipTone {
  if (status === "complete") {
    return step.tone === "amber" ? "amber" : "green";
  }
  if (status === "blocked") {
    return "red";
  }
  if (status === "running") {
    return "blue";
  }
  return "neutral";
}

function statusCopy(status: GeminiRunDemoStepStatus, step: GeminiRunDemoStep) {
  if (status === "complete" || status === "blocked") {
    return step.receipt;
  }
  if (status === "running") {
    return step.workLabel;
  }
  return "Waiting for upstream draft context.";
}

function formatElapsed(elapsedMs: number) {
  const seconds = Math.max(0, elapsedMs / 1000);
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}
