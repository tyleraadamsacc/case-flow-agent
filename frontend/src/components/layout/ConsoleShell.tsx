import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import AppShell from "./AppShell";
import SideNav from "./SideNav";
import TopBar from "./TopBar";

const NAV_ROUTES: Record<string, string> = {
  governance: "/governance",
  attention: "/attention",
  queue: "/requests",
  audit: "/audit",
  settings: "/settings",
};

function activeNavId(pathname: string): string | undefined {
  if (pathname.startsWith("/requests")) {
    return "queue";
  }
  return Object.keys(NAV_ROUTES).find((id) =>
    pathname.startsWith(NAV_ROUTES[id]),
  );
}

export interface ConsoleShellProps {
  title: string;
  actions?: ReactNode;
  contextPanel?: ReactNode;
  children: ReactNode;
}

/** AppShell wired to the router: nav selection navigates, the active
 * destination follows the URL, and the top bar carries the page title. */
export default function ConsoleShell({
  title,
  actions,
  contextPanel,
  children,
}: ConsoleShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppShell
      nav={
        <SideNav
          activeId={activeNavId(location.pathname)}
          onSelect={(id) => navigate(NAV_ROUTES[id] ?? "/requests")}
        />
      }
      topBar={<TopBar title={title} actions={actions} />}
      contextPanel={contextPanel}
    >
      {children}
    </AppShell>
  );
}
