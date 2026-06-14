# CaseFlow Agent

CaseFlow is a local demo prototype for a human-led legal request workflow. It
runs a FastAPI backend and a React/Vite frontend against synthetic mock data.
No GCP project, API key, Gemini credential, database, or production integration
is required for the demo.

The demo workflow is:

```text
Request queue -> request detail -> extract -> validate -> run six agents
-> review agent output -> inspect evidence -> open decision panel
-> escalate / approve / QA handoff -> audit trail
```

## Fastest Path For A Demo Operator

If you are not a developer, open this repository in Claude Code or Codex and
ask:

```text
Use AGENTS.md and bring CaseFlow up locally in demo mode. Install anything
missing, start the backend and frontend, verify the mock request is loaded, and
give me the browser URL.
```

The agent should start:

- Backend API: `http://localhost:8000`
- Frontend app: `http://localhost:5173`
- Demo request: `LER-2026-004812`
- Best starting page: `http://localhost:5173/requests`

## Requirements

Install these before running the app:

- Python 3.11 or newer
- Node.js 18 or newer
- npm
- Git

On macOS, Claude Code/Codex can check this with:

```bash
python3.13 --version || python3.12 --version || python3.11 --version || python3 --version
node --version
npm --version
git --version
```

The Makefile automatically prefers `python3.13`, then `python3.12`, then
`python3.11`, then `python3`.

## Local Demo Setup

From a clean checkout of `origin/develop`:

```bash
git checkout develop
git pull origin develop
cp .env.local.example .env.local
make install
```

`make install` creates the backend virtual environment under `backend/.venv`
and installs frontend dependencies under `frontend/node_modules`.

The `.env.local` file is only for local settings. It must not contain secrets.
The demo defaults are deterministic and synthetic.

## Start The App

Use two terminals.

Terminal 1, backend:

```bash
make dev-backend
```

Expected backend URL:

```text
http://localhost:8000/healthz
```

Terminal 2, frontend:

```bash
make dev-frontend
```

Expected frontend URL:

```text
http://localhost:5173
```

Open the request queue directly:

```text
http://localhost:5173/requests
```

Click request `LER-2026-004812` and follow the highlighted next action buttons.

## Verify The Demo Loaded

Run these checks after both servers are up:

```bash
curl -fsS http://localhost:8000/healthz
curl -fsS http://localhost:8000/api/legal-requests
curl -fsS http://localhost:8000/api/governance/summary
```

The request list should include `LER-2026-004812`. This request comes from:

```text
backend/app/mock_data/legal_requests_demo/two_document_lers_warrant.json
```

Demo mode seeds only the focused two-document LERS scenario. The larger
scenario corpus is for tests.

## Useful Pages

- Request queue: `http://localhost:5173/requests`
- Request detail: `http://localhost:5173/requests/LER-2026-004812`
- Governance dashboard: `http://localhost:5173/governance`
- Work needing attention: `http://localhost:5173/attention`
- Audit page: `http://localhost:5173/audit`

The demo slide walkthrough lives in:

```text
docs/demo-flow-slides/
```

The written demo walkthrough is:

```text
docs/DEMO_WALKTHROUGH.md
```

## Reset Local Demo Data

Local demo state is in memory. Stop and restart the backend to reseed from the
mock demo fixture:

```bash
make demo-reset
make dev-backend
```

## Common Fixes

If the frontend cannot load data:

1. Confirm the backend is running:

   ```bash
   curl -fsS http://localhost:8000/healthz
   ```

2. Confirm the frontend dev server is running:

   ```text
   http://localhost:5173
   ```

3. Restart both servers from the repository root:

   ```bash
   make dev-backend
   make dev-frontend
   ```

If port `8000` or `5173` is busy, ask Claude Code/Codex to inspect the process
and either stop the old CaseFlow server or start on a different port with the
frontend proxy pointed at the backend.

## Tests For Developers

These are not required for a demo operator, but they are useful before making
changes:

```bash
make test
make test-frontend
make lint
make build-frontend
```

## Safety Guardrails

- Synthetic / mock data only.
- No real user data, law enforcement data, or production data.
- No GCP deployment for local demo mode.
- No service account keys.
- No API keys.
- No live Gemini dependency.
- No Firestore, Cloud Storage, Agent Search, or production LERS/Cases
  integration.
- No automated disclosure or release step. Human review remains in control.

## Repository Layout

```text
backend/    FastAPI backend, ADK agents, mock data, tests
frontend/   React + Vite + TypeScript frontend
docs/       Demo walkthroughs and supporting notes
```
