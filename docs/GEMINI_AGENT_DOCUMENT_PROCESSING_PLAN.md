# Gemini agent document processing plan

## Purpose

This document lists the step-by-step updates needed to move CaseFlow from
deterministic/mock processing to fully Gemini-backed document processing using
Google's SDKs and ADK agents, while preserving the current human-led legal
workflow guardrails.

No source-code changes are made by this document. It is an implementation plan
for a future branch.

## Current state on `develop`

- The UI calls backend APIs, including `POST /api/legal-requests/{id}/agents/run`,
  rather than rendering only static fixtures.
- The backend runs six named Google ADK agents through
  `backend/app/orchestration/agent_execution_service.py`.
- Those agents process seeded synthetic request data and synthetic responsive
  records deterministically by default.
- `CASEFLOW_MODEL_MODE` defaults to `deterministic` in `backend/app/config.py`.
- `ModelAssist` is constructed only for `mock_model` or `gemini` modes in
  `backend/app/api/deps.py`.
- `backend/app/llm/gemini_client.py` is an opt-in Google GenAI wrapper, but the
  six rail agents are still deterministic `BaseAgent` subclasses, not true
  Gemini `LlmAgent` implementations.
- `backend/pyproject.toml` already includes `google-genai` as an optional
  `gemini` extra, while `README.md` still says no `google-genai` dependency is
  declared. That documentation should be reconciled.

## Official references checked

- Google recommends the Google GenAI SDK as the official production-ready
  Gemini API library and lists Python installation as `pip install google-genai`:
  https://ai.google.dev/gemini-api/docs/libraries
- Gemini supports direct document/PDF input through file parts, including local
  file bytes and URL-fetched bytes:
  https://ai.google.dev/gemini-api/docs/file-input-methods
- Gemini structured outputs support JSON Schema and Python Pydantic schemas,
  which fits the existing Pydantic model contracts:
  https://ai.google.dev/gemini-api/docs/structured-output
- Gemini function calling can connect model reasoning to external tools/APIs:
  https://ai.google.dev/gemini-api/docs/function-calling
- ADK `LlmAgent` is the Gemini-backed agent class for reasoning, instructions,
  tool use, and model-driven output:
  https://adk.dev/agents/llm-agents/
- ADK supports Gemini models directly for agents:
  https://adk.dev/agents/models/google-gemini/
- ADK graph workflows provide explicit step-wise process control and support
  graph nodes that can include agents, tools, code functions, and human input:
  https://adk.dev/graphs/routes/
- ADK graph data handling uses Events, output, message, and state for structured
  transfer between nodes:
  https://adk.dev/graphs/data-handling/
- ADK function tools can wrap Python functions and infer schemas from type
  hints and docstrings:
  https://adk.dev/tools-custom/function-tools/

## Target result

The target is not "let Gemini do everything." The target is:

1. Source documents are ingested as real document inputs, not only seeded JSON.
2. Gemini-powered ADK agents produce typed outputs for extraction,
   classification, note drafting, response-package drafting, QA validation, and
   governance insight tasks.
3. Deterministic code remains the authority for safety-critical steps:
   approval policy, workflow state transitions, ETL retrieval limits,
   finalization eligibility, audit persistence, and any send/release boundary.
4. Every model output is validated against existing Pydantic schemas before it
   can affect request state.
5. Every model-backed run records model id, prompt version, latency, validation
   result, evidence ids, and fallback status.
6. The UI clearly distinguishes deterministic, mock-model, and live-Gemini runs.

## Non-negotiable guardrails

- No agent can approve, finalize, release, disclose, or send a response.
- No direct route handler should call Gemini; model access must stay behind
  dependency-injected clients/agents.
- Model output must be draft-only until human review.
- Deterministic fallback must remain available for local development, CI, demo,
  and model failure.
- Real credentials must come only from environment/secret manager, never from
  committed files.
- Legal workflow state changes must remain code-enforced outside the LLM layer.
- Responsive production data retrieval must remain deterministic and scoped;
  Gemini may classify, draft, and explain, but must not invent record counts or
  production records.

