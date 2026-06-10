import { useEffect, useState } from "react";

import AppShell from "./components/layout/AppShell";
import TopBar from "./components/layout/TopBar";
import Card from "./components/ui/Card";
import Chip from "./components/ui/Chip";
import DesignSystemPreview from "./pages/DesignSystemPreview";

export default function App() {
  // Routing proper arrives with the workflow screens; until then a plain
  // pathname check exposes the design-system reference page.
  if (window.location.pathname === "/design-system") {
    return <DesignSystemPreview />;
  }
  return <Home />;
}

function Home() {
  const [backendStatus, setBackendStatus] = useState("checking…");

  useEffect(() => {
    fetch("/healthz")
      .then((res) => res.json())
      .then((body: { status?: string }) =>
        setBackendStatus(body.status === "ok" ? "connected" : "unhealthy"),
      )
      .catch(() => setBackendStatus("not reachable — start it with `make dev-backend`"));
  }, []);

  return (
    <AppShell topBar={<TopBar title="Home" />}>
      <Card
        title="CaseFlow Agent"
        subtitle="Human-led LERS request workflow prototype"
        style={{ maxWidth: 640 }}
      >
        <p style={{ color: "var(--text-secondary)" }}>
          Application screens arrive in later PRs; this page only verifies the
          frontend shell runs.
        </p>
        <div className="cf-preview__row">
          <Chip tone={backendStatus === "connected" ? "green" : "amber"} dot>
            Backend: {backendStatus}
          </Chip>
          <a href="/design-system">Design system reference</a>
        </div>
      </Card>
    </AppShell>
  );
}
