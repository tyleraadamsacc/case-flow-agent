import type { ReactNode } from "react";

import SideNav from "./SideNav";
import TopBar from "./TopBar";

export interface AppShellProps {
  /** Navigation rail — defaults to the standard SideNav. */
  nav?: ReactNode;
  /** App bar — defaults to the standard TopBar (which always carries the
   * synthetic-data badge). */
  topBar?: ReactNode;
  /** Optional right-side contextual panel. */
  contextPanel?: ReactNode;
  children: ReactNode;
}

/** Collapsible nav rail + top bar + content canvas + optional context
 * panel. A persistent prototype banner sits above the content: this
 * application only handles synthetic data and never sends, releases, or
 * discloses anything automatically. */
export default function AppShell({
  nav,
  topBar,
  contextPanel,
  children,
}: AppShellProps) {
  return (
    <div className="cf-shell">
      {nav ?? <SideNav />}
      <div className="cf-shell__main">
        {topBar ?? <TopBar />}
        <div className="cf-synthetic-banner" role="note">
          Prototype: synthetic / mock data only. Drafts require human review;
          nothing is sent or released by this system.
        </div>
        <div className="cf-shell__body">
          <main className="cf-shell__content">{children}</main>
          {contextPanel ? (
            <aside className="cf-shell__context">{contextPanel}</aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