## Step-by-step implementation plan

### 1. Reconcile repo documentation and config truth

Update documentation before implementation so engineers know the intended
runtime modes.

Required updates:

- Fix `README.md` to say `google-genai` is present as an optional `gemini`
  extra, not absent.
- Keep `docs/DEPLOYMENT.md` as the primary deployment/runtime mode reference.
- Add a short mode table:
  - `deterministic`: no model client, current default.
  - `mock_model`: credential-free model path using canned outputs.
  - `gemini`: live Google GenAI/Gemini calls.
- Document required live variables:
  - `CASEFLOW_MODEL_MODE=gemini`
  - `CASEFLOW_GEMINI_API_KEY`
  - `CASEFLOW_MODEL_DEFAULT`
  - optional `CASEFLOW_MODEL_OVERRIDES__<TASK>`
- Document the intended model-assisted tasks:
  - `request_extraction`
  - `triage_classification`
  - `note_drafting`
  - `response_package_drafting`
  - `deficiency_response_drafting`
  - `qa_validation`
  - `governance_insights`

Acceptance criteria:

- A developer can tell from docs alone which modes make outbound model calls.
- Docs no longer contradict `backend/pyproject.toml`.
- The docs explicitly state that Gemini mode is draft-only and human-gated.

### 2. Lock current deterministic behavior with regression tests

Before replacing or wrapping any agent behavior, pin the current deterministic
outputs and guardrails.

Required test coverage:

- Full deterministic rail still produces six persisted `AgentRun` records.
- Every agent run writes exactly one audit event.
- ETL stays synthetic/mock-only and read-only in deterministic mode.
- Approval, send-to-QA, finalization, and dual-control rules do not change.
- Request-detail UI still renders deterministic runs with no model metadata.
- Existing golden scenarios remain stable.

Acceptance criteria:

- Current backend test suite passes before any Gemini work begins.
- Golden scenario tests are explicit about which fields are allowed to change
  when `model_mode=gemini` is later enabled.

### 3. Define the document ingestion contract

Create a real document input layer so Gemini can process legal documents
instead of only seeded JSON.

Required design decisions:

- Add a `DocumentIngestionService` interface with local implementation first.
- Support PDF and text inputs with MIME type, byte size, checksum, source URI,
  and upload timestamp.
- Store original bytes through the existing `StorageRepository` abstraction.
- Create a `DocumentReference` or equivalent model that links a legal request to
  one or more source documents.
- Preserve current seeded JSON fixtures as test fixtures, but make them derived
  from document ingestion or clearly marked fixture shortcuts.
- Add document-size handling:
  - inline bytes for local/small PDFs within Gemini's direct input limits;
  - file upload or storage-backed strategy for larger/frequently reused docs.

Acceptance criteria:

- A test can create a request from a local PDF/text fixture.
- The request retains document provenance and checksum.
- No document bytes are placed directly in audit events or frontend payloads.
- Existing synthetic fixture seeding still works.

### 4. Split extraction into deterministic fixture path and Gemini document path

The current extraction service maps fixtures. Add a live extraction path that
uses the original document text/PDF as Gemini input and validates against the
existing request models.

Required updates:

- Keep `RequestExtractionService` as the public service boundary.
- Add a Gemini-backed implementation or strategy behind that boundary.
- Use `google-genai` document input for PDFs/text.
- Request structured output matching existing Pydantic models:
  - requesting agency
  - legal process type
  - legal authority
  - requested period
  - subject identifiers
  - requested data categories
  - product domains
  - special handling flags
  - source spans/evidence ids
- Validate Gemini output with existing Pydantic models before saving.
- If validation fails:
  - make one repair attempt;
  - fall back to deterministic/fixture behavior when available;
  - otherwise mark extraction incomplete and require human review.

Acceptance criteria:

- `CASEFLOW_MODEL_MODE=gemini` can extract fields from a real test document.
- Invalid Gemini JSON cannot be saved into the request aggregate.
- Source spans or fallback evidence terms are retained for UI traceability.
- Extraction failure is visible in API response and audit trail.

