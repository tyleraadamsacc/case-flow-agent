import type { Role } from "../../api/types";

/** The acting reviewer, sent on every request as X-CaseFlow-Actor /
 * X-CaseFlow-Role. Synthetic convenience for the demo (switching between
 * reviewers to exercise dual control), not authentication. Held at module
 * scope so the fetch client can read it without prop-drilling; the React
 * context keeps UI in sync. */

export interface Actor {
  actorId: string;
  role: Role;
  label: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  analyst: "Analyst",
  senior_analyst: "Senior analyst",
  sme: "SME",
  qa: "QA",
};

export const ACTOR_OPTIONS: Actor[] = [
  { actorId: "analyst.local", role: "analyst", label: "Alex Park · Analyst" },
  { actorId: "senior.rivera", role: "senior_analyst", label: "Sam Rivera · Senior analyst" },
  { actorId: "sme.mensah", role: "sme", label: "Dr. Mensah · SME" },
  { actorId: "qa.okafor", role: "qa", label: "Priya Okafor · QA" },
];

const STORAGE_KEY = "caseflow.actor";
const DEFAULT_ACTOR = ACTOR_OPTIONS[0];

function load(): Actor {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Actor;
      const known = ACTOR_OPTIONS.find((a) => a.actorId === parsed.actorId);
      if (known) {
        return known;
      }
    }
  } catch {
    // ignore unreadable storage; fall back to the default analyst
  }
  return DEFAULT_ACTOR;
}

let current: Actor = load();

export function getActor(): Actor {
  return current;
}

export function setActor(actor: Actor): void {
  current = actor;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actor));
  } catch {
    // non-persistent is acceptable for a synthetic demo identity
  }
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
