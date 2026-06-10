import { useEffect, useState } from "react";

export default function App() {
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
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        margin: "4rem auto",
        maxWidth: 640,
        padding: "0 1rem",
      }}
    >
      <p
        style={{
          background: "#fff3cd",
          border: "1px solid #ffe69c",
          borderRadius: 4,
          padding: "0.5rem 0.75rem",
        }}
      >
        Prototype — synthetic / mock data only. No production systems are connected.
      </p>
      <h1>CaseFlow Agent</h1>
      <p>
        Human-led LERS request workflow prototype. Application screens arrive in later PRs;
        this page only verifies the frontend shell runs.
      </p>
      <p>
        Backend: <strong>{backendStatus}</strong>
      </p>
    </main>
  );
}
