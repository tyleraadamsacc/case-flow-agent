# CaseFlow Agent — demo walkthrough and six-agent talk track

A repeatable ~10-minute leadership demo. Everything is synthetic, local,
and credential-free; every agent action is a draft and every decision is
human. The talk track answers the leadership question — *"where are the
six agents?"* — in the first minute.

## Setup (once)

```bash
cp .env.local.example .env.local
make install
make dev-backend     # terminal 1 — FastAPI on :8000
make dev-frontend    # terminal 2 — SPA on :5173
```

Open `http://localhost:5173`. **Reset between runs:** state is
in-process — restart `make dev-backend` and the eight synthetic
scenarios reseed automatically (`make demo-reset` prints this).

A backend-only rehearsal exists too: `make demo-scenario-a`.

## Act 1 — the landing answer (Governance & Insights, ~1 min)

The app opens on Governance & Insights.

> "This is a human-led legal operations console. The six agents from the
> RFP are first-class, visible workflow actors — here is the **RFP Agent
> Coverage** module: Indexing Agent, Triaging Agent, ETL Agent, Note
> Taking and Data Entry Agent, Text Content Agent, Automation Agent —
> runs, blocked runs, audit events, and confidence per agent. Every
> metric on this page says how trustworthy it is — this dataset is
> labeled synthetic."

(Counts are zero on a fresh start — that's honest; they fill in live
during the demo. Re-visit this screen in Act 5.)

## Act 2 — Scenario A end to end (Request Detail, ~4 min)

Request Queue → open **LER-2026-004812** (GPS search warrant).

1. **Extract request** — the source warrant highlights what extraction
   grounded each field on; the Extracted Fields panel fills: process,
   agency, identifiers, GPS categories, valid date range, 35-day
   deadline, authorities.
2. **Validate request** — special handling and policy reasons appear in
   the Human review panel (search warrant + location tracking force
   review by code, not by prompt).
3. **Run six-agent workflow** — the Six-Agent Workflow Rail fills in
   order. Per card: official name, status, output summary, confidence,
   **Evidence** (click one — the drawer resolves the stable evidence id
   to the SOP/routing rule/template that grounded it), and **Audit**
   (one audit event per run, always).

   > "Indexing labeled it and matched intake SOPs. Triaging classified
   > it and *recommended* a route — pending human approval. ETL simulated
   > a read-only pull: 8 synthetic GPS records. Note Taking drafted the
   > intake note. Text Content drafted the response package. Automation
   > *prepared* the approval task — prepared, never executed."

4. **Drafted artifacts** — the Template LERS Response draft: watermark
   "Draft — pending analyst review · synthetic / mock data", per-section
   agent provenance chips, the record index copied verbatim from the ETL
   output, chain of custody and certification both pending statuses.
5. **Approve route** (add a comment) — state moves to **Audit complete**;
   the audit summary shows 12 events: system, each agent by name, and
   the human decisions.

   > "The agent did the work; the person made the decision; the audit
   > trail proves both."

## Act 3 — the exception paths (~2 min)

- **LER-2026-004821** (Scenario B): extract → validate → run agents. The
  **ETL Agent card is blocked — missing date range** and stays visible;
  Text Content drafted a deficiency clarification instead; package
  drafting is disabled with the reason. Blocked is a feature, not a
  failure to hide.
- **LER-2026-004835** (Scenario C): pen register + non-disclosure. The
  rail shows SME routing, a drafted SME notification, and Automation's
  *prepared* escalation — all pending a person.

## Act 4 — attention and audit (~2 min)

- **Work Needing Attention**: B and C surfaced with reasons (blocking
  deficiency, special handling, prepared escalation), highest priority
  first, each linking back to its request.
- **Audit**: filter the global timeline by **ETL Agent** — exactly its
  runs, including the blocked ones, each with evidence and state badges.
  Repeat with any of the six. "Filterable by agent" is a contractual
  requirement; show it live.

## Act 5 — close the loop (Governance, ~1 min)

Back to Governance & Insights: coverage now shows live runs/blocked
counts per agent, volume by product domain, audit readiness, and the
response-package status. The leadership question is answerable from any
screen in under ten seconds.

## Q&A crib sheet

- **"Can it send the response?"** No send/release/disclose endpoint
  exists; statuses are type-constrained so no agent-reachable final
  exists. The guardrails are code, with tests.
- **"What if the model is wrong?"** Deterministic mode is the default.
  In model-assisted modes, output is schema-validated, repaired once,
  then falls back to the deterministic draft with mandatory human review
  — recorded in the run's audit event.
- **"Is this real data?"** No — synthetic only, labeled on every screen,
  record, and metric.
- **"What about production GCP?"** Local-first; adapters are config-only
  skeletons (see docs/DEPLOYMENT.md). Nothing in the codebase can write
  to LERS, Cases, or email.
