import type { ReactNode } from "react";

import StatusBadge from "../ui/StatusBadge";

export interface TopBarProps {
  /** Current screen title, shown next to the brand. */
  title?: string;
  actions?: ReactNode;
}

/** App bar: gradient brand mark, product name, page title, and a
 * persistent synthetic-data badge — every screen declares its data is
 * synthetic (plan §13). */
export default function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="cf-topbar">
      <span className="cf-topbar__brand">
        <span className="cf-topbar__brand-mark" aria-hidden="true" />
        CaseFlow
      </span>
      {title ? (
        <>
          <span className="cf-topbar__divider" aria-hidden="true" />
          <span className="cf-topbar__title">{title}</span>
        </>
      ) : null}
      <span className="cf-topbar__spacer" />
      <StatusBadge status="synthetic_mock" />
      {actions ? <span className="cf-topbar__actions">{actions}</span> : null}
    </header>
  );
}
