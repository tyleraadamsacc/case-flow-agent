# CaseFlow Agent Application Build Plan

**Status:** Draft for review — no application code has been written yet.
**Date:** 2026-06-10
**Source package:** `caseflow_codex_handoff_docs_v3_six_agent_visibility/` (17 individual docs + combined master, all read in full)
**Repo baseline at planning time:** `/Users/tyler.a.adams/CaseFlow` contains only the handoff docs directory. There is no application code, no `package.json`, no Python project, and the directory is **not yet a git repository**.

---

## 1. Executive summary

We are building **CaseFlow Agent**: a GCP-native, human-led, agentic workflow prototype for Google Legal Investigations Support (LIS) / LERS-style legal request processing. It is a controlled workflow tool — explicitly **not** a chatbot and **not** autonomous legal processing.

**The MVP scope** is a single end-to-end demo-quality workflow over synthetic data:

```
LERS request intake → request extraction → indexing → triage/classification
→ validation/deficiency detection → route or escalation recommendation
→ mock ETL / responsive record simulation → note drafting
→ response package drafting (or deficiency response drafting)
→ human review and approval → audit trail → governance insights
```

**The key workflow actors are the six RFP agents**, which leadership requires to be first-class, named, and visible — not hidden backend plumbing:

1. **Indexing Agent** — indexes the request by legal process, product/domain, identifiers, SOP matches, and priority.
2. **Triaging Agent** — classifies request type, urgency, sensitivity, queue, and SME review need.
3. **ETL Agent** — simulates an approved responsive data pull from a mock repository (read-only, synthetic only).
4. **Note Taking and Data Entry Agent** — drafts structured internal notes and fields to update.
5. **Text Content Agent** — drafts the response package, deficiency response, SME notification, or production summary.
6. **Automation Agent** — prepares (never executes) route, escalation, assignment, QA sampling, or follow-up actions.

Each agent will exist as a named backend module with typed input/output schemas, will appear by official RFP name in a **Six-Agent Workflow Rail** in the UI, will produce a structured `AgentRun` record returned by the API, will write an inspectable audit event, and will be counted in a governance **Agent Activity / RFP Agent Coverage** module.

**Why deterministic/local-first first:** The handoff docs (05, 06, 12, 14) are explicit: the deterministic workflow must pass before Gemini is added. Building deterministic agents against mock data first means (a) the workflow state machine, approval policy, and audit trail are testable to 100% pass rates with no flaky LLM behavior; (b) the app runs locally with zero GCP credentials, which is a hard requirement; (c) the six-agent visibility requirement can be demoed early and reliably; and (d) Gemini becomes a swap-in behind already-validated schemas, so structured-output failures degrade to the deterministic path plus human review rather than breaking the demo.

**How GCP/Gemini integrate later:** Every external dependency sits behind an adapter interface from day one — `ModelClient` (mock → Gemini via `google-genai`), `RetrievalService` (local JSON corpus → Agent Search / Vertex AI Search), repositories (local JSON → Firestore), storage (local files → Cloud Storage), auth (mock local user → IAP/Workspace identity). Model IDs are config-driven through a `ModelRouter`; no agent or route handler ever calls Gemini directly. Cloud Run deployment is prepared at the end (Dockerfile, env split) without breaking local mode.

**Synthetic data only.** All requests, agencies, identifiers, records, and people are synthetic. The UI labels everything mock/synthetic. No production write-back adapters exist in the MVP at all.

---

## 2. Source documents reviewed

All 17 individual documents plus the combined master were read in full. Note: the files are named `_v3` but their internal headers say "v2"; the content is consistent across both and includes the six-agent visibility requirements, so the file contents are treated as authoritative (see Risk table, §20).

| Document | How it informs the build |
|---|---|
| `00_README_Codex_Handoff_Package_v3.md` | Frames the v2→v3 pivot from email triage to LERS request intake → response package workflow; lists core guardrails and the recommended immediate build path (mock data first, deterministic workflow, six visible agents, governance, Gemini last). |
| `01_Product_Brief_and_Source_of_Truth_v3.md` | Product statement, source-of-truth hierarchy, MVP scope (13 numbered capabilities), out-of-scope list, primary users, open questions, and the required six-agent demo coverage (Scenario A shows all six). |
| `02_LERS_Request_and_Response_Template_Analysis.md` | Defines the input document shape (intake fields, requested data categories, special handling flags) and the output contract (response package sections: header, agency, identifiers, production summary, record index, field definitions, chain of custody, certification). Also requires placeholder/instruction-text filtering during extraction. |
| `03_Synthetic_Data_and_Demo_Scenarios.md` | The six synthetic scenarios (A–F), example request/record JSON payloads, the mock data file tree, the six-agent demo coverage matrix, and the required `agent_runs` mock structure. |
| `04_Target_GCP_Architecture_v3.md` | Architecture diagram, MVP-vs-later GCP service map, local-first adapter interface list, model router task list, retrieval corpora layout, required per-agent-run metadata, and architecture guardrails (approval policy in code, no production write-back adapters in MVP). |
| `05_Codex_Workplan_v3.md` | The staged pass structure (plan → deterministic scaffold → agent contracts → Gemini → retrieval → UI → deployment) with done-when criteria per pass; directly shapes §5 phases and §19 PR roadmap. |
| `06_Backend_Foundation_Scaffold_Spec_v3.md` | Concrete backend directory layout, workflow state list, approval policy trigger list, mock service behaviors, audit event field list, and the six required mock scenarios. Basis of §6 and §7. |
| `07_Data_Model_and_API_Contracts_v3.md` | JSON shapes for core objects (LegalRequest, LegalProcess, ProductionPackage, etc.) and the full API route list including governance endpoints. Basis of §8 and §9. |
| `08_Agent_Contracts_and_Behavior_v3.md` | Per-agent purposes, roles, example output JSON, guardrails, the universal agent output requirements (`agent_name`, `confidence`, `rationale`, `evidence_ids`, `requires_human_review`, `risk_flags`, `audit_metadata`), and the UI-safe agent run summary contract. Basis of §10. |
| `09_Gemini_Retrieval_and_Response_Drafting_v3.md` | Gemini-backed task list, prompt file list, structured output validation + repair/retry/block path, drafting guardrails, evidence reference model, config-driven model routing. Basis of §15 and §16. |
| `10_Governance_Insights_and_Audit_Spec_v3.md` | Executive metrics, product/domain segmentation, work-needing-attention triggers, audit event taxonomy, audit readiness tracking, data confidence labels, agent coverage metrics, audit filter-by-agent requirement. Basis of §14. |
| `11_UI_Workflow_and_Screen_Requirements_v3.md` | The ten required screens, Six-Agent Workflow Rail card contents and sequence, response package agent provenance mapping, governance Agent Activity module, and UI language guardrails ("Draft", "Pending approval"; never "Send automatically"). Basis of §13. |
| `12_Testing_Evaluation_and_Golden_Scenarios_v3.md` | Twelve golden scenarios, required assertions per stage, evaluation metric targets (100% on schema validity, audit coverage, approval gates), test commands, and the six-agent visibility test list. Basis of §17. |
| `13_Definition_of_Done_v3.md` | Six-agent visibility acceptance gate, product/agent/guardrail/GCP/demo definitions of done, and the leadership "where are the six agents in 10 seconds" acceptance test. Basis of §21. |
| `14_First_PR_Scope_v3.md` | Exact first PR contents: models, endpoints, six-agent scaffold, six mock scenarios, test list, exclusions, and acceptance criteria including the six-agent acceptance criteria. Basis of §18. |
| `15_Story_Capture_Reuse_Analysis_Instructions_v3.md` | Instructs a read-only reuse analysis of the AI Story Capture backend (`/Users/tyler.a.adams/AxARepos/ai-story-capture-develop-worktree`) for FastAPI/config/logging/genai-wrapper/router/prompt-loader/repository patterns. Treated as a Phase 0 input task — not yet performed (see §20 open questions). |
| `16_Six_Agent_Visibility_and_Demo_Requirements.md` | The hard six-agent requirement: exact official names, workflow rail sequence, per-agent UI proof, per-agent required audit events (including `workflow_action_prepared` for the Automation Agent), governance coverage module, scenario coverage, six-agent definition of done, and the demo talk track. |
| `00_Combined_Codex_Handoff_Master_v3.md` | Verified to be a concatenation of the 17 individual docs with no unique content; individual docs used as source of truth per instruction. |

---

## 3. Key product requirements

| Requirement area | What the prototype must do |
|---|---|
| **Legal request intake** | Present a queue of LERS-style legal requests (synthetic). Each request carries a source document reference, requesting agency, legal process, identifiers, requested data categories, requested period, special handling flags, and legal authorities. |
| **Extraction** | Parse the request package into structured fields: legal process type, court/jurisdiction, agency/officer, subject identifiers (account, Gmail, device ESN/IMEI/MEID/MAC), requested data categories, date range, legal authorities (e.g., 18 U.S.C. §2703, §§3122/3123, C.R.S. §16-3-301), deadlines (35-day production, 14-day service), and special handling (sealed, non-disclosure, no adverse action, pen register, trap and trace, ongoing access). Extraction must ignore template placeholder/instruction text ("PLEASE DELETE", "YOUR NAME HERE"). |
| **Indexing** | The Indexing Agent labels and ranks the request: primary labels, product/domain tags, legal process tags, priority rank, SOP matches, confidence. |
| **Triage / classification** | The Triaging Agent classifies request type, request category, product/domain(s), urgency tier, sensitivity, target queue, SME review need, missing fields, and complexity — with confidence and rationale. |
| **Validation / deficiency detection** | Detect missing/invalid date ranges, missing identifiers, and overbroad scope as typed `DeficiencyFinding` objects with severity and suggested resolution. Blocking deficiencies halt the ETL/production path and trigger the deficiency-response path. |
| **Route / escalation recommendation** | Recommend a queue/owner; sensitive or risky requests get SME escalation recommendations. Routes are recommendations only — humans approve. |
| **Mock ETL** | The ETL Agent simulates an approved responsive data pull from a local mock repository: query type, data sources checked, record count, data confidence label (`synthetic_mock`), and explicit limitations. Read-only, mock-only in MVP. |
| **Note drafting** | The Note Taking and Data Entry Agent drafts intake/classification/routing/deficiency/response-prep/decision notes plus a `fields_to_update` map, always `requires_human_approval: true`. |
| **Response package drafting** | The Text Content Agent drafts a production package following the Template LERS Response structure: header (request ID, production ID, date produced), requesting agency, subject identifiers, production summary, index of produced records, data field definitions, chain of custody, production certification — always status `draft_pending_analyst_review`. A deficiency response draft is produced instead for deficient requests; a no-responsive-records package for empty ETL results. |
| **Human review** | An analyst can review, edit, approve, request changes, escalate to SME, or send to QA — for route, note, response package, deficiency response, escalation, and any simulated production state. Approval policy is enforced in code. |
| **Governance insights** | A dashboard shows volume by product/domain, processing time (AHT/TAT), SLA risk, backlog, bottlenecks, deficiency rate, SME escalation rate, response package status, human override rate, audit coverage — plus a mandatory **Agent Activity / RFP Agent Coverage** module proving all six agents run. |
| **Auditability** | Every agent action and every human action writes an `AuditEvent` with actor, action, before/after state, evidence IDs, and confidence. The audit timeline is filterable by agent. A missing audit event blocks finalization. |
| **Six-agent visibility** | All six RFP agents appear in the UI by official name in a workflow rail; each acts on request data, produces structured output, and writes an inspectable audit event. Governance shows per-agent activity. A leadership reviewer must be able to answer "where are the six agents?" within 10 seconds. |
| **Synthetic data** | Six seeded scenarios (A–F) with synthetic requests, records, SOPs, routing rules, registries, and taxonomies. No real PII, no real LE data. All data labeled synthetic/mock. |
| **Local-first architecture** | The entire MVP runs locally with no GCP credentials. GCP services (Gemini, Firestore, Cloud Storage, Agent Search, IAP) integrate later via adapters. Structured logging from the start. |

---

## 4. Non-negotiable guardrails

These are enforced **in code** (approval policy, state machine, QA/guardrail service), not just in prompts or UI copy.

**The application must never:**

1. Automate any Law Enforcement disclosure step.
2. Release records automatically.
3. Send a final response (email or otherwise) automatically. No endpoint like `/send-final-response` may exist.
4. Make a final legal determination (legal sufficiency, validity of process).
5. Mark a production package, certification, or chain of custody as "final" by agent action.
6. Write to production Google systems (Cases, LERS, email, data stores) in MVP — production write-back adapters must not exist in the codebase.
7. Use real user data, real PII, or real law enforcement data.
8. Pull data from any real backend — ETL is mock-only and read-only.
9. Behave as a generic chatbot — all agent behavior is bounded workflow capability.
10. Show UI copy like "Send automatically" or "Production released by agent."

**The application must always:**

11. Require human approval for: route, note, response package, deficiency response, escalation, QA handoff, and any simulated production state transition.
12. Force human review when any of these hold: legal process is a search warrant; pen register requested; trap and trace requested; non-disclosure requested; no-adverse-action requested; sealed order; location tracking requested; content requested; overbroad product/domain scope; missing required identifier; missing/invalid date range; low classification confidence; SOP conflict; production package drafted; deficiency response drafted; chain-of-custody/certification generated; audit exception.
13. Write an audit event for **every** agent action and **every** human action; block finalization if an audit event is missing or the audit write fails.
14. Run fully locally without live GCP credentials; all GCP integrations adapter-based and swappable.
15. Keep Gemini output advisory/draft-only; Gemini never owns workflow state or approvals.
16. Label all synthetic/mock data and show data confidence labels.
17. Keep approval policy in code, not only in prompts.
18. Use the six official RFP agent names exactly; never collapse them behind a generic "AI workflow service" label.
19. Use config-driven model routing; no hardcoded model IDs; no direct Gemini calls from route handlers.
20. Commit no secrets; local env via `.env.local` (gitignored).

