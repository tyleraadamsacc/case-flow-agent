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
make test                          # backend test suite (unit + api)
make dev-backend                   # FastAPI on http://localhost:8000 (GET /healthz)
make dev-frontend                  # Vite dev server (proxies /healthz and /api to :8000)
```

Mock data: the six synthetic scenario fixtures under
`backend/app/mock_data/legal_requests/` are seeded automatically at startup
(idempotent; set `CASEFLOW_SEED_ON_STARTUP=false` to disable). Interactive API
docs are at `http://localhost:8000/docs`.

## Repository layout

```
backend/    FastAPI application and tests (Python)
frontend/   React + Vite + TypeScript SPA shell
caseflow_codex_handoff_docs_v3_six_agent_visibility/   source handoff documents
CASEFLOW_APPLICATION_BUILD_PLAN_FOR_REVIEW.md          implementation plan and PR roadmap
```

## Current state (PR 1)

PR 1 implements the deterministic application foundation the ADK agents plug
into in PR 2:

- typed Pydantic domain models (`backend/app/models/`)
- workflow state machine and code-enforced approval policy
  (`backend/app/orchestration/`)
- single-path audit service over an append-only local repository — an audit
  write failure blocks the state transition
- local JSON repositories (legal requests, audit, response records, storage)
- deterministic request extraction (strips LERS-template placeholder text),
  special-handling checker, and deficiency detection
- six seeded synthetic scenarios (A–F) and an idempotent mock-data loader
- APIs: request queue/detail/intake, extract, validate, review, approve,
  escalate, send-to-qa (internal handoff only), audit timeline, global audit
  query, and a minimal governance summary

Intentionally deferred to PR 2+: the deterministic six-agent ADK workflow,
`AgentRun` persistence, agent-run/agent-activity endpoints, response package
and deficiency-response drafting, Gemini, retrieval/Agent Search, GCP
adapters, and the frontend workflow screens.

## Roadmap

The PR sequence and full build plan live in
[CASEFLOW_APPLICATION_BUILD_PLAN_FOR_REVIEW.md](CASEFLOW_APPLICATION_BUILD_PLAN_FOR_REVIEW.md)
(§18–§19).