### 5. Convert model-assisted rail agents from post-processing to first-class `LlmAgent` behavior

The current `ModelAssist` re-drafts deterministic output after each agent
executes. To fully use Gemini agents, the relevant agents should become
Gemini-backed ADK `LlmAgent` nodes or composed ADK nodes that use `LlmAgent`
for reasoning and deterministic tools for bounded data access.

Recommended migration by agent:

- Indexing Agent:
  - Gemini may summarize document structure, detect sections, and propose
    evidence references.
  - Deterministic code should still assign stable evidence ids and persist
    source links.
- Triaging Agent:
  - Gemini may classify legal process/category and explain rationale.
  - Deterministic policy still evaluates low confidence, sensitive parties,
    routing rules, and review reasons.
- ETL Agent:
  - Keep deterministic. Gemini must not retrieve or fabricate responsive
    records.
  - Gemini can optionally explain query limitations in a drafted rationale.
- Note Taking and Data Entry Agent:
  - Gemini can draft internal notes from validated request fields and evidence.
  - Output must validate as `NoteDraft`.
- Text Content Agent:
  - Gemini can draft narrative sections of deficiency responses, SME
    notifications, summaries, and response-package text.
  - Record index, counts, chain of custody, and certification status remain
    deterministic.
- Automation Agent:
  - Keep deterministic. It may prepare next-action suggestions only from
    validated state.

Acceptance criteria:

- Gemini-backed agents run as ADK agent nodes, not only as an after-the-fact
  text rewrite.
- The rail still returns six official agent names in the same order.
- The UI still receives `AgentRun` records from the repository, not ADK session
  scratch state.
- Safety-critical agents remain deterministic or deterministic-dominant.

### 6. Introduce ADK tools for bounded repository and SOP access

Use ADK function tools where model reasoning needs access to repo-owned data,
but keep the tools narrow and read-only.

Candidate tools:

- `get_request_context(legal_request_id)`: returns validated request fields.
- `get_source_document_excerpt(document_id, span_or_terms)`: returns bounded
  snippets, not whole documents by default.
- `get_sop_rule(rule_id)`: returns SOP/routing/response-package rule metadata.
- `list_responsive_record_summary(legal_request_id)`: returns deterministic
  counts and record references only.
- `get_prior_agent_output(agent_id)`: returns latest validated upstream run.

Tool constraints:

- Tools should not mutate workflow state.
- Tools should not expose secrets.
- Tools should return typed JSON-compatible objects.
- Tool docstrings and type hints must be precise because ADK uses them to build
  tool schemas.

Acceptance criteria:

- Tool calls are visible in logs or run metadata.
- Tool results are bounded, typed, and testable.
- Agents cannot call tools that approve, send, release, or finalize anything.

### 7. Replace prompt placeholders with contract-specific prompts

The existing prompt files should become production-quality task prompts.

Required prompt work:

- Define one prompt per model task, with version metadata.
- Include:
  - role and allowed scope;
  - input schema summary;
  - output schema summary;
  - legal workflow guardrails;
  - evidence requirements;
  - uncertainty behavior;
  - no-finalization/no-send instruction;
  - instruction to avoid inventing responsive records.
- Include examples for:
  - normal LERS request;
  - missing date range;
  - overbroad multi-product request;
  - sensitive/special-handling request;
  - no responsive records;
  - model uncertainty requiring human review.

Acceptance criteria:

- Each prompt has a version and task id.
- Prompt version is stamped on each model-backed `AgentRun`.
- Prompt changes are reviewable independently of code changes.

### 8. Standardize structured-output validation per task

Build on existing `ModelAssist` validation discipline, but make it explicit for
every Gemini-backed task.

Required updates:

- Maintain a task-to-schema registry for every Gemini output.
- Use Pydantic/JSON Schema structured output where the SDK supports it.
- Validate response text with Pydantic anyway, even if schema-constrained
  generation is enabled.
- Preserve deterministic evidence ids and source spans when merging model
  output.