---

## 5. Recommended implementation strategy

Staged, local-first, deterministic-first. Each phase produces something runnable and testable; Gemini and GCP come last because the docs require the deterministic workflow to pass before adding them, and because the demo's credibility depends on the state machine, approval gates, and audit trail — not on live model calls.

**Phase → PR mapping (updated per reviewer direction):** Phase 0 ships alone as **PR 0** (application skeleton only — no domain code). Phase 1 ships as **PR 1** (deterministic backend foundation). Phase 2 plus the agent-facing parts of Phase 3 ship as **PR 2** (six-agent workflow and `AgentRun` visibility). See §18–§19 for the full split.

| Phase | Goal | Main tasks | Deliverables | Dependencies | Done when |
|---|---|---|---|---|---|
| **Phase 0 — Confirm repo baseline and create skeleton** | A working empty project, dev tooling, and (optionally) Story Capture reuse findings | `git init` + first commit of docs/plan; create `backend/` Python project (FastAPI, Pydantic v2, pytest, ruff) with `pyproject.toml`; `frontend/` Vite + React + TypeScript scaffold; `Makefile` (`make dev`, `make test`, `make test-unit`, `make test-api`, `make test-golden`); `.gitignore` + `.env.local.example`; structured logging config; *optional input:* run the Story Capture reuse analysis per doc 15 | Repo skeleton, Makefile, CI-less local test runner, README stub | None | `make test` runs (even if trivially), `uvicorn` serves `/healthz`, `npm run dev` serves a placeholder page, no credentials needed |
| **Phase 1 — Deterministic backend workflow** | Core domain: models, state machine, approval policy, audit service, repositories | All Pydantic models (§8); `WorkflowStateMachine` with the doc-06 state list and legal transitions; `ApprovalPolicy` (doc-06 trigger list); `AuditService` + `LocalJsonAuditRepository`; `LocalJsonLegalRequestRepository`; `RequestExtractionService` (deterministic: reads pre-extracted mock fields); deficiency/validation service; routes for queue/detail/extract/classify/validate/review/audit | Typed domain layer + first API routes + unit tests | Phase 0 | A request can move `request_received → … → analyst_review_pending` via API with every transition writing an audit event; invalid transitions rejected; tests pass |
| **Phase 2 — Six-agent service layer** | The six RFP agents as named, typed, deterministic workflow actors | `agents/` package with one module per agent; shared `AgentRun` envelope; `CaseFlowOrchestrator` running the rail sequence Indexing → Triaging → ETL → Note/Data → Text Content → Automation; per-agent audit events; `GET /api/legal-requests/{id}/agent-runs`; agent-runs included on request detail | Six agent modules, orchestrator, agent-run API, agent contract tests | Phase 1 | Scenario A produces six `AgentRun` records with official names, structured outputs, confidences, evidence IDs, and six audit events; blocked agents (ETL in B/C/D) appear as `blocked` runs with reasons |
| **Phase 3 — Mock data and golden scenarios** | Credible synthetic dataset and deterministic golden tests | Six scenario JSON files (doc 03 layout); mock GPS records (8 for A, 0 for F); SOP/routing/deficiency/response-template/special-handling rule files; sensitive party registry; product/domain taxonomy; mock data loader seeding repositories at startup; golden scenario test suite (12 scenarios from doc 12) | `mock_data/` tree, seed loader, `make test-golden` green | Phases 1–2 | All 12 golden scenarios pass deterministically; Scenario A end-to-end via API includes all six agents; extraction ignores placeholder text |
| **Phase 4 — Frontend workflow UI** | Analyst-facing request lifecycle screens | React SPA: Request Queue, Request Detail (two-column source + extracted fields), **Six-Agent Workflow Rail** (hard requirement), Response Package Draft, Deficiency Response Draft, Human Review (approve/changes/escalate/QA), shared agent-card component; API client; mock-data banners | Working SPA against local backend | Phases 1–3 | A user can run Scenario A start-to-finish in the browser, see all six agent cards with status/output/audit links, and approve the package; Scenario B shows the deficiency path; Scenario C shows escalation |
| **Phase 5 — Governance and audit views** | Leadership-facing visibility | Governance summary/product-volume/processing-time/bottlenecks/agent-activity/work-needing-attention/audit-readiness endpoints + `GovernanceMetricsService`; Governance & Insights screen with **Agent Activity / RFP Agent Coverage** module; Work Needing Attention screen; Audit Timeline (filterable by agent) and Audit Detail screens | Governance API + 4 screens | Phases 1–4 | Governance shows volume/AHT/SLA/deficiency/escalation/override/audit-coverage metrics with data-confidence labels; agent coverage shows runs/blocked/audit-events for all six agents; audit timeline filters by agent name |
| **Phase 6 — Gemini integration** | Real model behind validated schemas | `GeminiClient` wrapper over `google-genai`; `ModelRouter` (task → model from config); `PromptLoader` + versioned prompt files; structured output validation with one repair retry then block + human review; `MockModelClient` for tests; wire extraction, triage, note drafting, response/deficiency drafting, QA validation, governance insights to model mode behind a config flag | Model layer + prompts + Gemini-mode integration tests (mock-model in CI) | Phases 1–3 (UI not required) | With `MODEL_MODE=gemini` and a key, drafts come from Gemini and still validate; with no key, deterministic mode unchanged; no model IDs in agent files; no model calls in route handlers; invalid outputs blocked + audited |
| **Phase 7 — GCP adapters and deployment path** | Cloud Run-ready, swappable persistence | Dockerfile (multi-stage, serves SPA + API); env/config split (local vs GCP mode); Firestore repository skeletons; Cloud Storage repository skeleton; Agent Search retrieval adapter skeleton; IAP/auth plan notes; structured logs verified to include request ID/agent/model/prompt version/evidence/confidence/latency/outcome | Container build, adapter skeletons, deployment notes | Phases 1–6 | `docker build` succeeds; container runs in local mode with zero credentials; no secrets committed; switching adapters is config-only |
| **Phase 8 — Demo polish** | Leadership demo readiness | Demo seed script (reset + load scenarios); demo walkthrough doc with the six-agent talk track; UI polish on the rail and governance coverage module; "where are the six agents in 10 seconds" check; synthetic-data labeling sweep; final DoD checklist run | Demo script, polish, DoD sign-off | All prior | A presenter can run the doc-13 leadership acceptance test: click one request and show all six agents' input, output, review requirement, and audit event |

**Why this order:** Models/state-machine/audit (Phase 1) before agents (Phase 2) because every agent writes audit events and obeys the approval policy — the safety substrate must exist first. Agents before mock data finalization (Phase 3) so scenario fixtures are shaped by real agent contracts rather than guessed. Backend complete before UI (Phase 4) so the rail renders real `AgentRun` payloads. Governance (Phase 5) after the workflow generates events to aggregate. Gemini (Phase 6) only after golden tests lock the schemas it must satisfy. GCP adapters (Phase 7) last because nothing in the demo depends on them.

---

## 6. Proposed repository structure

No existing code conventions to align to (repo is empty), so we adopt the doc-06 backend layout under a `backend/` root, with a sibling `frontend/`:

```text
CaseFlow/
  CASEFLOW_APPLICATION_BUILD_PLAN_FOR_REVIEW.md   # this plan
  caseflow_codex_handoff_docs_v3_six_agent_visibility/   # source docs (unchanged)
  README.md
  Makefile                       # dev, test, test-unit, test-api, test-golden, seed, demo
  .gitignore
  .env.local.example             # documented env vars; real .env.local is gitignored

  backend/
    pyproject.toml               # fastapi, pydantic v2, uvicorn, pytest, httpx, ruff
    app/
      main.py                    # FastAPI app factory + router registration
      config.py                  # pydantic-settings; APP_MODE, MODEL_MODE, model task map
      logging_config.py          # structured JSON logs + request/correlation IDs
      api/
        deps.py                  # DI: repositories, services, orchestrator, current mock user
        routes/
          health.py
          legal_requests.py
          extraction.py
          classification.py      # index / classify / validate / route-recommendation
          etl.py
          notes.py
          production_package.py  # production package + deficiency response drafts
          review.py              # review / approve / escalate / send-to-qa
          agent_runs.py
          audit.py
          governance.py
      models/                    # one Pydantic model per file (see §8)
        legal_request.py  legal_process.py  requesting_agency.py
        subject_identifier.py  requested_data_category.py  product_domain.py
        requested_period.py  special_handling.py  legal_authority.py
        deficiency_finding.py  classification_result.py  routing_recommendation.py
        production_package.py  responsive_record.py  chain_of_custody.py
        certification.py  note_draft.py  text_draft.py
        human_review.py  approval_decision.py  audit_event.py
        workflow_state.py  governance_metric.py  agent_run.py  evidence.py
      orchestration/
        caseflow_orchestrator.py
        workflow_state_machine.py
        approval_policy.py
      agents/
        base.py                  # AgentRun envelope helpers, audit emission, names registry
        indexing_agent.py
        triaging_agent.py
        etl_agent.py
        note_data_entry_agent.py
        text_content_agent.py
        automation_agent.py
      services/
        request_extraction_service.py
        sensitive_special_handling_service.py
        deficiency_service.py
        routing_rules_service.py
        sop_retrieval_service.py        # RetrievalService interface + local impl
        response_record_service.py
        response_package_service.py
        qa_guardrail_service.py
        audit_service.py
        governance_metrics_service.py
        governance_insights_service.py
      llm/                        # Phase 6
        model_client.py           # ModelClient protocol + MockModelClient
        gemini_client.py          # GeminiClient (google-genai)
        model_router.py
        prompt_loader.py
        output_validation.py      # validate → one repair retry → blocked result
      repositories/
        legal_request_repository.py        # interface
        local_legal_request_repository.py
        firestore_legal_request_repository.py   # Phase 7 skeleton
        audit_repository.py
        local_audit_repository.py
        firestore_audit_repository.py           # Phase 7 skeleton
        response_record_repository.py
        local_response_record_repository.py
        storage_repository.py
        local_storage_repository.py
        cloud_storage_repository.py             # Phase 7 skeleton
      prompts/
        caseflow/
          request_extraction.md
          indexing.md
          triage_classification.md
          note_draft.md
          production_package_draft.md
          deficiency_response_draft.md
          qa_guardrail.md
          governance_insights.md
      mock_data/
        legal_requests/
          scenario_a_gps_happy_path.json
          scenario_b_missing_date_range.json
          scenario_c_pen_register_nondisclosure.json
          scenario_d_overbroad_all_google_data.json
          scenario_e_subscriber_info_common.json
          scenario_f_no_responsive_records.json
        response_records/
          gps_records_scenario_a.json
          empty_records_scenario_f.json
        sop/
          request_intake_sop.json
          routing_rules.json
          deficiency_rules.json
          response_package_rules.json
          special_handling_rules.json
        registries/
          sensitive_party_registry.json
          product_domain_taxonomy.json
        seed.py                  # loads scenarios into local repositories
    tests/
      unit/                      # models, state machine, approval policy, services, agents
      api/                       # endpoint tests via httpx TestClient
      golden/                    # 12 golden scenarios incl. six-agent visibility tests
      conftest.py

  frontend/
    package.json                 # Vite + React 18 + TypeScript
    src/
      api/client.ts              # typed API client
      types/                     # mirrors backend response schemas
      components/
        AgentRunCard.tsx         # shared six-agent card
        SixAgentWorkflowRail.tsx
        MockDataBanner.tsx
        ApprovalBanner.tsx
        AuditEventLink.tsx
      screens/
        GovernanceInsights.tsx   # incl. AgentActivityModule.tsx
        RequestQueue.tsx
        WorkNeedingAttention.tsx
        RequestDetail.tsx        # incl. ExtractedFields panel + rail
        ResponsePackageDraft.tsx
        DeficiencyResponseDraft.tsx
        HumanReview.tsx
        AuditTimeline.tsx
        AuditDetail.tsx
    tests/                       # Vitest component tests; Playwright e2e later

  deploy/
    Dockerfile                   # Phase 7
    cloud_run_notes.md           # Phase 7: env vars, IAP plan, no-secrets checklist
  claudedocs/                    # analyses/reports (per workspace conventions)
```

**Frontend framework decision:** Docs allow React or Angular "depending on repo context and fastest prototype path." There is no existing repo context. **Recommendation: React 18 + TypeScript + Vite** — fastest scaffold-to-screen path, simplest component model for the agent-card/rail pattern, and the largest ecosystem for the table/timeline components this UI needs. (Open question only if the team has an Angular house standard — see §20.)

---

## 7. Backend build plan

