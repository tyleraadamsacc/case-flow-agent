# Definition-of-done checklist (plan §21)

Status as of the PR 11 sweep. Evidence is the test suite
(`make test` / `make test-frontend` / `make test-golden` / `make lint`),
the golden scenarios, and the live demo path in
[DEMO_WALKTHROUGH.md](DEMO_WALKTHROUGH.md). Statuses are honest:
**done**, **partial** (works, with a named gap), or **deferred** (post-MVP
by plan).

## Product DoD — done

Scenario A runs end to end in the browser: queue → source document →
extraction → all six agents → drafts → human review → approval → audit
trail → governance updates. Verified live (PR 6) and rehearsed by
`make demo-scenario-a`.

## Six-agent visibility DoD — done

- All six agents visible by exact official RFP name: rail, governance
  coverage module, audit actor chips (contract tests pin the names).
- Each agent: ≥1 completed run in the synthetic dataset, structured JSON
  output surfaced in the UI, status states, confidence/evidence where
  applicable, ≥1 audit event per run (exactly one — tested), ≥1 golden
  scenario.
- Audit timeline filters by each agent individually; governance shows
  per-agent activity.
- No agent can finalize route/package/production/send — statuses are
  type-constrained literals; no such endpoint exists (guardrail tests).
- Leadership test: RFP Agent Coverage is the first module on the landing
  screen.

## Agent DoD (each of the six) — done

Official name, typed input/output schemas, deterministic mode, confidence
and rationale where applicable, evidence references, audit metadata,
demo scenario, golden tests. Gemini-ready profiles exist for Triaging,
Note Taking and Data Entry, and Text Content (versioned prompts + model
assist); ETL and Automation deterministic by design.

## Guardrail DoD — done

Package/deficiency response cannot finalize without human approval;
no LE disclosure automated; special handling forces review; missing
fields block; low confidence forces review; audit write failure blocks
(503, zero runs persisted — tested); synthetic/mock labeled throughout;
no autonomous-send/release endpoint (tested); model-invalid output
blocks into human review with deterministic fallback (tested).

## Testing DoD — done

- `make test`: 191 backend tests, zero credentials (with PR 8/10 merged)
- `make test-golden`: 12/12 golden scenarios in deterministic mode
- `make test-frontend`: 38 component tests
- 100% schema validity on extraction/classification/package outputs in
  deterministic mode (golden + contract tests)
- Six-agent contract tests pin exact official names

## GCP DoD — partial

- ✅ Runs locally without credentials; configurable for GCP mode;
  adapters behind interfaces; model ids config-driven; Gemini only via
  the single google-genai wrapper (optional extra); no secrets committed;
  structured logs carry request id, agent, model, prompt version,
  evidence ids, confidence, latency, outcome.
- ⚠️ `docker build` written to spec but not executed in this environment
  (no Docker available) — run `make docker-build` once on a
  Docker-equipped machine.
- ⚠️ Firestore / Cloud Storage / Agent Search are inert skeletons by
  plan (post-MVP wiring); live Gemini calls require opt-in config and
  were not exercised.

## UI DoD — done (one consolidation note)

All §13 screens function: Governance & Insights, Request Queue, Work
Needing Attention, Request Detail (source + extracted fields + rail),
Response Package Draft with section provenance, Deficiency Response
Draft, Human Review, Audit Timeline with agent filter. Note: package /
deficiency / review render as panels of Request Detail rather than
separate routes — same capabilities, fewer screens. Audit Detail
deep-dive (per-request override diff view) is the one §13 surface kept
minimal: the per-request timeline and review records exist; a dedicated
diff visualization remains open.

## Demo DoD — done

The walkthrough maps the doc-16 six-agent talk track to live screens;
deterministic mode; reset = restart (state is in-process, reseeds
automatically).
