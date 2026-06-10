# CaseFlow Agent (Prototype)

CaseFlow Agent is a GCP-native, **human-led** agentic workflow prototype for Google Legal
Investigations Support / LERS-style request processing:

```
LERS request intake → extraction → indexing → triage → route / escalation
→ mock ETL → note drafting → response package drafting → human review
→ audit trail → governance insights
```

The prototype makes the six RFP agents first-class, visible workflow actors:
**Indexing Agent, Triaging Agent, ETL Agent, Note Taking and Data Entry Agent,
Text Content Agent, Automation Agent.**

The six agents are implemented as named **Google ADK** agents
(`backend/app/adk_agents/`), orchestrated in rail order by a
`CaseFlowRootAgent` (ADK `Workflow` graph). ADK owns agent execution only;
the FastAPI application layer owns APIs, repositories, approval policy, the
audit service, governance metrics, and all finalization authority. ADK
session state is an execution scratchpad — persisted records are the source
of truth.

## Guardrails

- Synthetic / mock data only. No real user data, no real law enforcement data, no real PII.
- No Law Enforcement disclosure step is automated. Nothing is sent or released automatically.
- No legal determinations. Every route, note, draft, response package, and escalation is
  human-reviewed.
- Every agent and human action writes an audit event.
- Runs entirely locally with **zero GCP credentials**. GCP integrations arrive later behind
  swappable adapters.

This is a demo prototype. It must not be read as production legal automation.

## Quickstart

Requires Python 3.11+ and Node 18+.

```bash
cp .env.local.example .env.local   # no credentials needed; defaults are fine
make install                       # backend venv + frontend node_modules
make test                          # backend test suite
make test-frontend                 # frontend test suite (Vitest)
make dev-backend                   # FastAPI on http://localhost:8000 (GET /healthz)
make dev-frontend                  # Vite dev server (proxies /healthz and /api to :8000)
```

Frontend design system: visual direction and component rules live in
[frontend/UI_THEME_AND_GEMINI_UX_GUIDE.md](frontend/UI_THEME_AND_GEMINI_UX_GUIDE.md);
a living component reference (including the Six-Agent Workflow Rail) renders at
`http://localhost:5173/design-system` under `make dev-frontend`.

## Repository layout

```
backend/    FastAPI application and tests (Python)
frontend/   React + Vite + TypeScript SPA shell
caseflow_codex_handoff_docs_v3_six_agent_visibility/   source handoff documents
CASEFLOW_APPLICATION_BUILD_PLAN_FOR_REVIEW.md          implementation plan and PR roadmap
```

## Current state (PR 1 + PR 2 backend)

The deterministic backend is feature-complete for the demo workflow:

- typed Pydantic domain models (`backend/app/models/`), workflow state
  machine, and code-enforced approval policy (`backend/app/orchestration/`)
- single-path audit service over an append-only local repository — an audit
  write failure blocks the state transition (and agent-run persistence)
- **six-agent deterministic ADK workflow**: each agent reads context from
  ADK session state (scratchpad only), produces a typed structured output,
  and the execution bridge (`orchestration/agent_execution_service.py`)
  persists one `AgentRun` + exactly one audit event per run — blocked runs
  included. The agent-run repository, never session state, feeds the API.
- eight seeded synthetic scenarios (A–F plus regulator/sensitive-sender and
  low-confidence) and an idempotent mock-data loader
- response package / no-records / deficiency-response / SME-notification
  drafting per the Template LERS Response structure — all drafts are
  type-constrained to pending-human statuses
- local evidence retrieval (`GET /api/evidence`) resolving every stable
  evidence id the agents emit
- APIs: request queue/detail (incl. `agent_runs`), extract, validate,
  `agents/run` (full rail), agent-runs, responsive-records, production
  package + deficiency drafting, review/approve/escalate/send-to-qa, audit
  timeline + global query (`?agent=` filter), and governance: summary,
  agent-activity (RFP Agent Coverage), work-needing-attention,
  product-volume, processing-time-by-product, bottlenecks, audit-readiness,
  response-package-status
- twelve golden scenarios (`make test-golden`) and a backend demo runner
  (`make demo-scenario-a`)
- Gemini *preparation* scaffolding only (`backend/app/llm/`): MockModelClient,
  config-driven ModelRouter, structured-output validation — no live model
  integration exists and no `google-genai` dependency is declared

Intentionally deferred: Gemini-backed agent behavior (PR 8), Agent
Search/Firestore/Cloud Storage adapters (PR 10), and the frontend workflow
screens (PR 6–7).

## Roadmap

The PR sequence and full build plan live in
[CASEFLOW_APPLICATION_BUILD_PLAN_FOR_REVIEW.md](CASEFLOW_APPLICATION_BUILD_PLAN_FOR_REVIEW.md)
(§18–§19).