| Module / file | Purpose | Depends on | Build phase |
|---|---|---|---|
| `app/main.py` | FastAPI app factory; mounts routers; startup hook runs mock-data seed in local mode; CORS for local SPA | config, routes | 0–1 |
| `app/config.py` | `pydantic-settings` config: `APP_MODE` (local/gcp), `MODEL_MODE` (deterministic/mock_model/gemini), per-task model map (`request_extraction`, `triage_classification`, `note_drafting`, `response_package_drafting`, `deficiency_response_drafting`, `qa_validation`, `governance_insights`), data dirs, log level | — | 0 |
| `app/logging_config.py` | Structured JSON logging; injects request ID/correlation ID; later: agent, model ID, prompt version, evidence IDs, confidence, latency, outcome fields | config | 0 |
| `app/api/deps.py` | Dependency wiring: repositories by `APP_MODE`, services, orchestrator, mock current user (`analyst@local`, role `analyst`) | repositories, services | 1 |
| `app/api/routes/health.py` | `GET /healthz` | — | 0 |
| `app/api/routes/legal_requests.py` | Queue list, detail (incl. `agent_runs`), create | repos, models | 1 |
| `app/api/routes/extraction.py` | `POST .../extract` | RequestExtractionService | 1 |
| `app/api/routes/classification.py` | `POST .../index`, `.../classify`, `.../validate`, `.../route-recommendation` | Indexing/Triaging agents, deficiency service | 1–2 |
| `app/api/routes/etl.py` | `POST .../etl/simulate`, `GET .../responsive-records` | ETL Agent, response record repo | 2 |
| `app/api/routes/notes.py` | `POST .../notes/draft` | Note Taking and Data Entry Agent | 2 |
| `app/api/routes/production_package.py` | `POST .../production-package/draft`, `GET .../production-package`, `POST .../deficiency-response/draft` | Text Content Agent, response package service | 2 |
| `app/api/routes/review.py` | `POST .../review`, `.../approve`, `.../escalate`, `.../send-to-qa` | approval policy, state machine, audit service | 1 |
| `app/api/routes/agent_runs.py` | `GET .../agent-runs`; `POST .../agents/run` (run full rail for a request) | orchestrator | 2 |
| `app/api/routes/audit.py` | `GET .../audit`, `GET /api/audit/events?agent=` (agent filter required) | audit repo | 1, filter in 5 |
| `app/api/routes/governance.py` | Summary, work-needing-attention, product-volume, processing-time, bottlenecks, audit-readiness, agent-activity, response-package-status | governance metrics service | 5 |
| `app/models/*` (24 files) | Typed Pydantic domain models — see §8 | — | 1 |
| `app/orchestration/workflow_state_machine.py` | Encodes the doc-06 state list and legal transitions; rejects invalid transitions; every transition emits an audit event | models, audit service | 1 |
| `app/orchestration/approval_policy.py` | Pure-code policy: given request + agent outputs, returns `human_review_required` + reasons from the doc-06 trigger list; consulted before any approve/finalize transition | models | 1 |
| `app/orchestration/caseflow_orchestrator.py` | Runs the six-agent rail in sequence for a request; records `AgentRun` per agent (incl. `blocked` runs with reasons, e.g., ETL blocked on deficiency); never auto-approves | agents, state machine, approval policy, audit | 2 |
| `app/agents/base.py` | Agent protocol: `run(input) -> AgentRun`; registry of official names/IDs; helpers that stamp `agent_id`, `agent_name`, `schema_version`, audit metadata and write the audit event | models, audit service | 2 |
| `app/agents/indexing_agent.py` | Indexing Agent (see §10) | base, SOP retrieval | 2 |
| `app/agents/triaging_agent.py` | Triaging Agent (see §10) | base, routing rules, special handling service | 2 |
| `app/agents/etl_agent.py` | ETL Agent (see §10) | base, response record repo | 2 |
| `app/agents/note_data_entry_agent.py` | Note Taking and Data Entry Agent (see §10) | base | 2 |
| `app/agents/text_content_agent.py` | Text Content Agent (see §10) | base, response package service | 2 |
| `app/agents/automation_agent.py` | Automation Agent (see §10) | base, approval policy | 2 |
| `app/services/request_extraction_service.py` | Deterministic MVP: loads pre-extracted fields from scenario JSON and filters placeholder text; Phase 6: Gemini-backed extraction validated to schema | repos; later llm/ | 1, 6 |
| `app/services/sensitive_special_handling_service.py` | Deterministic detection of sealed/non-disclosure/no-adverse-action/pen-register/trap-and-trace/ongoing-access/location/content/tombstone flags; emits `special_handling_checked` audit event | models, audit | 1 |
| `app/services/deficiency_service.py` | Applies `deficiency_rules.json`: missing date range, missing identifier, overbroad scope → typed `DeficiencyFinding`s | mock rules | 1 |
| `app/services/routing_rules_service.py` | Loads `routing_rules.json`; maps classification → queue/owner with evidence IDs | mock rules | 2 |
| `app/services/sop_retrieval_service.py` | `RetrievalService` interface + `LocalSopRetrievalService` over the local corpus; returns `EvidenceReference`s; Phase 7: `AgentSearchRetrievalService` skeleton | mock data | 2, 7 |
| `app/services/response_record_service.py` | Mock query over `response_records/`; labels everything `synthetic_mock` | response record repo | 2 |
| `app/services/response_package_service.py` | Assembles `ProductionPackage` draft per Template LERS Response structure; status always `draft_pending_analyst_review` | models, records | 2 |
| `app/services/qa_guardrail_service.py` | Validates: missing fields, disclosure risk, unsupported claims, missing approval, audit completeness; emits `qa_validation_completed` or `finalization_blocked` | audit repo, approval policy | 2 |
| `app/services/audit_service.py` | Single write path for `AuditEvent`s; write failure raises and blocks the calling transition | audit repo | 1 |
| `app/services/governance_metrics_service.py` | Aggregates repositories into the §14 metric set with data-confidence labels | repos | 5 |
| `app/services/governance_insights_service.py` | Deterministic templated insights in MVP; Gemini-synthesized in Phase 6 | metrics service | 5, 6 |
| `app/llm/*` | ModelClient protocol, MockModelClient, GeminiClient, ModelRouter, PromptLoader, output validation/repair | config | 6 |
| `app/repositories/*` | Interfaces + local JSON implementations (request, audit, response record, storage); Firestore/Cloud Storage skeletons | models | 1 (local), 7 (GCP) |
| `app/prompts/caseflow/*.md` | Versioned prompt files (front-matter: version, task, output schema ref) | — | 6 |
| `app/mock_data/*` + `seed.py` | Six scenarios, records, SOPs/rules, registries, taxonomy; idempotent seed | models | 3 |
| `tests/unit`, `tests/api`, `tests/golden` | See §17 | all | 1–6 |

---

## 8. Data model plan

All models are Pydantic v2, one per file, each with `schema_version`. Enums for states, agent IDs, audit actions, deficiency codes, and data-confidence labels live beside the models.

| Model | Purpose | Key fields | Notes |
|---|---|---|---|
| `LegalRequest` | Root aggregate for one LERS-style request | `legal_request_id`, `source_type`, `date_received`, `workflow_state`, `requesting_agency`, `legal_process`, `subject_identifiers[]`, `requested_data_categories[]`, `product_domains[]`, `requested_period`, `special_handling`, `legal_authorities[]`, `deficiency_findings[]`, `raw_source_uri`, `owner`, `urgency_tier`, `agent_runs{}` | `agent_runs` keyed by agent ID is required on the detail API response (doc 14) |
| `LegalProcess` | The legal instrument | `type` (Search Warrant / Ex Parte Order / Subpoena / Court Order / Pen Register / Trap and Trace), `court_order_included`, `ex_parte_order`, `pen_register`, `trap_and_trace`, `location_tracking`, `stored_communications` | Drives approval policy triggers |
| `RequestingAgency` | Who is asking | `agency`, `case_number`, `officer`, `contact_email`, `phone`, `address` | Synthetic values only |
| `SubjectIdentifier` | One extracted identifier | `type` (account_id / gmail / google_id / device_esn / imei / meid / mac / customer_reference), `value`, `confidence`, `source_span` | `source_span` enables UI highlight of extracted text |
| `RequestedDataCategory` | One requested data category | `category`, `product_domain`, `sensitivity` (low/medium/high), `content_type`, `requires_sme_review` | Categories from doc 02 (subscriber info → tombstone archive) |
| `ProductDomain` | Taxonomy entry | `domain_id`, `name`, `description`, `default_queue`, `sensitivity_default` | 13 domains from doc 10 (Gmail … Tombstone archive); loaded from `product_domain_taxonomy.json` |
| `RequestedPeriod` | Date range under request | `start`, `end`, `valid`, `issues[]` | `valid=false` + issue feeds `DeficiencyFinding` |
| `SpecialHandlingFlags` | Risk/sensitivity flags | `sealed`, `non_disclosure_to_subscriber`, `no_adverse_action`, `pen_register_requested`, `trap_and_trace_requested`, `ongoing_access_requested`, `location_tracking_requested`, `content_requested`, `tombstone_requested`, `production_deadline_days`, `service_deadline_days`, `nondisclosure_period` | First-class model per doc 02; every flag maps to a review trigger |
| `LegalAuthority` | Cited statute/rule | `citation` (e.g., "18 U.S.C. §2703"), `description`, `source_span` | Extraction assertion target |
| `DeficiencyFinding` | One detected deficiency | `code` (missing_date_range / missing_identifier / overbroad_scope / invalid_period / …), `severity` (blocking/warning), `message`, `requires_human_review`, `suggested_resolution` | Blocking severity halts ETL/production path |
| `ClassificationResult` | Triaging Agent output payload | `legal_process_type`, `request_category`, `product_domains[]`, `urgency_tier`, `sensitivity`, `recommended_queue`, `complexity`, `missing_fields[]`, `confidence`, `human_review_required`, `review_reasons[]`, `rationale`, `evidence_ids[]` | Doc 08 shape |
| `RoutingRecommendation` | Recommended route/escalation | `target_queue`, `target_owner`, `escalation_target` (e.g., "SME Review"), `reason`, `sla_risk`, `requires_approval`, `evidence_ids[]`, `status` (`recommended_pending_human`) | Never auto-applied |
| `ProductionPackage` | Response package draft | `request_id`, `production_id`, `date_produced`, `requesting_agency`, `subject_identifiers`, `production_summary` (start/end/total_responsive_records/ordinary-course statement), `records[]`, `field_definitions[]`, `chain_of_custody`, `certification`, `status`, `risk_flags[]`, `section_provenance{}` | `status` enum has **no agent-reachable "final"**; `section_provenance` maps each section to the producing agent for the UI provenance view (doc 11) |
| `ResponsiveRecord` | One mock record | `record_id`, `timestamp_utc`, `latitude`, `longitude`, `accuracy_meters`, `source`, `data_confidence` (`synthetic_mock`) | GPS shape from docs 02/03; extensible for subscriber-info records |
| `ChainOfCustody` | Custody block of the package | `collection_date`, `collection_method`, `collected_by`, `review_status` | Always drafted, never agent-finalized |
| `Certification` | Certification block | `authorized_representative`, `title`, `certification_text`, `status` (`draft_pending_approval`) | Agent may only draft |
| `NoteDraft` | Note Taking and Data Entry Agent output | `note_type` (request_intake_note / classification_note / routing_rationale / deficiency_note / response_prep_note / analyst_decision_note), `body`, `fields_to_update{}`, `missing_fields[]`, `requires_human_approval` | `requires_human_approval` always `true` |
| `TextDraft` | Text Content Agent output | `draft_type` (production_package / deficiency_response / sme_notification / production_summary / no_responsive_records), `sections{}`, `status` (`draft_not_final`), `requires_human_approval`, `evidence_ids[]` | `status` literal-typed to `draft_not_final` in MVP |
| `HumanReview` | A review action record | `review_id`, `legal_request_id`, `target_type` (route/note/production_package/deficiency_response/escalation/qa), `reviewer_id`, `role`, `action` (approve/request_changes/escalate/send_to_qa), `edits{}`, `comments`, `timestamp` | Edits captured to compute human-override metrics |
| `ApprovalDecision` | The approval gate result | `approval_id`, `legal_request_id`, `target_type`, `decision`, `decided_by`, `policy_reasons[]`, `timestamp`, `audit_event_id` | Referenced by `AuditEvent.approval_id`; required before any "approved" state |
| `AuditEvent` | One immutable audit record | `audit_event_id`, `legal_request_id`, `timestamp`, `actor_type` (system/agent/service/human), `actor_id`, `action` (taxonomy enum, §14), `before_state`, `after_state`, `summary`, `evidence_ids[]`, `confidence`, `approval_id`, `correlation_id` | Doc 06 field list; append-only repository |
| `WorkflowState` | Enum + transition metadata | States: `request_received, request_extracted, request_indexed, request_classified, request_validated, route_recommended, etl_simulated, note_drafted, response_package_drafted, deficiency_response_drafted, analyst_review_pending, analyst_approved, escalated, sent_to_qa, changes_requested, audit_complete` | Doc 06 state list; deficiency branch at the drafting step |
| `GovernanceMetric` | One computed metric | `metric_id`, `title`, `value`, `unit`, `dimension` (product_domain/agent/legal_process/...), `period`, `data_confidence` (fully_tracked/partially_tracked/estimated/synthetic_mock/unavailable), `evidence_ids[]` | Data-confidence label mandatory (doc 10) |
| `AgentRun` | One agent execution envelope | `agent_run_id`, `agent_id` (indexing_agent/…), `agent_name` (official RFP name), `legal_request_id`, `status` (waiting/running/complete/blocked/needs_review/failed), `input_summary`, `output_summary`, `output` (typed per-agent payload), `confidence`, `rationale`, `evidence_ids[]`, `requires_human_review`, `review_reasons[]`, `risk_flags[]`, `audit_event_id`, `model_id`, `prompt_version`, `schema_version`, `input_hash`, `validation_status`, `latency_ms`, `retry_count`, `started_at`, `completed_at` | Merges doc 04 run-metadata list with doc 08 UI-safe summary; this is the single object the rail renders |
| `EvidenceReference` | Grounding pointer | `evidence_id`, `source_type` (sop/routing_rule/deficiency_rule/response_template/taxonomy/registry/mock_record), `title`, `snippet`, `confidence` | Doc 09 shape; used by all agents and governance insights |

