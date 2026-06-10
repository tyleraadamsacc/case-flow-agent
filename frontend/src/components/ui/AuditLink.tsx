export interface AuditLinkProps {
  auditEventId?: string | null;
  /** Audit action name (e.g. "request_classified") — preferred display
   * text when available. */
  action?: string | null;
  /** Future navigation hook — routing to the audit timeline arrives with
   * the Audit screen. */
  onOpen?: (auditEventId: string | null) => void;
  className?: string;
}

/** "Audit: request_classified" — proof the run was logged. Renders
 * nothing when there is no audit event to reference. */
export default function AuditLink({
  auditEventId,
  action,
  onOpen,
  className,
}: AuditLinkProps) {
  if (!auditEventId && !action) {
    return null;
  }

  return (
    <button
      type="button"
      className={["cf-meta-link", className].filter(Boolean).join(" ")}
      title={auditEventId ?? undefined}
      onClick={() => onOpen?.(auditEventId ?? null)}
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
        <path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      Audit: {action ?? auditEventId}
    </button>
  );
}