- For invalid output:
  - perform exactly one repair attempt;
  - mark `validation_status=model_output_invalid` after the second failure;
  - retain deterministic output if available;
  - require human review.

Acceptance criteria:

- Unit tests cover valid, invalid-then-valid, invalid-twice, and malformed JSON
  responses for every model task.
- No invalid model output reaches the request aggregate.
- Failed model attempts are auditable.

### 9. Add runtime controls and safe local defaults

Gemini should be explicit to enable and safe to disable.

Required updates:

- Keep `deterministic` as the default mode.
- Keep `mock_model` for credential-free CI and demos.
- Add a startup health/readiness check for `gemini` mode:
  - API key present;
  - model id present;
  - optional dependency installed;
  - model client can be constructed.
- Add per-task model override support to docs and tests.
- Add a dry-run mode that builds prompts and validates schemas without calling
  Gemini.
- Decide whether API-key Gemini is sufficient for local/dev and whether Cloud
  Run should use service-account/Vertex-backed auth later.

Acceptance criteria:

- App fails fast with actionable errors when Gemini mode is misconfigured.
- CI never requires credentials.
- Local deterministic mode continues to run with zero outbound calls.

### 10. Add observability and audit fields for live model runs

The app already logs model-related metadata on persisted runs. Expand that into
a complete live Gemini audit surface.

Required metadata:

- model mode
- model id
- prompt task
- prompt version
- response schema version
- retry count
- validation status
- latency
- token counts when available
- tool calls when available
- fallback status
- safety/block reason where applicable
- evidence ids used in prompt and output

Acceptance criteria:

- `AgentRun` API responses expose enough metadata for the UI to show live-model
  provenance.
- Audit events remain concise and do not store raw document text or secrets.
- Logs can answer: which model processed which request, with which prompt, and
  what validation outcome?

### 11. Update UI labels for live Gemini processing

The UI currently emphasizes synthetic/mock data. It should distinguish three
things:

- data source: synthetic fixture, uploaded test document, or future production
  source;
- processing mode: deterministic, mock model, or live Gemini;
- review state: draft, needs review, accepted, sent back, blocked.

Required updates:

- Add visible model-mode badges on agent cards or the workflow rail.
- Show model id and prompt version in the agent detail inspector.
- Show validation fallback status when Gemini output fails and deterministic
  output is retained.
- Keep synthetic/mock labels for synthetic data even when Gemini processes it.
- Add UI test fixtures for Gemini-backed runs.

Acceptance criteria:

- A reviewer can tell whether a run was deterministic, mock-model, or Gemini.
- A reviewer can tell whether the input data was still synthetic.
- UI copy does not imply live production data unless production data adapters
  actually exist.

### 12. Add end-to-end Gemini smoke tests behind an explicit opt-in

Live Gemini tests should exist, but must not run in normal CI.

Test lanes:

- Unit tests with fake/scripted model client: always run.
- Integration tests with `mock_model`: always run.
- Live Gemini smoke tests: run only when credentials and explicit env flag are
  present.

Suggested live smoke scenarios:

- Extract fields from a small PDF fixture.
- Run triage classification on extracted fields.
- Draft a note from validated fields.
- Draft a deficiency response for missing date range.
- Verify ETL remains deterministic and synthetic.
- Verify audit/model metadata appears on every model-backed run.

Acceptance criteria:

- Normal CI remains credential-free.
- Live smoke tests fail clearly when Gemini output violates schema.
- Tests prove no agent can finalize/send after live Gemini processing.

### 13. Add failure-mode and abuse-case tests

Gemini integration should be tested against predictable failure patterns.

Required cases:

- malformed JSON
- schema-valid but legally unsafe recommendation
- invented product domain
- invented responsive record
- missing evidence id
- prompt injection inside uploaded legal document
- oversized document
- transient API error
- rate-limit/resource-exhausted error
- missing/invalid API key

Acceptance criteria:

- Unsafe model output is rejected or downgraded to human review.
- Prompt-injection text in source documents cannot override system guardrails.
- Oversized documents return actionable errors.
- API failures do not corrupt request state.

