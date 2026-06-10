import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

import { evidenceApi } from "../../api/client";
import type { EvidenceReference } from "../../api/types";
import EvidenceDrawer from "./EvidenceDrawer";

export interface ResolvedEvidence {
  evidenceId: string;
  reference: EvidenceReference | null;
}

interface EvidenceContextValue {
  open: (evidenceIds: string[]) => void;
}

export const EvidenceContext = createContext<EvidenceContextValue | null>(null);

/** App-level provider: any EvidenceLink anywhere opens the shared
 * evidence drawer, resolving stable evidence ids through
 * GET /api/evidence — the same ids the agents stamped on their outputs
 * and audit events. */
export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ResolvedEvidence[] | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback((evidenceIds: string[]) => {
    setLoading(true);
    setItems(evidenceIds.map((evidenceId) => ({ evidenceId, reference: null })));
    Promise.all(
      evidenceIds.map(async (evidenceId) => {
        try {
          return { evidenceId, reference: await evidenceApi.get(evidenceId) };
        } catch {
          // Unresolvable ids stay visible — never silently dropped.
          return { evidenceId, reference: null };
        }
      }),
    )
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <EvidenceContext.Provider value={{ open }}>
      {children}
      {items !== null ? (
        <EvidenceDrawer
          items={items}
          loading={loading}
          onClose={() => setItems(null)}
        />
      ) : null}
    </EvidenceContext.Provider>
  );
}

export function useEvidence(): EvidenceContextValue | null {
  return useContext(EvidenceContext);
}
