import { useEffect } from "react";

import { humanizeToken } from "../../lib/requestDisplay";
import Chip from "../ui/Chip";
import ConfidenceBar from "../ui/ConfidenceBar";
import type { ResolvedEvidence } from "./EvidenceContext";

export interface EvidenceDrawerProps {
  items: ResolvedEvidence[];
  loading: boolean;
  onClose: () => void;
}

/** Right-side evidence panel: every stable evidence id resolved to its
 * grounding source (SOP, routing rule, template, registry, taxonomy).
 * Read-only — evidence explains agent output, it never changes state. */
export default function EvidenceDrawer({
  items,
  loading,
  onClose,
}: EvidenceDrawerProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="cf-drawer-scrim" onClick={onClose}>
      <aside
        className="cf-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Evidence"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cf-drawer__header">
          <h2>Evidence</h2>
          <button
            type="button"
            className="cf-drawer__close"
            aria-label="Close evidence panel"
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        <p className="cf-drawer__hint">
          Grounding sources referenced by agent output and audit events.
          Synthetic corpus — local retrieval.
        </p>
        {loading ? <p className="cf-drawer__hint">Resolving…</p> : null}
        <div className="cf-drawer__items">
          {items.map(({ evidenceId, reference }) => (
            <article className="cf-drawer__item" key={evidenceId}>
              <div className="cf-drawer__item-head">
                <code className="cf-drawer__id">{evidenceId}</code>
                {reference ? (
                  <Chip tone="cyan">{humanizeToken(reference.source_type)}</Chip>
                ) : null}
              </div>
              {reference ? (
                <>
                  <h3 className="cf-drawer__title">{reference.title}</h3>
                  {reference.snippet ? (
                    <p className="cf-drawer__snippet">{reference.snippet}</p>
                  ) : null}
                  <ConfidenceBar value={reference.confidence} />
                </>
              ) : (
                <p className="cf-drawer__snippet">
                  {loading
                    ? "Resolving…"
                    : "Not resolvable in the local evidence index."}
                </p>
              )}
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
