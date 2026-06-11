import { useEvidence } from "../evidence/EvidenceContext";

export interface EvidenceLinkProps {
  evidenceIds?: string[];
  /** Override the default behavior (opening the shared evidence drawer). */
  onOpen?: (evidenceIds: string[]) => void;
  className?: string;
}

/** "Evidence: SOP-LOC-001" or "Evidence: 3" — renders nothing when there
 * is no evidence to show. Clicking opens the shared evidence drawer
 * (EvidenceProvider) unless an explicit handler is supplied. */
export default function EvidenceLink({
  evidenceIds,
  onOpen,
  className,
}: EvidenceLinkProps) {
  const evidence = useEvidence();
  if (!evidenceIds || evidenceIds.length === 0) {
    return null;
  }

  const label =
    evidenceIds.length === 1
      ? `Evidence: ${evidenceIds[0]}`
      : `Evidence: ${evidenceIds.length}`;

  return (
    <button
      type="button"
      className={["cf-meta-link", className].filter(Boolean).join(" ")}
      title={evidenceIds.join(", ")}
      onClick={() =>
        onOpen ? onOpen(evidenceIds) : evidence?.open(evidenceIds)
      }
    >
      <svg
        className="cf-meta-link__icon"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      <span className="cf-meta-link__label">{label}</span>
    </button>
  );
}