---

## 9. API plan

All under `/api` except health. Every `POST` that changes state writes audit event(s) and returns them (or their IDs) in the response. No send/release/finalize endpoints exist.

**Naming conflict to resolve:** doc 07 lists `GET /api/governance/agent-performance`; doc 14 (first PR) lists `GET /api/governance/agent-activity`. **Recommendation: use `agent-activity` as canonical** (it matches the six-agent visibility language in docs 10/11/16); do not ship both.

| Endpoint | Method | Purpose | Request body | Response | Phase |
|---|---|---|---|---|---|
| `/healthz` | GET | Liveness; reports `APP_MODE`/`MODEL_MODE` | — | `{status, mode}` | 0 |
| `/api/legal-requests` | GET | Request queue with filter/sort (state, product domain, urgency, deficiency, special handling) | — | `LegalRequest[]` (summary projection) | 1 |
| `/api/legal-requests` | POST | Create/ingest a synthetic request; writes `request_ingested` | `LegalRequest` (intake subset) | `LegalRequest` + audit event | 1 |
| `/api/legal-requests/{id}` | GET | Request detail incl. extracted fields, deficiencies, **`agent_runs` for all six agents** | — | `LegalRequest` (full) | 1–2 |
| `/api/legal-requests/{id}/extract` | POST | Run extraction; writes `request_extracted` | `{}` | extracted fields + deficiencies + audit event | 1 |
| `/api/legal-requests/{id}/index` | POST | Run **Indexing Agent**; writes `request_indexed` | `{}` | `AgentRun` (indexing payload) | 2 |
| `/api/legal-requests/{id}/classify` | POST | Run **Triaging Agent**; writes `request_classified` | `{}` | `AgentRun` (`ClassificationResult`) | 2 |
| `/api/legal-requests/{id}/validate` | POST | Deficiency + special handling check; writes `special_handling_checked` | `{}` | `DeficiencyFinding[]` + flags + audit event | 1 |
| `/api/legal-requests/{id}/route-recommendation` | POST | Produce `RoutingRecommendation`; writes `route_recommended` | `{}` | `RoutingRecommendation` + audit event | 2 |
| `/api/legal-requests/{id}/etl/simulate` | POST | Run **ETL Agent** (mock only); writes `etl_simulated` (or blocked run) | `{}` | `AgentRun` (ETL payload) | 2 |
| `/api/legal-requests/{id}/responsive-records` | GET | List mock records pulled for the request | — | `ResponsiveRecord[]` (all `synthetic_mock`) | 2 |
| `/api/legal-requests/{id}/notes/draft` | POST | Run **Note Taking and Data Entry Agent**; writes `note_drafted` | `{note_type?}` | `AgentRun` (`NoteDraft`) | 2 |
| `/api/legal-requests/{id}/production-package/draft` | POST | Run **Text Content Agent** (production package); writes `production_package_drafted` | `{}` | `{production_package, requires_human_approval: true, risk_flags, audit_event}` per doc 07 | 2 |
| `/api/legal-requests/{id}/production-package` | GET | Current draft package incl. `section_provenance` | — | `ProductionPackage` | 2 |
| `/api/legal-requests/{id}/deficiency-response/draft` | POST | Run **Text Content Agent** (deficiency response); writes `deficiency_response_drafted` | `{}` | `TextDraft` + audit event | 2 |
| `/api/legal-requests/{id}/agents/run` | POST | Orchestrator runs the full six-agent rail (each step still gated/blocked per policy) | `{}` | `AgentRun[]` (six entries, blocked steps included) | 2 |
| `/api/legal-requests/{id}/agent-runs` | GET | All `AgentRun`s for the request (rail data source) | — | `AgentRun[]` | 2 |
| `/api/legal-requests/{id}/review` | POST | Record `HumanReview` (approve/request_changes with edits); writes `analyst_reviewed` | `HumanReview` (subset) | updated state + `ApprovalDecision` + audit event | 1 |
| `/api/legal-requests/{id}/approve` | POST | Approve a target (route/note/package/deficiency response); approval policy + QA guardrail enforced; writes `route_approved` / `response_package_approved` | `{target_type, comments?}` | `ApprovalDecision` + audit event | 1–2 |
| `/api/legal-requests/{id}/escalate` | POST | Escalate to SME; writes `request_escalated` | `{reason, target}` | updated state + audit event | 1 |
| `/api/legal-requests/{id}/send-to-qa` | POST | Hand off to QA review (internal workflow only — not an external send); writes `sent_to_qa` | `{reason?}` | updated state + audit event | 1 |
| `/api/legal-requests/{id}/audit` | GET | Audit timeline for one request | — | `AuditEvent[]` (chronological) | 1 |
| `/api/audit/events` | GET | Global audit query; **must support `?agent=` filter** plus action/actor/date filters | — | `AuditEvent[]` | 1 (filter by 5) |
| `/api/governance/summary` | GET | Executive metrics rollup (§14) | — | `GovernanceMetric[]` + insights | 5 |
| `/api/governance/work-needing-attention` | GET | Prioritized attention items with reasons + links to agent outputs | — | attention items | 5 |
| `/api/governance/agent-activity` | GET | **RFP Agent Coverage**: runs, blocked runs, audit events, avg confidence, overrides, scenario coverage per agent | — | per-agent activity (doc 10 shape) | 2 (counts) / 5 (full) |
| `/api/governance/product-volume` | GET | Request volume by product/domain | — | `GovernanceMetric[]` | 5 |
| `/api/governance/processing-time-by-product` | GET | AHT/TAT by product/domain and legal process | — | `GovernanceMetric[]` | 5 |
| `/api/governance/bottlenecks` | GET | Slowest workflow states / queues | — | `GovernanceMetric[]` | 5 |
| `/api/governance/audit-readiness` | GET | Audit coverage, missing review steps, exceptions | — | readiness report | 5 |
| `/api/governance/response-package-status` | GET | Draft/pending/approved counts | — | `GovernanceMetric[]` | 5 |

---

## 10. Six-agent implementation plan

Common contract for **all six agents** (enforced by `agents/base.py` and contract tests):

- Implemented as a named class in its own module under `app/agents/`.
- `run(input) -> AgentRun` where `AgentRun.output` is the agent's typed payload.
- Every output stamps: `agent_id`, official `agent_name` (exact RFP spelling), `schema_version`, `confidence`, `rationale`, `evidence_ids`, `requires_human_review`, `risk_flags`, and audit metadata.
- Every run (including blocked runs) writes exactly one audit event and stores `audit_event_id` on the run.
- Deterministic mode is the default; Gemini mode is opt-in per task via `ModelRouter` (Phase 6) — and ETL and Automation remain deterministic even then.
- Failure behavior: exceptions/validation failures produce `status: "failed"` or `"blocked"` runs with a reason, still audited; the orchestrator continues to the next non-dependent step or halts per policy — it never silently skips an agent.
- No agent can transition the workflow into an approved/final state.

### Indexing Agent

- **Role in the workflow:** First agent in the rail. Indexes and ranks the request by legal process type, requesting agency, subject identifiers, requested data categories, product/domain, legal authority, date range, special handling flags, and priority/risk, matching against SOPs.
- **Input schema:** `IndexingInput { legal_request: LegalRequest (post-extraction), sop_corpus_ref }`.
- **Output schema:** `IndexingOutput { primary_labels[], product_domains[], legal_process_tags[], priority_rank, sop_matches[], confidence }` (doc 08 shape) carried in `AgentRun.output`.
- **Deterministic MVP behavior:** Rule-driven labeling from extracted fields: legal process type → label; data category → product domain via `product_domain_taxonomy.json`; special-handling flags → risk tags; priority rank from a small rule table (e.g., pen register/non-disclosure → rank 1); SOP matches looked up in `request_intake_sop.json` by category, returning evidence IDs (e.g., `SOP-REQUEST-INTAKE-LOCATION`).
- **Future Gemini behavior:** Optional Gemini-assisted labeling via the `indexing.md` prompt for free-text requests; output validated against `IndexingOutput`, falls back to deterministic on failure. (Indexing is a low-priority Gemini candidate — deterministic indexing over extracted fields is already strong.)
- **UI representation:** First card in the Six-Agent Workflow Rail: labels as chips, priority rank, SOP/evidence matches, confidence, audit link. Display copy: *"Indexed as Search Warrant + GPS Location + Maps/Location."* Also provides the "Request metadata / labels" provenance on the Response Package screen.
- **Audit event written:** `request_indexed` (actor `indexing_agent`).
- **Failure behavior:** If extraction fields are absent → `blocked` run with reason `extraction_incomplete`; unknown category → low confidence + `requires_human_review: true` with reason `low_confidence_classification`.
- **Golden scenario coverage:** Runs in all of A–F; Scenario D must show it surfacing multiple product domains.
- **Tests required:** Unit: label/priority/SOP-match rules per scenario fixture; correct labels for A (search_warrant, gps_location, maps_location). Contract: output validates, official name exact, audit event written. Golden: A and D label assertions.

### Triaging Agent

- **Role in the workflow:** Second in the rail. Classifies the request into the correct pool: request type, request category, product/domain, urgency tier, sensitivity, SME review requirement, recommended queue, missing fields, complexity. Also the actor behind the route recommendation (audit `route_recommended`).
- **Input schema:** `TriagingInput { legal_request, indexing_output, special_handling_flags, deficiency_findings[], routing_rules_ref }`.
- **Output schema:** `ClassificationResult` (§8; doc 08 shape with `recommended_queue`, `confidence`, `human_review_required`, `review_reasons[]`).
- **Deterministic MVP behavior:** Rules over indexing output + flags: location category → `Location Data Production` / queue `Location Response Review`; subscriber info → subscriber queue; pen register/trap-and-trace/non-disclosure/sealed → sensitivity `high`, `human_review_required: true` with explicit reasons, escalation queue `SME Review`; ≥3 product domains → `overbroad_scope` review reason; fixed seeded confidences per scenario (e.g., 0.94 for A, deliberately 0.55 for golden scenario 8 "low-confidence classification").
- **Future Gemini behavior:** `triage_classification.md` prompt produces `ClassificationResult` for free-text requests; validated; one repair retry; on failure → blocked + human review. Confidence below config threshold always forces review regardless of source.
- **UI representation:** Second rail card: classification, confidence, recommended route, rationale, review-need badge. Display copy: *"Classified as Location Data Production. Route: Location Response Review. Human approval required."* Provides "Request classification / route" provenance on the Response Package screen.
- **Audit event written:** `request_classified`; when producing the routing recommendation it also writes `route_recommended`.
- **Failure behavior:** Missing indexing output → `blocked` (`awaiting_indexing`); low confidence → `needs_review` status; classification never auto-assigns the queue — `RoutingRecommendation.status` stays `recommended_pending_human`.
- **Golden scenario coverage:** All of A–F; C must show risk flagging (pen register + non-disclosure → SME review); D overbroad review; golden 8 (low confidence) and 9 (SOP conflict) target this agent.
- **Tests required:** Unit: each routing rule; each special-handling → review-reason mapping; urgency tiers. Contract tests. Golden: A route = Location Response Review with review reasons `production_package_required`; C `human_review_required` with pen-register/non-disclosure reasons; D overbroad.

### ETL Agent

- **Role in the workflow:** Third in the rail. Simulates the approved responsive data pull from the mock repository for the requested identifiers and period. **Mock-only, read-only, MVP and beyond unless separately approved.**
- **Input schema:** `EtlInput { legal_request_id, subject_identifiers[], requested_period, requested_data_categories[], approval_state }`.
- **Output schema:** `EtlOutput { query_type, data_sources_checked[], total_responsive_records, records_ref, data_confidence: "synthetic_mock", limitations[] }` (doc 08 shape).
- **Deterministic MVP behavior:** Looks up `response_records/{scenario}.json` filtered to the requested period; Scenario A returns exactly 8 GPS records; Scenario F returns 0; `limitations` always includes `"No production backend connected"`. Refuses to run (blocked) if a blocking deficiency exists (B), if SME escalation is pending (C), or if scope is overbroad without review (D).
- **Future Gemini behavior:** **None.** ETL stays deterministic permanently in the prototype; a future `ApprovedDataSourceAdapter` is out of MVP scope and must not exist as code in MVP.
- **UI representation:** Third rail card: mock query description, data sources checked, returned record count, `synthetic_mock` data-confidence badge, limitations. Display copy: *"8 synthetic GPS records found for requested period."* Blocked state shows reason (e.g., "Blocked: missing date range deficiency"). Provides "Produced record index" provenance.
- **Audit event written:** `etl_simulated` (including zero-record and blocked outcomes, with the block reason in `summary`).
- **Failure behavior:** Blocking deficiency / pending escalation / unapproved overbroad scope → `blocked` run with reason; missing mock fixture → `failed` run; both audited. Never throws past the orchestrator.
- **Golden scenario coverage:** A (8 records), F (0 records), blocked in B/C/D (visible blocked card), optional in E.
- **Tests required:** Unit: record filtering by period; count assertions (A=8, F=0); every result labeled `synthetic_mock`; blocked-on-deficiency logic. Contract tests. Golden: A and F counts; B shows ETL blocked. Guardrail: no code path reads anything outside `mock_data/`.

