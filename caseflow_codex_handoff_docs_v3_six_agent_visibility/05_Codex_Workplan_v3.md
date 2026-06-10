# CaseFlow Agent — Codex Workplan v2

## Workplan strategy

Codex should build this in controlled passes. Do not ask Codex to build the whole app in one request.

## Pass 1 — Context ingestion and technical plan

### Goal

Codex reads all v2 docs and produces a build plan. No implementation yet.

### Required output

1. final MVP scope
2. repo structure
3. Story Capture reuse decision
4. data model list
5. API endpoint list
6. mock data plan
7. six-agent implementation plan
8. local/GCP adapter plan
9. testing plan
10. first PR scope
11. unresolved questions

## Pass 2 — Deterministic request workflow scaffold

### Goal

Build the workflow without Gemini.

### Scope

- FastAPI app
- local repositories
- request models
- response package models
- workflow state machine
- approval policy
- audit service
- deterministic extraction placeholder
- deterministic classification placeholder
- deterministic response package draft placeholder
- mock data for 6 scenarios
- governance summary endpoints

### Done when

- Scenario A can run end-to-end using mock services.
- No external credentials required.
- All state-changing actions write audit events.

## Pass 3 — Agent contracts

### Goal

Implement six visible agent services as typed contracts.

### Agents

1. Indexing Agent
2. Triaging Agent
3. ETL Agent
4. Note Taking and Data Entry Agent
5. Text Content Agent
6. Automation Agent

### Supporting services

- Request Extraction Service
- Sensitive / Special Handling Checker
- QA / Guardrail Service
- Governance Insights Service

### Done when

- every agent has input/output schemas
- every agent emits audit metadata
- every agent can run in mock/deterministic mode
- UI/API can show each agent's status

## Pass 4 — Gemini integration

### Goal

Add Gemini via `google-genai`.

### Scope

- GeminiClient
- ModelRouter
- PromptLoader
- structured output validation
- repair/retry path
- prompt versions
- mock model tests
- golden scenario tests with mock outputs

### Done when

- no model calls appear directly in route handlers
- no model IDs hardcoded in agents
- all Gemini outputs validate or escalate

## Pass 5 — Retrieval and evidence

### Goal

Add local evidence retrieval and Agent Search-ready abstraction.

### Scope

- SOP retrieval
- routing rule retrieval
- deficiency rule retrieval
- response template retrieval
- product domain taxonomy retrieval
- sensitive registry retrieval
- evidence references in outputs

### Done when

- all classifications and drafts include evidence references
- local retrieval is testable
- Agent Search adapter can be added later

## Pass 6 — UI integration

### Goal

Wire frontend to backend.

### Screens

- Governance & Insights
- Request Queue
- Work Needing Attention
- Request Detail
- Extracted Fields
- Six-Agent Workflow
- Response Package Draft
- Human Review
- Audit Timeline
- Audit Detail

### Done when

- user can complete Scenario A
- user can view Scenario B deficiency handling
- user can view Scenario C escalation handling
- user can see all six agents working

## Pass 7 — Deployment path

### Goal

Prepare Cloud Run deployment.

### Scope

- Dockerfile
- env vars
- local/prod config split
- Cloud Run notes
- IAP plan
- Firestore adapter skeleton
- Cloud Storage adapter skeleton
- structured logging

### Done when

- container builds
- no secrets committed
- local mode still works
