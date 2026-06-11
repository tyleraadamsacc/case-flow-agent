import { useState } from "react";

import Button from "../ui/Button";
import {
  COMMAND_BAR_TARGET_LABELS,
  COMMAND_BAR_TARGETS,
  type CommandBarTarget,
} from "./agentWorkflowUtils";

export interface RerunCommand {
  agentId: string;
  target: CommandBarTarget;
  instruction: string;
}

export interface RerunCommandBarProps {
  agentId: string;
  agentName: string;
  disabled?: boolean;
  defaultTarget?: CommandBarTarget;
  availableTargets?: readonly CommandBarTarget[];
  placeholder?: string;
  onSubmit: (command: RerunCommand) => Promise<void> | void;
}

export default function RerunCommandBar({
  agentId,
  agentName,
  disabled = false,
  defaultTarget = "current_agent",
  availableTargets = COMMAND_BAR_TARGETS,
  placeholder = "Instruction for rerun",
  onSubmit,
}: RerunCommandBarProps) {
  const [target, setTarget] = useState<CommandBarTarget>(defaultTarget);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmedInstruction = instruction.trim();

  async function submitCommand() {
    if (!trimmedInstruction || disabled) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ agentId, target, instruction: trimmedInstruction });
      setInstruction("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="cf-agent-card__actions"
      aria-label={`Rerun command for ${agentName}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submitCommand();
      }}
    >
      <label className="cf-field">
        <span className="cf-field__label">Target</span>
        <select
          className="cf-input"
          value={target}
          disabled={disabled || busy}
          onChange={(event) => setTarget(event.target.value as CommandBarTarget)}
        >
          {availableTargets.map((candidate) => (
            <option value={candidate} key={candidate}>
              {COMMAND_BAR_TARGET_LABELS[candidate]}
            </option>
          ))}
        </select>
      </label>
      <label className="cf-field">
        <span className="cf-field__label">Instruction</span>
        <textarea
          className="cf-input cf-agent-card__instruction"
          rows={2}
          value={instruction}
          placeholder={placeholder}
          disabled={disabled || busy}
          onChange={(event) => setInstruction(event.target.value)}
        />
      </label>
      <div className="cf-agent-card__action-row">
        <Button
          size="sm"
          variant="outlined"
          disabled={disabled || busy || !trimmedInstruction}
          type="submit"
        >
          {busy ? "Requesting..." : "Request rerun"}
        </Button>
      </div>
    </form>
  );
}
