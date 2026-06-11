# CaseFlow Agent — deployment path

The prototype is local-first: everything runs with **zero GCP
credentials** on synthetic data. This document describes the container
path and how the GCP adapters activate later. Nothing here changes the
product guardrails — no disclosure step is automated in any mode.

## Container

One image serves the API and the built SPA:

```bash
docker build -t caseflow-agent .
docker run -p 8080:8080 caseflow-agent
# open http://localhost:8080  (SPA + /api + /docs + /healthz)
```

- Local mode by default: in-memory repositories, seeded synthetic
  scenarios, no credentials, no outbound calls.
- Cloud Run compatible: the process binds `$PORT` (default 8080).
- No secrets are baked into the image; nothing in the repo holds a
  credential. `.env.local` is gitignored and never copied.

## Configuration matrix

| Variable | Default | Purpose |
|---|---|---|
| `CASEFLOW_APP_MODE` | `local` | `gcp` swaps persistence/retrieval adapters (config-only) |
| `CASEFLOW_MODEL_MODE` | `deterministic` | `mock_model` (credential-free) or `gemini` (opt-in) |
| `CASEFLOW_SEED_ON_STARTUP` | `true` | Seed the synthetic scenarios at boot |
| `CASEFLOW_STATIC_DIR` | unset (image sets it) | Serve the built SPA from this directory |
| `CASEFLOW_GCP_PROJECT` | unset | Firestore project (gcp mode) |
| `CASEFLOW_FIRESTORE_COLLECTION_PREFIX` | `caseflow` | Firestore collection prefix |
| `CASEFLOW_GCS_BUCKET` | unset | Cloud Storage bucket (gcp mode) |
| `CASEFLOW_AGENT_SEARCH_DATASTORE` | unset | Vertex AI Search data store (gcp mode) |
| `CASEFLOW_GEMINI_API_KEY` | unset | Gemini mode only; environment-injected, never committed |
| `CASEFLOW_MODEL_DEFAULT` / `CASEFLOW_MODEL_OVERRIDES__<TASK>` | unset | Model ids — configuration only, never code |

## Adapter status

| Adapter | Interface | Status |
|---|---|---|
| `FirestoreLegalRequestRepository` | `LegalRequestRepository` | Skeleton — selection + schema defined, wiring post-MVP |
| `FirestoreAuditRepository` | `AuditRepository` (append-only) | Skeleton |
| `GcsStorageRepository` | `StorageRepository` | Skeleton |
| `AgentSearchRetrievalService` | `RetrievalService` | Skeleton — retrieval/grounding only, never orchestration |
| `GeminiClient` | `ModelClient` | Functional wrapper, opt-in via `backend[gemini]` |

Selecting `CASEFLOW_APP_MODE=gcp` without the optional dependencies
(`pip install -e "./backend[gcp]"`) or the required variables fails at
startup with explicit guidance — adapters never degrade silently, and no
adapter can write to a production Google system (LERS, Cases, email);
those write-backs do not exist in the codebase by guardrail.

## Identity-Aware Proxy (IAP) notes

The prototype ships **no authentication of its own** — it must only be
exposed behind an access-controlled front door:

- Deploy to Cloud Run with ingress restricted; put IAP (or an equivalent
  identity proxy) in front for any shared environment.
- The current actor identity is a demo stub (`analyst` role). When IAP is
  enabled, derive the actor from the `X-Goog-Authenticated-User-*`
  headers in the actor dependency — the audit trail already records
  `actor_id` on every human action.
- Never expose the container publicly: synthetic data only, but the
  workflow semantics are sensitive.

## Structured logs

Every log line is single-line JSON with `correlation_id` (also returned
as `X-Request-ID`). Persisted agent runs additionally log: legal request
id, agent run id, agent id/name, status, model id, prompt version, retry
count, validation status, evidence ids, confidence, latency, and the
audit event id — the doc-13 field set, ready for Cloud Logging ingestion
unchanged.