### 14. Decide deployment/auth path for real environments

For local work, API-key Gemini mode is enough. For shared or production-like GCP
deployment, decide whether to keep Gemini API key auth or use Google Cloud
service-account/Vertex-backed auth, depending on the target environment.

Required deployment updates:

- Define secret storage and injection path.
- Define Cloud Run environment variables.
- Define egress/network expectations.
- Define cost/rate-limit budget.
- Define logging retention and redaction policy.
- Define whether document bytes can leave local storage for Gemini processing.

Acceptance criteria:

- Deployment docs state exactly how Gemini credentials are supplied.
- Misconfigured deployment fails before accepting requests.
- Legal/security review signs off on document-processing data flow.

### 15. Roll out behind explicit flags

Use staged rollout rather than flipping the default.

Rollout sequence:

1. Keep default `deterministic`.
2. Land fake-client and mock-model tests.
3. Enable Gemini extraction only behind `CASEFLOW_MODEL_MODE=gemini`.
4. Enable Gemini triage/note/text drafting one task at a time.
5. Add UI model-mode visibility.
6. Run live smoke tests manually in a controlled environment.
7. Decide whether demo environments can use `gemini` by default.
8. Only after acceptance, consider changing non-local defaults.

Acceptance criteria:

- Each task can be enabled/disabled independently by configuration.
- Reverting to deterministic mode is a config change, not a code rollback.
- Demo and local workflows remain stable without credentials.

## Suggested implementation order by PR

### PR 1: Documentation and guardrail baseline

- Reconcile `README.md` and `docs/DEPLOYMENT.md`.
- Add deterministic regression tests for existing behavior.
- Add explicit model-mode UI/API metadata expectations to tests.

### PR 2: Document ingestion contract

- Add document reference/storage model.
- Add PDF/text fixture ingestion.
- Preserve seeded fixture compatibility.

### PR 3: Gemini extraction path

- Add Gemini-backed extraction strategy behind `RequestExtractionService`.
- Validate with Pydantic schemas.
- Add fake-client, mock-model, and optional live smoke tests.

### PR 4: ADK `LlmAgent` migration for model-assisted agents

- Introduce Gemini-backed ADK agent nodes for Indexing, Triaging, Note Taking,
  and Text Content.
- Keep ETL and Automation deterministic.
- Preserve `AgentRun` repository as source of truth.

### PR 5: Tooling, prompt hardening, and observability

- Add ADK function tools for bounded SOP/document/request access.
- Version prompts.
- Expand run metadata and UI model provenance.

### PR 6: Live Gemini test lane and deployment hardening

- Add opt-in live tests.
- Add Cloud Run/Gemini secret docs.
- Add rate-limit, timeout, and failure-mode handling.

## Verification checklist for the full migration

- Deterministic mode runs with zero credentials and zero outbound model calls.
- Mock-model mode runs credential-free and exercises schema validation.
- Gemini mode processes a real PDF/text fixture through extraction and the rail.
- Every model output validates against a Pydantic schema before persistence.
- ETL never invents records and never uses Gemini to decide record counts.
- Agents cannot approve, finalize, release, disclose, or send.
- UI shows data source, processing mode, model id, prompt version, and fallback
  status.
- Audit and logs identify model, prompt, evidence, validation result, and
  fallback outcome.
- Live smoke tests are opt-in and skipped without credentials.
- Deployment docs state credential, secret, cost, and data-flow requirements.

## Open decisions before implementation

- Which Gemini model should be the default for each task?
- Should shared environments use API-key auth or Google Cloud
  service-account/Vertex-backed auth?
- What maximum document size should CaseFlow accept before requiring alternate
  file upload/storage handling?
- Are uploaded legal documents allowed to leave the local environment for
  Gemini processing in the intended demo/deployment environment?
- Should live Gemini be used only for extraction/drafting first, or for all
  model-assisted tasks in one release?
- What latency and cost budgets are acceptable for a full six-agent run?
