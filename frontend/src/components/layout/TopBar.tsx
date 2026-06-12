import { useState } from "react";
import type { ReactNode } from "react";

import { useOptionalActor } from "../identity/ActorContext";
import {
  ACTOR_OPTIONS,
  getActor,
  roleLabel,
  setActor as persistActor,
} from "../identity/actorStore";
import Chip from "../ui/Chip";
import StatusBadge from "../ui/StatusBadge";

export interface TopBarProps {
  /** Current screen title, shown next to the brand. */
  title?: string;
  actions?: ReactNode;
}

/** App bar: product name, page title, and a persistent synthetic-data badge —
 * every screen declares its data is synthetic (plan §13). */
export default function TopBar({ title, actions }: TopBarProps) {
  const actorContext = useOptionalActor();
  const [fallbackActor, setFallbackActor] = useState(() => getActor());
  const actor = actorContext?.actor ?? fallbackActor;

  function selectActor(actorId: string) {
    const next = ACTOR_OPTIONS.find((option) => option.actorId === actorId);
    if (!next) {
      return;
    }
    if (actorContext) {
      actorContext.setActor(next);
    } else {
      persistActor(next);
      setFallbackActor(next);
    }
  }

  return (
    <header className="cf-topbar">
      <span className="cf-topbar__brand">CaseFlow</span>
      {title ? (
        <>
          <span className="cf-topbar__divider" aria-hidden="true" />
          <span className="cf-topbar__title">{title}</span>
        </>
      ) : null}
      <span className="cf-topbar__spacer" />
      <StatusBadge status="synthetic_mock" />
      <Chip
        className="cf-topbar__guardrail-chip"
        tone="cyan"
        title="Workflow outputs stay in human review."
      >
        Human review required
      </Chip>
      <label className="cf-topbar__actor">
        <span>Active actor</span>
        <select
          className="cf-input cf-topbar__actor-select"
          value={actor.actorId}
          onChange={(event) => selectActor(event.target.value)}
        >
          {ACTOR_OPTIONS.map((option) => (
            <option key={option.actorId} value={option.actorId}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Chip
        className="cf-topbar__role-chip"
        tone={actor.role === "senior_analyst" ? "green" : "blue"}
      >
        Role: {roleLabel(actor.role)}
      </Chip>
      {actions ? <span className="cf-topbar__actions">{actions}</span> : null}
    </header>
  );
}
