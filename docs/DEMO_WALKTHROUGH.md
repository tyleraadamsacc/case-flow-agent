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
in-process — restart `make dev-backend` and the demo dataset reseeds
automatically (`make demo-reset` prints this).

**The demo dataset is the two source documents** under
`backend/app/mock_data/source_documents/`: the *LERS Request Template*
(the Larimer County search warrant + ex parte order, placeholders filled
with the values from the response document) and the *Template LERS
Response* (the 8-record GPS production). `make dev-backend` seeds only
this pair (`CASEFLOW_SEED_DATASET=demo`); the eight test scenarios
remain available with `CASEFLOW_SEED_DATASET=full`. A backend-only
rehearsal of the full dataset exists too: `make demo-scenario-a`.

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

## Act 2 — the warrant, end to end (Request Detail, ~5 min)

Request Queue → open **LER-2026-004812** — the LERS Request Template as
a filled search warrant (pen register/trap-and-trace + location +
subscriber information).

1. **Extract request** — the full warrant text is the source document;
   extraction highlights its grounding spans and *ignores the template's
   instruction block* ("PLEASE DELETE…"). The Extracted Fields panel
   fills: search warrant + ex parte order, the agency block, the three
   identifiers from the response document, May 10–15 2026, fourteen
   product domains, and the warrant's full special-handling set (sealed,
   non-disclosure for one year, no adverse action, pen register, trap
   and trace, ongoing access, content, Tombstone, location).
2. **Validate request** — the policy reasons appear in the Human review
   panel. This warrant forces review by code many times over.
3. **Run six-agent workflow** — the rail fills, and the story is the
   hold: **the ETL Agent is blocked — SME escalation pending.** Text
   Content drafted the SME notification, Automation *prepared* the
   escalation. Click **Finalize request** to show it refused: blocked
   agent runs block finalization, audited as such.

   > "The warrant asks for everything and carries every special-handling
   > flag — so the system refuses to simulate the pull until a person
   > decides."

4. **Approve route** (add a comment) — the human decision is recorded.
   **Run six-agent workflow again**: the ETL Agent now completes with
   the 8 synthetic GPS records, the Note Taking and Data Entry Agent
   drafts the response-prep note, and the Text Content Agent drafts the
   production package.
5. **Drafted artifacts** — the package *is* the Template LERS Response:
   PROD-2026-004812-01, the eight records verbatim (timestamps,
   coordinates, accuracies), the document's field definitions, chain of
   custody ("Internal Location Data Repository Query" by the Legal
   Response Operations Team), and the Jane Doe certification — every
   status still pending until a person approves.
6. **Finalize request** — now it succeeds: **Audit complete**. The audit
   summary shows every agent run (including the blocked one — it stays
   in the trail), the route approval, and the finalization.

   > "The agents did the work twice; the person made the decision in the
   > middle; the audit trail proves all of it."

## Act 3 — the exception paths (optional, ~2 min)

Restart the backend with `CASEFLOW_SEED_DATASET=full` to show the eight
test scenarios: Scenario B's missing-date-range block (deficiency
clarification draft, package drafting disabled) and Scenario C's pen
register path. The demo dataset itself already demonstrates the blocked
path in Act 2.

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
- **"Is this real data?"** No — the dataset is two mock template
  documents (the request and response templates), synthetic only,
  labeled on every screen, record, and metric.
- **"What about production GCP?"** Local-first; adapters are config-only
  skeletons (see docs/DEPLOYMENT.md). Nothing in the codebase can write
  to LERS, Cases, or email.