### Note Taking and Data Entry Agent

- **Role in the workflow:** Fourth in the rail. Drafts structured internal notes (intake, classification, routing rationale, deficiency, response-prep, analyst decision) and the `fields_to_update` map — the simulated "data entry" into the case record. Nothing is applied without approval.
- **Input schema:** `NoteInput { legal_request, classification_result, routing_recommendation?, etl_output?, deficiency_findings[], note_type }`.
- **Output schema:** `NoteDraft` (§8: `note_type`, `body`, `fields_to_update{}`, `missing_fields[]`, `requires_human_approval: true`).
- **Deterministic MVP behavior:** Template-based note assembly from upstream structured outputs, e.g., *"Search warrant received from [agency]. Request seeks GPS location records for [account] from [period]. Routed to Location Response Review."* `fields_to_update` populated from classification/routing outputs; `missing_fields` from deficiency findings. Deficiency note variant for B; escalation note for C.
- **Future Gemini behavior:** `note_draft.md` prompt for natural-language note bodies grounded in the structured fields with evidence references; validated against `NoteDraft`; fields_to_update remain deterministically derived (model never invents field values).
- **UI representation:** Fourth rail card: note draft preview, fields-to-update list, missing fields, approval-required badge. Display copy: *"Drafted case note and populated legal process, date range, and routing fields."* Provides "Internal notes / chain-of-custody fields" provenance.
- **Audit event written:** `note_drafted`.
- **Failure behavior:** Missing upstream outputs → drafts a partial note flagged `needs_review` listing the gaps; template rendering failure → `failed` run, audited.
- **Golden scenario coverage:** All of A–F (notes exist in every scenario per the doc-03 coverage matrix); golden 12 (response package edited by analyst) also exercises the decision-note path.
- **Tests required:** Unit: each note_type renders from fixtures; `requires_human_approval` always true; fields_to_update matches classification. Contract tests. Golden: A intake note content; B deficiency note references missing date range.

### Text Content Agent

- **Role in the workflow:** Fifth in the rail. Drafts all outward-shaped text artifacts: response/production package narrative (per Template LERS Response), production summary, field definitions, chain-of-custody language, certification draft, deficiency response, no-responsive-records package, SME notification. **Drafts only — never sends, never certifies final, never releases.**
- **Input schema:** `TextContentInput { legal_request, classification_result, etl_output?, responsive_records[], deficiency_findings[], draft_type, response_template_ref }`.
- **Output schema:** `TextDraft` (§8) and, for `draft_type=production_package`, the assembled `ProductionPackage` with `status: "draft_pending_analyst_review"` and `section_provenance`.
- **Deterministic MVP behavior:** Template-driven assembly from `response_package_rules.json` + the Template LERS Response structure: header (request ID, generated production ID `PROD-{request}-01`, date), agency block, identifiers, production summary (period, record count, ordinary-course statement), record index from ETL output, field definitions, chain-of-custody draft, certification draft marked pending approval. Branches: deficiency response (B, from `deficiency_rules.json` suggested-resolution text), no-records package (F), SME notification (C), clarification/review package (D).
- **Future Gemini behavior:** `production_package_draft.md` and `deficiency_response_draft.md` prompts generate narrative sections grounded in retrieved template evidence; output validated against the package schema; record index and counts are **always** taken from ETL output, never model-generated (guardrail: no unsupported records); one repair retry then block + human review.
- **UI representation:** Fifth rail card: drafted section list with approval state. Display copy: *"Drafted production summary, field definitions, chain of custody, and certification."* Feeds the Response Package Draft and Deficiency Response Draft screens, with per-section agent provenance.
- **Audit event written:** `production_package_drafted` or `deficiency_response_drafted` (per draft type).
- **Failure behavior:** Drafting attempted without ETL output for a package → `blocked` (`awaiting_etl`); template/schema failure → `failed`, audited; any validation gap → `needs_review`. The status field is type-constrained so the agent literally cannot emit a final status.
- **Golden scenario coverage:** A (full package), B (deficiency response), C (SME notification), D (clarification draft), F (no-records package); golden 12 (analyst edits the package).
- **Tests required:** Unit: package matches Template LERS Response section structure; certification marked pending; deficiency response generated for B; no-records package for F; no draft carries a final status. Contract tests. Golden: A package contains 8-record index; F summary says zero responsive records. Guardrail: record index identical to ETL output (no fabrication).

### Automation Agent

- **Role in the workflow:** Sixth and last in the rail. Prepares — never executes — the next workflow actions: route to queue, assign owner, escalate to SME, send to QA, flag SLA risk, mark response package awaiting review, create follow-up task. Output is always `status: "prepared_pending_human"`.
- **Input schema:** `AutomationInput { legal_request, classification_result, routing_recommendation, text_draft?, approval_policy_result }`.
- **Output schema:** `AutomationOutput { action_type, target, target_owner?, reason, requires_approval: true, status: "prepared_pending_human", follow_up_tasks[] }` (doc 08 shape).
- **Deterministic MVP behavior:** Rules over upstream outputs: A → prepare analyst approval task for the response package targeting `Location Response Review`; B → prepare deficiency-clarification follow-up task and hold; C → prepare SME escalation (*"Pen register and non-disclosure requested"*) + notification task; D → prepare SME review assignment; E → prepare routine queue assignment; F → prepare no-records package review task. SLA-risk flag computed from `production_deadline_days` vs. elapsed time.
- **Future Gemini behavior:** **None.** Action preparation stays deterministic — this is the safety-critical agent and the docs give it no Gemini-backed task.
- **UI representation:** Sixth rail card: prepared action, target owner/queue, reason, approval status. Display copy: *"Prepared analyst approval task and SME notification. Not executed."* Provides "Approval task / escalation / QA routing" provenance. Its prepared actions surface as the action buttons context on the Human Review screen.
- **Audit event written:** `workflow_action_prepared`. *(Conflict note: doc 16 mandates this event name; the doc 10 taxonomy omits it. Recommendation: add `workflow_action_prepared` to the taxonomy — see §14 and §20. When an analyst later confirms an escalation, the separate `request_escalated` event fires with the human/automation actor as per doc 10.)*
- **Failure behavior:** No upstream recommendation → `blocked` (`awaiting_triage`); contradictory policy state (e.g., approve requested while blocking deficiency open) → `blocked` with `policy_conflict`, audited. Executing any action is impossible by construction: the agent has no dependency on any repository write path other than its own run/audit records.
- **Golden scenario coverage:** All of A–F; C is its showcase (SME escalation preparation); golden 11 (human route override) shows its prepared route being overridden.
- **Tests required:** Unit: each scenario maps to the right prepared action; `requires_approval` always true; status always `prepared_pending_human`. Contract tests. Golden: A prepares approval task; C prepares SME escalation. Guardrail: no state transition to approved/escalated occurs from an Automation Agent run alone.

### Six-agent summary table

| Agent | Backend module | UI component | Main output | Audit event | Scenario coverage |
|---|---|---|---|---|---|
| Indexing Agent | `app/agents/indexing_agent.py` | Rail card #1 (`AgentRunCard` in `SixAgentWorkflowRail`) | `IndexingOutput` (labels, domains, priority, SOP matches) | `request_indexed` | A–F (multi-domain showcase: D) |
| Triaging Agent | `app/agents/triaging_agent.py` | Rail card #2 | `ClassificationResult` + `RoutingRecommendation` | `request_classified` (+ `route_recommended`) | A–F (risk showcase: C; overbroad: D) |
| ETL Agent | `app/agents/etl_agent.py` | Rail card #3 | `EtlOutput` + mock `ResponsiveRecord[]` | `etl_simulated` | A (8 records), F (0); blocked in B/C/D; optional E |
| Note Taking and Data Entry Agent | `app/agents/note_data_entry_agent.py` | Rail card #4 | `NoteDraft` + fields_to_update | `note_drafted` | A–F |
| Text Content Agent | `app/agents/text_content_agent.py` | Rail card #5 + Response Package / Deficiency screens | `TextDraft` / `ProductionPackage` draft | `production_package_drafted` / `deficiency_response_drafted` | A (package), B (deficiency), C (SME notice), D (clarification), F (no-records) |
| Automation Agent | `app/agents/automation_agent.py` | Rail card #6 + Human Review action context | `AutomationOutput` (prepared action) | `workflow_action_prepared` | A–F (escalation showcase: C) |

---

## 11. Supporting services plan

These are required for safety and workflow control but are **not** presented as the six RFP agents; the UI keeps them visually subordinate (per doc 08: "should not distract from the six RFP agents").

| Service | Purpose | MVP behavior | Future behavior |
|---|---|---|---|
| **CaseFlow Orchestrator** | Runs the six-agent rail in order, owns sequencing/blocking, collects `AgentRun`s; never approves anything | Deterministic in-process sequence Indexing → Triaging → ETL → Note/Data → Text Content → Automation, with per-step policy checks and blocked-step recording | Unchanged in design; could later run steps via Cloud Tasks/queues — explicitly **not** replaced by Agent Search (doc 04 guardrail) |
| **Request Extraction Service** | Turns the request document into structured fields; filters placeholder/instruction text | Reads pre-extracted fields from scenario JSON; a placeholder filter strips "PLEASE DELETE"/"YOUR NAME HERE" patterns to satisfy the doc-02 assertion | Gemini-backed extraction (`request_extraction.md`) with schema validation, `source_span`s for UI highlighting, deficiency findings emitted inline |
| **Sensitive / Special Handling Checker** | Detects sealed, non-disclosure, no-adverse-action, pen register, trap-and-trace, ongoing-access, location/content/tombstone flags | Deterministic over extracted `SpecialHandlingFlags`; writes `special_handling_checked`; feeds review reasons to Triaging and the approval policy | Stays deterministic (safety-critical); may add registry lookups (sensitive party registry) for golden scenario 7 |
| **QA / Guardrail Service** | Validates missing fields, disclosure risk, unsupported claims, missing approvals, audit completeness; blocks finalization | Deterministic checks before any approve/finalize transition; writes `qa_validation_completed` or `finalization_blocked`; the "missing audit event blocks finalization" rule lives here | Optional Gemini-assisted QA pass (`qa_guardrail.md`) **in addition to**, never instead of, the deterministic checks |
| **Governance Insights Service** | Produces narrative insights (title / what changed / why it matters / suggested action / evidence / data confidence) | Deterministic templated insights computed from metrics (e.g., the doc-10 location-SLA example) | Gemini synthesis over computed metrics (`governance_insights.md`); insights remain advisory and evidence-linked |
| **Audit Service** | The single write path for audit events; append-only | Writes to `LocalJsonAuditRepository`; write failure raises → calling transition blocked; correlation IDs threaded from the request | Firestore + Cloud Logging adapters behind the same interface |
| **Approval Policy** | Pure-code gate: who must review what, and when approval is required | Implements the full doc-06 trigger list; consulted by review/approve endpoints, the orchestrator, and the QA service; returns reasons used in UI badges | Unchanged; configurable thresholds (e.g., confidence cutoff) via config, never via prompts |
| **Workflow State Machine** | Legal state transitions only | Doc-06 state list; transition table rejects anything else; every transition writes an audit event; deficiency branch supported | Unchanged; persisted state moves to Firestore behind the repository interface |
| **Local Retrieval Service** | Evidence retrieval over the local corpus (SOPs, rules, templates, taxonomy, registry) | Keyword/key-based lookup over `mock_data/` returning `EvidenceReference`s with stable IDs | `AgentSearchRetrievalService` over Vertex AI Search / Agent Search data store (`gs://caseflow-grounding/`), same interface |
| **Mock Response Record Service** | Serves synthetic responsive records | Filters scenario record files by identifier/period; labels `synthetic_mock` | None in prototype; a real `ApprovedDataSourceAdapter` is future-production-only and intentionally absent from the codebase |
| **Gemini Client wrapper** | Single owner of `google-genai` calls | Not present until Phase 6; `MockModelClient` stands in for tests | `GeminiClient` with timeouts, retries, model-metadata logging (model ID, prompt version, latency, outcome) |
| **Model Router** | Maps task → model from config | Returns `deterministic`/`mock` handlers in MVP | Maps the seven doc-04 tasks to env-configured Gemini models; no model IDs in agent code |

---

## 12. Mock data and synthetic scenario plan

All data synthetic; every identifier, agency, officer, and record is fictional. Records and metrics carry `synthetic_mock` confidence labels.

