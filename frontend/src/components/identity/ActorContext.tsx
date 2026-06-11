import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { Actor } from "./actorStore";
import { getActor, setActor as persistActor } from "./actorStore";

interface ActorContextValue {
  actor: Actor;
  setActor: (actor: Actor) => void;
}

const ActorContext = createContext<ActorContextValue | null>(null);

/** Provides the current synthetic reviewer and a setter that also updates
 * the module store the API client reads. Switching the actor re-renders
 * consumers (so the review panel reflects who is acting) and changes the
 * identity headers on subsequent requests. */
export function ActorProvider({ children }: { children: ReactNode }) {
  const [actor, setActorState] = useState<Actor>(() => getActor());

  const setActor = useCallback((next: Actor) => {
    persistActor(next);
    setActorState(next);
  }, []);

  const value = useMemo(() => ({ actor, setActor }), [actor, setActor]);
  return <ActorContext.Provider value={value}>{children}</ActorContext.Provider>;
}

export function useActor(): ActorContextValue {
  const value = useContext(ActorContext);
  if (value === null) {
    throw new Error("useActor must be used within an ActorProvider");
  }
  return value;
}

export function useOptionalActor(): ActorContextValue | null {
  return useContext(ActorContext);
}
