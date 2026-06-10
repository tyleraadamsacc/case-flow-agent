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

## Roadmap

The PR sequence and full build plan live in
[CASEFLOW_APPLICATION_BUILD_PLAN_FOR_REVIEW.md](CASEFLOW_APPLICATION_BUILD_PLAN_FOR_REVIEW.md)
(§18–§19). Current state: **PR 0 — application skeleton** (this scaffold). Domain models,
the deterministic workflow, and the six-agent layer arrive in PR 1 and PR 2.