| Scenario | Purpose | Request traits | Expected workflow | Agents demonstrated | Expected output |
|---|---|---|---|---|---|
| **A — GPS location happy path** (`LER-2026-004812`) | Primary end-to-end six-agent demo | Search warrant; GPS location records; Maps/Location; account + customer ref + device ID; period May 10–15, 2026; no special handling beyond location tracking | Extract → index → classify (Location Data Production, queue Location Response Review, 0.94) → validate → route → ETL (8 records) → note → package draft → analyst approval → audit complete | **All six** complete | Full `ProductionPackage` draft (8-record index, chain of custody, certification pending), 6+ audit events, approval gate exercised |
| **B — Missing date range deficiency** (`LER-2026-004821`) | Quality control + human intervention demo | Search warrant; subscriber + location records; requested period absent/invalid | Extract partial → index → classify → validate flags `missing_date_range` (blocking) → **ETL blocked** → deficiency note → deficiency response draft → hold for analyst | Indexing, Triaging, Note/Data, Text Content, Automation; **ETL visible as blocked** | `DeficiencyFinding` (blocking), deficiency response draft pending approval, blocked ETL run card with reason |
| **C — Pen register / trap-and-trace with non-disclosure** (`LER-2026-004835`) | Safety and escalation demo | Ex parte order + pen register + trap and trace; non-disclosure, no adverse action, ongoing access | Extract → index (priority 1) → classify high-sensitivity, SME review required → ETL blocked pending escalation → escalation note → SME notification draft → Automation prepares SME escalation → block auto-response → audited reasons | Indexing, Triaging, Note/Data, Text Content (SME notification), Automation (escalation); ETL blocked | Prepared SME escalation (`prepared_pending_human`), high-risk flags, audit trail of block reasons |
| **D — Overbroad all-Google-data request** (`LER-2026-004842`) | Complexity handling demo | Search warrant; categories across Gmail, YouTube, Drive, Photos, Voice, Pay, Tombstone | Extract → index surfaces 7+ product domains → classify `overbroad_scope`, SME review required → ETL blocked → note → clarification/review draft → Automation prepares SME assignment | Indexing (multi-domain), Triaging, Note/Data, Text Content, Automation; QA/guardrail visible as control service | Multi-domain labels, overbroad deficiency/risk flag, clarification draft, SME review requirement |
| **E — Simple subscriber information request** (`LER-2026-004850`) | The 80% common case; throughput story | Legal process request; subscriber info + account creation; complete fields | Fast extract → index → classify → route → note → (ETL optional) → Automation prepares routine queue assignment | Indexing, Triaging, Note/Data, Text Content, Automation (ETL optional) | Quick route recommendation + intake note, minimal friction, approval still required |
| **F — No responsive records** (`LER-2026-004863`) | Response package variation demo | Search warrant; GPS location records; period with no matching mock data | Full path like A but ETL returns **0 records** → no-records package draft → analyst review | **All six** (ETL zero-result is a completed run) | "No responsive records" `ProductionPackage` variant pending approval; ETL card showing 0 records, `synthetic_mock` |

**Mock data files to create** (doc-03 tree, under `backend/app/mock_data/`):

- `legal_requests/scenario_{a..f}_*.json` — full `LegalRequest` payloads including pre-extracted fields, a `raw_source_text` block (with deliberate placeholder/instruction text in at least one scenario to exercise the filter), and the doc-03 `agent_runs` expectation block used by golden tests.
- `response_records/gps_records_scenario_a.json` (exactly 8 GPS records, doc-03 shape), `response_records/empty_records_scenario_f.json` (`[]`).
- `sop/request_intake_sop.json` — SOP snippets with stable evidence IDs (`SOP-REQUEST-INTAKE-LOCATION`, `SOP-SUBSCRIBER-INFO`, …).
- `sop/routing_rules.json` — classification → queue mappings with IDs (`ROUTE-LOCATION-P1`, …).
- `sop/deficiency_rules.json` — codes, severities, messages, suggested resolutions.
- `sop/response_package_rules.json` — Template LERS Response section templates and ordinary-course/certification language.
- `sop/special_handling_rules.json` — flag → review-requirement mappings.
- `registries/sensitive_party_registry.json` — synthetic sensitive senders/agencies (supports golden scenario 7).
- `registries/product_domain_taxonomy.json` — the 13 doc-10 domains with default queues and sensitivities.
- `seed.py` — idempotent loader that seeds repositories at startup in local mode and powers `make seed` / demo reset.

---

## 13. UI implementation plan

React + TypeScript + Vite SPA (decision rationale in §6). Layout: left nav (Governance, Queue, Attention, Audit), request-centric detail flow. Every screen shows a persistent **"Synthetic / mock data"** banner. UI language guardrails enforced in shared components: only "Draft", "Prepared", "Pending approval", "Human review required" — never "Send automatically" or "Production released by agent".

| Screen | Purpose | Key components | Backend data needed | Phase |
|---|---|---|---|---|
| **Governance & Insights** | Executive view: volume, time, risk, bottlenecks, agent coverage | Metric cards (incoming, backlog, SLA risk), product/domain volume chart, processing-time-by-product chart, bottleneck list, deficiency/escalation/override/audit-coverage tiles, insight panels, **AgentActivityModule** | `/governance/summary`, `/product-volume`, `/processing-time-by-product`, `/bottlenecks`, `/agent-activity`, `/audit-readiness`, `/response-package-status` | 5 |
| **Request Queue** | Analyst worklist | Sortable/filterable table: request ID, agency, legal process, product/domain, urgency, deficiency status, special-handling badges, owner, next action | `GET /api/legal-requests` | 4 |
| **Work Needing Attention** | Prioritized exception list | Attention cards with reason chips (missing identifiers, missing date range, pen register/TT, non-disclosure, sealed, no adverse action, overbroad, low confidence, awaiting approval, audit exception) linking into Request Detail and the responsible agent card | `/governance/work-needing-attention` | 5 |
| **Request Detail** | One request, full context | Two-column layout — left: source request document with highlighted extracted spans (`source_span`); right: Extracted Fields panel; embedded Six-Agent Workflow Rail; state header; action bar | `GET /api/legal-requests/{id}` (incl. `agent_runs`), `/audit` | 4 |
| **Extracted Fields** (panel of Request Detail) | Show structured extraction | Field groups: legal process, identifiers, requested data categories, date range (validity), special handling flags, legal authorities, missing fields/deficiencies | extraction/validate responses | 4 |
| **Six-Agent Workflow Rail** | **HARD REQUIREMENT** — the six RFP agents as a visible sequence | `SixAgentWorkflowRail` rendering six `AgentRunCard`s in fixed order Indexing → Triaging → ETL → Note Taking and Data Entry → Text Content → Automation. Each card: official RFP name (exact), role one-liner, status (waiting/running/complete/blocked/needs review), input summary, output summary, confidence (where applicable), evidence/rationale expander, audit event link, human-review badge, timestamp, retry/error state. Restrained per-agent icon/color; **never** a generic "AI processing" label; blocked steps render with the reason rather than disappearing | `GET /api/legal-requests/{id}/agent-runs`; `POST /api/legal-requests/{id}/agents/run` | 4 |
| **Response Package Draft** | Review the drafted package | Template LERS Response sections in order (header, agency, identifiers, production summary, record index table, field definitions, chain of custody, certification), per-section **agent provenance** chips (doc 11 mapping), analyst approval banner, edit affordances, draft watermark | `GET .../production-package`, `POST .../production-package/draft` | 4 |
| **Deficiency Response Draft** | Review the clarification draft | Missing-field list, blocked reason, drafted clarification text, approval control | deficiency findings, `POST .../deficiency-response/draft` | 4 |
| **Human Review** | The decision surface | Agent recommendation summary, risk flags, editable note, editable response package, buttons: Approve route / Request changes / Escalate / Send to QA; Automation Agent's prepared action shown as context; policy reasons displayed | `POST .../review`, `/approve`, `/escalate`, `/send-to-qa`; approval-policy reasons | 4 |
| **Audit Timeline** | Every action, chronological | Event stream (ingested → extracted → indexed → classified → special handling → route → ETL → drafts → review → approval → audit complete) with actor badges; **filter by agent name** (all six selectable), action type, actor type | `GET .../audit`, `GET /api/audit/events?agent=` | 5 |
| **Audit Detail** | Governance deep-dive on one request | Source evidence, each agent decision with before/after, human decision and what changed (override diff), final state, audit completeness indicator | audit events + agent runs + reviews | 5 |

---

## 14. Audit and governance plan

### Audit event taxonomy

Doc-10 taxonomy plus `workflow_action_prepared` (required by doc 16 for the Automation Agent; flagged as a doc conflict — recommendation is to include it):

| Event | Actor | Trigger |
|---|---|---|
| `request_ingested` | system | Request enters the queue |
| `request_extracted` | request_extraction_service | Extraction completes |
| `request_indexed` | indexing_agent | Indexing Agent run |
| `request_classified` | triaging_agent | Triaging Agent run |
| `special_handling_checked` | special_handling_service | Flag check completes |
| `route_recommended` | triaging_agent | Routing recommendation produced |
| `etl_simulated` | etl_agent | Mock ETL run (incl. 0-record and blocked) |
| `note_drafted` | note_data_entry_agent | Note Taking and Data Entry Agent run |
| `production_package_drafted` | text_content_agent | Package draft produced |
| `deficiency_response_drafted` | text_content_agent | Deficiency draft produced |
| `workflow_action_prepared` | automation_agent | Automation Agent prepares an action |
| `qa_validation_completed` | qa_guardrail_service | QA checks pass |
| `analyst_reviewed` | analyst | Review recorded |
| `route_approved` | analyst | Route approved |
| `response_package_approved` | analyst | Package approved |
| `request_escalated` | analyst / automation_agent | Escalation confirmed |
| `sent_to_qa` | analyst | QA handoff |
| `finalization_blocked` | qa_guardrail_service | Guardrail block (incl. missing audit event) |
| `audit_completed` | system | Trail verified complete |

### Audit event schema

`AuditEvent` per §8: `audit_event_id`, `legal_request_id`, `timestamp`, `actor_type` (system/agent/service/human), `actor_id`, `action` (enum above), `before_state`, `after_state`, `summary`, `evidence_ids[]`, `confidence`, `approval_id`, `correlation_id`. Append-only repository; the audit service is the only write path; a failed write raises and blocks the calling transition.

### Audit timeline behavior

- Chronological per-request timeline plus a global events query.
- **Filterable by agent name** (hard requirement, doc 10) — all six agents individually selectable — plus action, actor type, and date filters.
- Each timeline entry links to the related `AgentRun`, `ApprovalDecision`, or `HumanReview`.
- `audit_completed` is only written when the QA/guardrail service verifies all required events exist for the path taken; otherwise `finalization_blocked` is written and the request appears in Work Needing Attention as an audit exception.

### Governance metrics

| Metric | Definition | Source | Data confidence in MVP |
|---|---|---|---|
| Incoming requests | Count in selected period | request repo | `synthetic_mock` |
| Open backlog | Requests not in `audit_complete` | request repo | `synthetic_mock` |
| SLA-risk requests | Open requests near `production_deadline_days` breach | request repo + deadlines | `synthetic_mock` |
| Product/domain volume | Count by the 13-domain taxonomy | classifications | `synthetic_mock` |
| AHT by request type | Avg handling time by request category | audit timestamps | `estimated` (synthetic timing) |
| TAT by legal process | Turnaround by warrant/subpoena/court order/pen register | audit timestamps | `estimated` |
| Deficiency rate | % with deficiency findings | deficiency findings | `synthetic_mock` |
| SME escalation rate | % requiring SME review | review reasons / escalations | `synthetic_mock` |
| Response package draft rate | % with agent-drafted package | packages | `synthetic_mock` |
| Human override rate | % where analyst changed agent classification/route/draft | `HumanReview.edits` diffs | `fully_tracked` |
| Audit coverage | % of required events logged | audit repo vs. required-event map | `fully_tracked` |
| Bottlenecks | Slowest states/queues by dwell time | state-transition timestamps | `estimated` |
| Response package status | Draft / pending / approved counts | package statuses | `fully_tracked` |

### Agent activity metrics (RFP Agent Coverage module — required)

| Metric | Definition |
|---|---|
| Agent runs by agent | Completed `AgentRun` count per RFP agent |
| Blocked runs by agent | Runs with status blocked/failed/needs_review per agent |
| Average confidence by agent | Mean confidence where the agent produces one |
| Human overrides by agent | Reviews whose edits changed that agent's output |
| Audit events by agent | Audit events with that agent as actor |
| Scenario coverage by agent | Which of scenarios A–F demonstrate the agent (target: every agent ≥1; A shows all six) |
| Agent output acceptance | % accepted with no/minor/major edits |

Rendered in Governance & Insights as **"RFP Agent Coverage"** listing all six agents by official name (doc 10 JSON shape).

### Data confidence labels

Every governance metric and every ETL output carries one of: `fully_tracked`, `partially_tracked`, `estimated`, `synthetic_mock`, `unavailable`. The UI renders the label next to the value.

### Work-needing-attention logic

An item is generated when any of these hold, with the reason(s) attached and a link to the responsible agent output: missing identifiers; missing/invalid date range; pen register / trap-and-trace; non-disclosure; sealed matter; no adverse action; overbroad scope; low-confidence classification; SLA risk; response package awaiting approval; audit exception (`finalization_blocked` / missing event); no responsive records requiring review. Sorted by a priority score (special-handling flags > blocking deficiencies > SLA risk > approvals pending > others).

---

## 15. Gemini integration plan

Added only after the deterministic workflow and golden tests are green (Phase 6). Gemini supports extraction, classification, drafting, validation, and insight generation; it **never** owns workflow state or approvals, and its output is always advisory/draft.

**Components:**

