# CaseFlow Local Demo Agent Instructions

These instructions are for Claude Code, Codex, or another coding agent helping
a non-developer run CaseFlow locally in demo mode.

## Mission

Bring the CaseFlow frontend and backend up locally from `origin/develop` with
synthetic mock data, then give the user the browser URL and a short validation
summary.

Target result:

- Backend running on `http://localhost:8000`
- Frontend running on `http://localhost:5173`
- Demo request `LER-2026-004812` visible at `/requests`
- No GCP, secrets, live Gemini, or production integrations used

## Hard Guardrails

- Do not run deployment commands.
- Do not run `gcloud` commands for local demo setup.
- Do not create service account keys.
- Do not ask for API keys.
- Do not write secrets to `.env.local`.
- Do not connect to Firestore, Cloud Storage, Agent Search, Gemini, or any
  production LERS/Cases system.
- Do not delete user work.
- Do not reset or checkout over uncommitted changes unless the user explicitly
  asks.

## First Checks

Run these from the repository root:

```bash
git status --short
git branch --show-current
python3.13 --version || python3.12 --version || python3.11 --version || python3 --version
node --version
npm --version
```

If the branch is not based on `origin/develop`, tell the user. If the worktree
has unrelated dirty changes, do not overwrite them.

## One-Time Setup

Run:

```bash
cp .env.local.example .env.local
make install
```

If `.env.local` already exists, leave it in place unless it contains obvious
non-demo settings. The safe local demo values are:

```bash
CASEFLOW_APP_MODE=local
CASEFLOW_MODEL_MODE=deterministic
CASEFLOW_LOG_LEVEL=INFO
CASEFLOW_SEED_ON_STARTUP=true
CASEFLOW_SEED_DATASET=demo
```

## Start Backend

Preferred command from the repository root:

```bash
make dev-backend
```

Equivalent explicit command:

```bash
cd backend && CASEFLOW_APP_MODE=local CASEFLOW_MODEL_MODE=deterministic CASEFLOW_SEED_ON_STARTUP=true CASEFLOW_SEED_DATASET=demo .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Keep this process running. It should serve:

```text
http://localhost:8000/healthz
```

## Start Frontend

Open a second terminal/session and run from the repository root:

```bash
make dev-frontend
```

Equivalent explicit command:

```bash
cd frontend && CASEFLOW_API_PROXY=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173
```

Keep this process running. It should serve:

```text
http://localhost:5173
```

## Verify Before Reporting Success

Run:

```bash
curl -fsS http://localhost:8000/healthz
curl -fsS http://localhost:8000/api/legal-requests
curl -fsS http://localhost:8000/api/governance/summary
```

Confirm:

- `/healthz` returns `{"status":"ok","service":"caseflow-backend"}`.
- `/api/legal-requests` includes `LER-2026-004812`.
- The frontend loads at `http://localhost:5173/requests`.

If browser automation is available, open `http://localhost:5173/requests` and
confirm the request queue renders.

## What To Tell The User

When the app is ready, report:

- Backend URL
- Frontend URL
- Demo request ID: `LER-2026-004812`
- Verification checks run
- Any port changes if `8000` or `5173` were unavailable

Keep the message short and practical.

## Port Conflicts

If a port is busy:

1. Inspect the process:

   ```bash
   lsof -nP -iTCP:8000 -sTCP:LISTEN
   lsof -nP -iTCP:5173 -sTCP:LISTEN
   ```

2. Only stop the process if it is clearly an old CaseFlow backend/frontend
   started from this repo.
3. If it is unrelated, use another port and set `CASEFLOW_API_PROXY` for the
   frontend to the backend URL.

## Demo Flow For The Presenter

Start at:

```text
http://localhost:5173/requests
```

Then:

1. Click `LER-2026-004812`.
2. Follow the highlighted primary action button on each screen.
3. Extract the request.
4. Validate extracted data.
5. Run the six deterministic Gemini-style agents.
6. Review agent output.
7. Inspect evidence.
8. Open the decision panel.
9. Escalate, approve, or send to QA as the demo script requires.
10. Show the audit trail.

Useful supporting material:

```text
docs/DEMO_WALKTHROUGH.md
docs/demo-flow-slides/
```

## Troubleshooting

If the frontend shows loading forever, the backend is usually not running or
the frontend proxy cannot reach it. Check:

```bash
curl -fsS http://localhost:8000/healthz
curl -fsS http://localhost:8000/api/legal-requests
```

If install fails because Python or Node is missing, stop and tell the user the
missing prerequisite. Do not attempt system-wide package installation unless
the user asks.

If tests are requested:

```bash
make test
make test-frontend
make lint
make build-frontend
```