- **`GeminiClient`** (`app/llm/gemini_client.py`) — the single wrapper over `google-genai`. Owns auth, timeouts, retries, safety settings, and response parsing. No other module imports `google-genai`. Route handlers never call it; agents/services receive a `ModelClient` via DI.
- **`ModelRouter`** (`app/llm/model_router.py`) — maps task name → model from config/env. Tasks: `request_extraction`, `triage_classification`, `note_drafting`, `response_package_drafting`, `deficiency_response_drafting`, `qa_validation`, `governance_insights`. No hardcoded model IDs anywhere; per-task overrides via env (e.g., `MODEL__TRIAGE_CLASSIFICATION=...`).
- **`PromptLoader`** (`app/llm/prompt_loader.py`) — loads versioned prompt files from `app/prompts/caseflow/` with front-matter (`version`, `task`, `output_schema`); prompt version is logged with every call and stamped on `AgentRun.prompt_version`.
- **Structured output validation** (`app/llm/output_validation.py`) — every model response is parsed and validated against the target Pydantic schema (`IndexingOutput`, `ClassificationResult`, `NoteDraft`, `TextDraft`/package, QA result, insight).
- **Repair/retry path** — on validation failure: (1) one repair call with the validation errors appended; (2) if still invalid, return a **blocked** result; (3) mark `requires_human_review: true`; (4) write an audit event recording the failure. The deterministic output (where one exists) remains available as fallback so the demo never dead-ends.
- **Prompt files** — `request_extraction.md`, `triage_classification.md`, `note_draft.md`, `production_package_draft.md`, `deficiency_response_draft.md`, `qa_guardrail.md`, `governance_insights.md` (+ optional `indexing.md`). Each embeds the drafting guardrails (draft-only, never final, never send, distinguish synthetic records, preserve evidence references).
- **Model metadata logging** — every call logs and stamps on the `AgentRun`: model ID, prompt version, latency, retry count, input hash, validation status, outcome — satisfying the doc-04 run-metadata and doc-13 structured-log requirements.
- **Mock model mode for tests** — `MockModelClient` returns canned valid (and deliberately invalid, for repair-path tests) outputs per task. CI runs entirely on mock mode; real-Gemini integration tests are opt-in behind an env flag and never required for `make test`.

**Gemini-backed tasks and owners** (doc 09):

| Task | Agent / service |
|---|---|
| Request extraction | Request Extraction Service |
| Triage/classification (legal process + data category) | Triaging Agent |
| Note drafting | Note Taking and Data Entry Agent |
| Response package drafting | Text Content Agent |
| Deficiency response drafting | Text Content Agent |
| QA validation | QA / Guardrail Service (additive to deterministic checks) |
| Governance insight generation | Governance Insights Service |

**Not Gemini-backed:** ETL Agent (mock-only forever in prototype), Automation Agent (deterministic action preparation), approval policy, state machine, audit service.

**Mode control:** `MODEL_MODE=deterministic | mock_model | gemini` in config. Deterministic remains the default; the demo can run either way.

---

## 16. Retrieval and grounding plan

**Local retrieval first; Agent Search later. Agent Search is retrieval/grounding only — never the workflow orchestrator (doc 04 guardrail).**

**MVP — `LocalSopRetrievalService`** over the local corpus:

| Corpus | File | Used by | Example evidence IDs |
|---|---|---|---|
| SOP corpus | `mock_data/sop/request_intake_sop.json` | Indexing Agent, Triaging Agent | `SOP-REQUEST-INTAKE-LOCATION` |
| Routing rules | `mock_data/sop/routing_rules.json` | Triaging Agent, routing service | `ROUTE-LOCATION-P1` |
| Deficiency rules | `mock_data/sop/deficiency_rules.json` | Deficiency service, Text Content Agent | `DEF-MISSING-DATE-RANGE` |
| Response template rules | `mock_data/sop/response_package_rules.json` | Text Content Agent | `RESP-TEMPLATE-001` |
| Product/domain taxonomy | `mock_data/registries/product_domain_taxonomy.json` | Indexing, Triaging, governance | `TAX-MAPS-LOCATION` |
| Sensitive/special handling rules | `mock_data/sop/special_handling_rules.json` + `registries/sensitive_party_registry.json` | Special handling checker, approval policy | `SH-PEN-REGISTER`, `REG-SENSITIVE-001` |
| Mock responsive records | `mock_data/response_records/` | ETL Agent | record IDs (`GPS-0001`) |

- Every retrieval returns `EvidenceReference` objects (`evidence_id`, `source_type`, `title`, `snippet`, `confidence` — doc 09 shape).
- **Evidence IDs are stable strings** referenced by agent outputs, audit events, and governance insights, and rendered as expandable evidence in the UI. All classifications and drafts must carry evidence references (Pass-5 done-when in doc 05).
- Local retrieval is unit-testable: given a category/flag, the right evidence IDs come back.

**Later — `AgentSearchRetrievalService`** (Phase 7 skeleton, post-MVP wiring): same `RetrievalService` interface backed by Vertex AI Search / Agent Search over a `gs://caseflow-grounding/` data store (`sops/`, `routing-rules/`, `response-templates/`, `deficiency-rules/`, `product-taxonomy/`, `training-examples/`). Swap is config-only; evidence IDs map to document IDs in the data store so UI/audit behavior is unchanged.

---

## 17. Testing plan

Targets from doc 12: 100% on extraction/classification/package schema validity, special-handling recall, missing-field detection, audit coverage, approval-gate coverage, and golden-scenario pass rate in deterministic mode — all runnable locally with no credentials. Commands: `make test`, `make test-unit`, `make test-api`, `make test-golden`.

| Layer | Location | What it covers |
|---|---|---|
| **Unit tests** | `backend/tests/unit/` | Models validate/serialize; state machine accepts the legal path and rejects illegal transitions; approval policy returns the right reasons for every doc-06 trigger; deficiency rules; special-handling detection; routing rules; placeholder-text filtering; response-package assembly; per-agent deterministic logic |
| **Service tests** | `backend/tests/unit/` (service-focused) | Audit service write-failure blocks the transition; QA guardrail blocks on missing audit event/approval; governance metric computations; local retrieval returns correct evidence IDs |
| **API tests** | `backend/tests/api/` | Every §9 endpoint via `httpx` TestClient: health; queue; detail (incl. `agent_runs`); extract/index/classify/validate/route; ETL simulate; notes/package/deficiency drafts; review/approve/escalate/send-to-qa; audit timeline + global query with `?agent=` filter; governance endpoints; invalid state transition → 409; unauthorized finalization → blocked |
| **Golden scenario tests** | `backend/tests/golden/` | The 12 doc-12 scenarios run end-to-end through the orchestrator + API against seeded mock data: (1) GPS happy path, (2) missing date range, (3) pen register/TT + non-disclosure, (4) overbroad, (5) subscriber info, (6) no responsive records, (7) regulator/sensitive sender, (8) low-confidence classification, (9) SOP conflict, (10) missing audit event blocks finalization, (11) human route override, (12) response package edited by analyst |
| **Guardrail tests** | `backend/tests/golden/` + dedicated module | No autonomous send/release path exists (assert no such route is registered — scan the FastAPI route table for forbidden names/verbs); production package cannot reach an approved state without an `ApprovalDecision`; deficiency response cannot be approved without human review; ETL reads only from `mock_data/`; every draft status is non-final; missing audit event → `finalization_blocked` |
| **Agent contract tests** | `backend/tests/unit/agents/` | Parametrized over all six agents: returns a valid `AgentRun`; output validates against the agent's schema; includes `agent_id`, `agent_name` (exact official RFP spelling), `status`, `output_summary`, `audit_event_id`; writes exactly one audit event per run; blocked/failed runs are audited; no agent registered under a generic name (`ai_agent` etc. asserted absent) |
| **UI / e2e tests** | `frontend/tests/` | Vitest component tests: `SixAgentWorkflowRail` renders all six cards with official names; `AgentRunCard` shows status/output/confidence/audit link; approval banner states. Playwright e2e (Phase 4–5): run Scenario A in the browser; click evidence to reveal rationale; click audit link to open the timeline entry; governance shows the RFP Agent Coverage module |
| **Gemini integration tests (later)** | `backend/tests/llm/` | Mock-model tests for the repair/retry/block path (valid, invalid-then-repaired, invalid-twice → blocked + audited); prompt loader versioning; model router config resolution; opt-in live tests behind `GEMINI_INTEGRATION_TESTS=1`, never in default `make test` |

**Required assertions the suite must prove (explicit):**

1. All six agents return structured outputs that validate against their schemas.
2. All six agents write audit events (one per run, including blocked runs).
3. Scenario A includes all six agents — request detail exposes six `agent_runs`, audit timeline contains all six agent events.
4. No final response package can be approved without a human `ApprovalDecision`; the agent-only path can never reach an approved state.
5. No autonomous send/release exists — route-table scan plus absence of any production write adapter.
6. A missing audit event blocks finalization (`finalization_blocked` written; state not `audit_complete`).
7. All six official RFP agent names appear exactly; no generic placeholder names.
8. Extraction ignores placeholder/instruction text.
9. Scenario A ETL returns 8 records; Scenario F returns 0; all ETL output labeled `synthetic_mock`.
10. Governance summary exposes agent-activity counts for all six agents.

---

## 18. First PR scope

> **Sequencing update (2026-06-10, per reviewer direction):** the repo is not scaffolded yet, so the application skeleton ships alone as **PR 0** before any domain code. The previously combined first PR is split: **PR 1** delivers the deterministic backend foundation, **PR 2** adds the six-agent deterministic workflow and `AgentRun` visibility. Doc 14's "first PR" six-agent acceptance criteria are therefore satisfied at the end of **PR 2**; the PR 0–2 sequence together still meets every doc-14 item.

### PR 0 — application skeleton and local developer foundation (the actual first PR)

**PR title:** `chore: application skeleton — FastAPI backend, React/Vite/TS frontend shell, Makefile, test setup`

Skeleton only — no domain models, agents, mock scenarios, audit logic, approval policy, state machine, governance, Gemini, or GCP adapters.

**Include:**

- `git init` (baseline commit of handoff docs + this plan on `main`; scaffold work on a feature branch).
- `README.md` — project overview, guardrail statement, quickstart, repo layout, roadmap pointer.
- `.gitignore` — Python, Node, env files, OS/editor artifacts.
- `.env.local.example` — documented env vars; **zero credentials required**; Gemini/GCP vars present only as commented future placeholders.
- `Makefile` — `install`, `dev-backend`, `dev-frontend`, `test`, `test-unit`, `test-api`, `lint`, `build-frontend` (`test-golden` is added in PR 2 when the first golden tests exist).
- `backend/` Python project: `pyproject.toml` (FastAPI + uvicorn; dev extras: pytest, httpx, ruff), `app/main.py` app factory, `app/api/routes/health.py` with `GET /healthz`, pytest setup (`tests/conftest.py`, `tests/api/test_health.py`, `tests/unit/test_app_factory.py`).
- `frontend/` React + Vite + TypeScript app shell (React confirmed — empty repo, fastest prototype path, no Angular house standard) with a placeholder page showing the synthetic-data banner and a backend health indicator; dev-server proxy to the backend.

**Acceptance criteria:**

- `make install && make test` passes locally.
- `make dev-backend` serves `GET /healthz`; `make dev-frontend` serves the placeholder page; both run together locally.
- Zero GCP credentials; no secrets committed; `.env.local` gitignored.

**Excluded:** everything domain-specific (deferred to PR 1+).

### PR 1 — deterministic backend foundation

**PR title:** `feat: deterministic backend foundation — domain models, workflow state machine, approval policy, audit trail, mock request data`

**Files/modules:** `config.py` (pydantic-settings), `logging_config.py`, `api/deps.py`; all §8 models **except `AgentRun`** (which lands in PR 2 with the agents); `WorkflowStateMachine`; `ApprovalPolicy` (full doc-06 trigger list); `AuditService` + local audit repository; local repositories (legal request, response record, storage); `RequestExtractionService` (deterministic + placeholder-text filter); sensitive/special handling checker; deficiency service; mock data: six legal-request scenario fixtures (A–F), `sop/` rule files (intake, routing, deficiency, special handling, response package), `registries/` (taxonomy, sensitive party), `seed.py` loader.

**Endpoints:** `GET /api/legal-requests`; `POST /api/legal-requests`; `GET /api/legal-requests/{id}`; `POST .../extract`; `POST .../validate`; `POST .../review`; `POST .../approve`; `POST .../escalate`; `POST .../send-to-qa`; `GET .../audit`; `GET /api/audit/events`; `GET /api/governance/summary` (basic counts — agent activity arrives in PR 2).

**Tests:** unit — models, state-machine transitions (legal path + invalid transitions rejected), every approval-policy trigger, deficiency rules, special-handling detection, placeholder-text filter; service — audit write failure blocks the calling transition; api — all endpoints above, audit event written on every state change.

**Acceptance criteria:** a seeded request can move `request_received → … → analyst_review_pending → analyst_approved / escalated` via the API with a complete audit trail; all approval-policy triggers enforced in code; `make test` green with zero credentials; no unsafe endpoint names.

### PR 2 — six-agent deterministic workflow and AgentRun visibility

**PR title:** `feat: six RFP agents as named workflow actors with AgentRun outputs, orchestrator, and agent-activity counts`

**Files/modules:** `AgentRun` model; `agents/base.py` + the six agent modules (deterministic implementations, not stubs — each returns real structured output for the seeded scenarios); `CaseFlowOrchestrator` (rail sequence with blocked-step recording); routing rules service; local SOP retrieval wiring for evidence IDs; response record service; response package service; mock `response_records/` files (exactly 8 GPS records for A, empty for F) and per-scenario `agent_runs` expectation blocks.

**Endpoints:** `POST .../index`; `POST .../classify`; `POST .../route-recommendation`; `POST .../etl/simulate`; `GET .../responsive-records`; `POST .../notes/draft`; `POST .../production-package/draft`; `GET .../production-package`; `POST .../deficiency-response/draft`; `POST .../agents/run`; `GET .../agent-runs`; `GET /api/governance/agent-activity`; request detail response gains `agent_runs`.

**Tests:** six-agent contract tests (valid `AgentRun`, exact official RFP names, structured output, exactly one audit event per run including blocked runs, no generic `ai_agent` naming); golden scenarios 1–6 core assertions (A: all six agents complete; B: ETL blocked on deficiency; C: Automation Agent prepares SME escalation; F: ETL returns zero records and Text Content drafts the no-records package); guardrail route-table scan (no send/release endpoints); `make test-golden` target added.

**Acceptance criteria (doc-14 six-agent criteria land here):** `agent_runs` object on request detail; Scenario A produces six agent run records; each agent run writes an audit event; governance exposes agent-activity counts; tests confirm all six official RFP agent names exactly; production package draft-only with human approval required.

---

## 19. Later PR roadmap

Sequence updated per reviewer direction: PR 0 (skeleton) → PR 1 (deterministic backend foundation) → PR 2 (six-agent workflow + `AgentRun` visibility), then the remaining work renumbered accordingly.

| PR | Goal | Main changes | Acceptance criteria |
|---|---|---|---|
| **PR 0** | Application skeleton and local developer foundation (see §18) | §18 PR 0 | §18 PR 0 criteria |
| **PR 1** | Deterministic backend foundation (see §18) | §18 PR 1 | §18 PR 1 criteria |
| **PR 2** | Six-agent deterministic workflow + AgentRun visibility (see §18) | §18 PR 2 | §18 PR 2 criteria (incl. doc-14 six-agent criteria) |
| **PR 3** | Six-agent depth: full golden suite + agent-run polish | Golden scenarios 7–9, 11–12 (sensitive sender, low confidence, SOP conflict, route override, analyst package edits); sensitive party registry wiring; human-override capture on reviews; `AgentRun` retry/latency fields populated; orchestrator blocked-step refinements | All 12 golden scenarios green; override metrics computable; blocked ETL runs visible in B/C/D fixtures |
| **PR 4** | Response package and deficiency flow completion | `section_provenance` on packages; no-records package variant; SME notification draft; chain-of-custody/certification draft polish; QA guardrail completeness checks; `qa_validation_completed`/`finalization_blocked` paths hardened | Package matches Template LERS Response exactly; F variant correct; finalization blocked without QA pass + approval + complete audit trail |
| **PR 5** | Governance and audit endpoints (full) | Product-volume, processing-time, bottlenecks, audit-readiness, response-package-status endpoints; governance metrics service with data-confidence labels; deterministic insight generation; global audit query with agent filter | All §9 governance endpoints live; metrics labeled; `?agent=` filter returns each agent's events |
| **PR 6** | Frontend request workflow | API client + types over the PR 0 shell; Request Queue, Request Detail (source + extracted fields), **Six-Agent Workflow Rail**, Response Package Draft, Deficiency Response Draft, Human Review screens; mock-data banners; UI language guardrails | Scenario A completable in browser; rail shows six named cards with status/output/audit links; B and C paths viewable; component tests pass |
| **PR 7** | Frontend governance views | Governance & Insights with RFP Agent Coverage module; Work Needing Attention; Audit Timeline (agent filter) + Audit Detail screens | Leadership can see agent coverage within 10 seconds; attention items link to agent outputs; timeline filters by all six agents |
| **PR 8** | Gemini wrapper and prompt profiles | `app/llm/` (GeminiClient, ModelRouter, PromptLoader, output validation, MockModelClient); prompt files; wire extraction/triage/notes/drafts/QA/insights behind `MODEL_MODE`; repair/retry/block path; model metadata logging | Mock-model tests green in CI; deterministic mode unchanged; no model IDs in agents; no model calls in routes; invalid output → blocked + audited + human review |
| **PR 9** | Retrieval abstraction and local evidence hardening | `RetrievalService` interface finalized; evidence IDs threaded through all agent outputs, audit events, insights; UI evidence expanders verified; retrieval unit tests | Every classification/draft carries evidence references; evidence click-through works; Agent Search adapter can be added without touching agents |
| **PR 10** | GCP adapters and deployment path | Dockerfile (multi-stage, SPA + API); local/GCP config split; Firestore request/audit repo skeletons; Cloud Storage repo skeleton; Agent Search retrieval skeleton; IAP/auth notes; structured-log field completion | `docker build` succeeds; container runs local mode credential-free; adapter swap is config-only; no secrets in repo |
| **PR 11** | Demo polish | Demo seed/reset script; demo walkthrough doc with six-agent talk track; rail and coverage-module visual polish; synthetic-data labeling sweep; full DoD checklist run (§21) | Doc-13 leadership acceptance test passes live; all DoD items checked |

---

## 20. Risks and open questions

| Risk / question | Impact | Mitigation | Needs answer before build? |
|---|---|---|---|
| **Legal domain ambiguity** — real queue names, routing rules, deficiency criteria, and always-SME request types are unknown (doc 01 open questions 3–5) | Demo rules may not match real operations; rework later | Encode all rules as data (`routing_rules.json`, `deficiency_rules.json`) so SME corrections are config edits, not code changes; label rules as synthetic | No — proceed with doc-derived defaults (e.g., queue "Location Response Review") |
| **Missing real SOPs** — SOP corpus is invented | Evidence references are illustrative only | Stable evidence IDs + clearly synthetic SOP titles; swap corpus content later without schema change | No |
| **Mock vs. real data realism** — leadership wants credible examples (doc 03) but realism could imply real PII | Demo credibility vs. compliance risk | Follow doc-03 payloads exactly; obviously-synthetic names/IDs; persistent synthetic-data banners and `synthetic_mock` labels | No |
| **GCP integration timing** — building Firestore/Agent Search too early burns time; too late risks adapter mismatch | Schedule risk either way | Interfaces defined in PR 1; implementations deferred to PR 10 skeletons; no live wiring required for demo | No |
| **Gemini schema reliability** — structured output may fail validation | Broken drafts mid-demo | Deterministic fallback always available; repair-retry-block path; demo can run `MODEL_MODE=deterministic`; mock-model CI | No |
| **UI complexity** — 10 screens + rail is a lot for a prototype | Frontend becomes the bottleneck | Shared `AgentRunCard` powers the rail cheaply; governance charts start as simple tables/tiles; polish deferred to PR 11 | No |
| **Six-agent visibility risk** — agents could blur into the orchestrator or generic services | Fails the leadership acceptance gate (the headline requirement) | Named modules, exact-name contract tests, `agent_runs` on detail API, rail as a hard UI requirement, RFP coverage governance module, audit filter by agent — visibility enforced at every layer with tests | No — designed-in |
| **Audit completeness** — an unlogged path would violate a core guardrail | Compliance story collapses | Single audit write path; state machine writes on every transition; QA guardrail verifies required-event map; golden test 10 proves missing event blocks finalization | No |
| **Over-scoping risk** — temptation to build real integrations, auth, or extra features | MVP slips | Strict PR boundaries; production write-back adapters deliberately absent; out-of-scope list in §4/§18 enforced in review | No |
| **Doc conflict: file names say v3, content headers say v2** | Possible missing v3-only content | Verified all 17 files + combined master are internally consistent and include the six-agent requirements; treat content as authoritative | No — flag to doc owner for hygiene |
| **Doc conflict: Automation Agent audit event** — doc 16 requires `workflow_action_prepared`; doc 10 taxonomy omits it | Tests/taxonomy mismatch | **Recommendation adopted in this plan:** add `workflow_action_prepared` to the taxonomy; keep `request_escalated` for confirmed escalations | No — recommendation stated |
| **Doc conflict: governance endpoint name** — `agent-performance` (doc 07) vs `agent-activity` (doc 14) | API naming churn | **Recommendation:** canonical `GET /api/governance/agent-activity`; do not ship both | No — recommendation stated |
| **Doc conflict: Scenario C agent list** — doc 03 scenario table omits Text Content but lists "Governance" (not one of the six); the coverage matrix marks Text Content **Yes** for C | Scenario fixture ambiguity | **Recommendation:** follow the coverage matrix — Text Content drafts the SME notification in C; "Governance" is a control service, not a rail agent | No — recommendation stated |
| **Story Capture reuse analysis not yet performed** (doc 15) — target repo is outside this workspace and outside this planning task's read scope | Possible duplicated effort on genai wrapper/router/prompt-loader patterns | Run the doc-15 read-only analysis before PR 8 (Gemini) at the latest; PRs 0–2 do not depend on it | **Partially** — needed before PR 8, not before PR 0–2 |
| **Frontend framework** — docs allow React or Angular | Rework if the org standard differs | **Resolved:** reviewer approved React + Vite + TypeScript for the PR 0 shell (no Angular house standard identified) | No — resolved |
| **Open product questions** (doc 01): highest-volume request types; product segmentation priority; AHT reduction assumptions; "draft package only" vs "approved production package with synthetic records" display | Demo emphasis tuning | Defaults for prototype: emphasize Maps/Location + subscriber-info volume; show **draft package pending approval** (never "approved production" by agent — safer and guardrail-consistent); AHT figures labeled `estimated`/`synthetic_mock` | No — defaults proposed; revisit before demo |

---

## 21. Definition of done

Consolidated from docs 13, 14, and 16. Each item is testable.

**Product DoD** — a reviewer can run Scenario A end-to-end: request appears in queue → source document opens → extraction shows legal process, agency, identifiers, data categories, date range, authorities, special handling → Indexing Agent indexes → Triaging Agent classifies and routes → ETL Agent simulates retrieval (8 synthetic records) → Note Taking and Data Entry Agent drafts notes → Text Content Agent drafts the response package → Automation Agent prepares the approval/escalation action → analyst reviews and approves or escalates → audit trail shows every agent and human action → governance dashboard updates.

**Six-agent visibility DoD (acceptance gate):** all six agents visible in the UI by official RFP name; each has ≥1 completed run in the synthetic dataset; each consumes request/workflow data; each produces structured JSON output surfaced in the UI; each shows status (waiting/running/complete/blocked/needs review); confidence and evidence/rationale shown where applicable; each writes ≥1 audit event; each appears in ≥1 golden scenario; audit timeline filters by agent; governance shows per-agent activity; **no agent can finalize route, response package, production, or send action without human approval**. Leadership test: "where are the six agents?" answerable in ≤10 seconds, and the presenter can show each agent's input, output, review requirement, and audit event from one request.

**Agent DoD (each of the six):** visible by official name; typed input schema; typed output schema; deterministic/mock mode; Gemini-ready prompt profile where applicable (Triaging, Note Taking and Data Entry, Text Content; ETL and Automation deterministic by design); returns confidence; returns rationale; references evidence; emits audit metadata; ≥1 working demo scenario; golden tests.

**Guardrail DoD:** response package cannot be finalized without human approval; deficiency response cannot be sent without human approval; production package cannot be released by agent; no LE disclosure step automated; special handling flags force review; missing field blocks processing; low confidence forces review; audit write failure blocks finalization; synthetic/mock data clearly labeled; no autonomous-send/release endpoint exists.

**Testing DoD:** `make test` green locally with no credentials; 100% golden-scenario pass in deterministic mode; 100% schema validity on extraction/classification/package outputs; 100% special-handling recall and missing-field detection on seeded cases; 100% audit and approval-gate coverage; six-agent contract tests pass with exact official names.

**GCP DoD:** runs locally without GCP credentials; configurable for GCP mode; Cloud Run container builds; Gemini only via `google-genai` through one wrapper; model IDs config-driven; Agent Search behind the retrieval interface; Firestore behind repository interfaces; Cloud Storage behind the storage interface; no secrets committed; structured logs include request ID, agent, model, prompt version, evidence IDs, confidence, latency, outcome.

**UI DoD:** all ten §13 screens function; Six-Agent Workflow Rail renders the official sequence with full card contents; response package screen shows section-level agent provenance; governance shows the RFP Agent Coverage module; UI never shows autonomous send/release language; synthetic data and data confidence labeled throughout.

**Demo DoD:** stakeholders can see all six agents acting on data, request extraction, triage and routing, response package draft, the human approval gate, the audit timeline, product/domain governance metrics, clearly marked synthetic data, and the AHT/efficiency relevance story; the demo runs reliably in deterministic mode and the six-agent talk track (doc 16) maps to what is on screen.

---

## 22. Recommended next action

1. **Review this plan** — specifically the recommendations on the four documented conflicts (§20): adopt `workflow_action_prepared` in the audit taxonomy, canonicalize `GET /api/governance/agent-activity`, follow the coverage matrix for Scenario C (Text Content drafts the SME notification), and treat the v2/v3 header mismatch as cosmetic.
2. **Frontend framework is resolved:** React + TypeScript + Vite, approved with the PR 0 direction. Remaining default to confirm before the demo: the demo shows **"draft package pending approval"** rather than any "approved production" state (proposed default, guardrail-consistent).
3. **Optionally schedule the Story Capture reuse analysis** (doc 15) — it is read-only, lives in a different repo, and is only needed before PR 8 (Gemini wrapper/router/prompt-loader patterns). It does not block PRs 0–2.
4. **PR 0 is in progress** (application skeleton: git init, README, .gitignore, .env.local.example, Makefile, minimal FastAPI backend with `/healthz` + test setup, React/Vite/TS frontend shell). Once merged, **PR 1** (deterministic backend foundation) starts immediately — nothing in the open-question list blocks it: the data model, state machine, approval policy, audit service, and mock scenarios are fully specified by the handoff docs. **PR 2** then adds the six agents and `AgentRun` visibility.

**What the user should review:** the §18 PR 0/1/2 split (in particular that doc 14's six-agent acceptance criteria now land at the end of PR 2), the §9 endpoint naming recommendation, the §6 repo layout, and the §20 conflict recommendations.
