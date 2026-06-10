# CaseFlow Agent — Definition of Done v2


## Six-Agent Visibility Acceptance Gate

The prototype is not demo-ready unless:

- all six RFP agents are visible in the UI by name
- each agent has at least one completed run in the synthetic dataset
- each agent consumes request or workflow data
- each agent produces structured output
- each agent shows status: waiting, running, complete, blocked, or needs review
- each agent shows confidence where applicable
- each agent shows evidence/rationale where applicable
- each agent writes at least one audit event
- each agent is represented in at least one golden scenario
- the audit timeline can be filtered by agent
- governance can show activity by agent
- no agent can finalize route, response package, production, or send action without human approval


## Product definition of done

The prototype is done when a reviewer can run a complete Scenario A:

1. A LERS-style legal request appears in the queue.
2. The system opens the request document.
3. The system extracts legal process, agency, identifiers, requested data categories, date range, legal authorities, and special handling.
4. The Indexing Agent indexes the request.
5. The Triaging Agent classifies product/domain, urgency, sensitivity, and route.
6. The ETL Agent simulates responsive data retrieval.
7. The Note Taking and Data Entry Agent drafts internal notes.
8. The Text Content Agent drafts the response package.
9. The Automation Agent prepares route/escalation/QA actions.
10. Analyst reviews and approves or escalates.
11. Audit trail shows every agent and human action.
12. Governance dashboard updates metrics and insight panels.

## Agent definition of done

Each of the six RFP agents is done when:

- visible in the UI by official RFP agent name
- has typed input schema
- has typed output schema
- has deterministic/mock mode
- has Gemini-ready prompt profile if applicable
- returns confidence
- returns rationale
- references evidence
- emits audit metadata
- has at least one working demo scenario
- has golden tests

## Guardrail definition of done

The system is not done unless:

- response package cannot be finalized without human approval
- deficiency response cannot be sent without human approval
- production package cannot be released by agent
- no LE disclosure step is automated
- special handling flags require review
- missing field blocks processing
- low confidence requires review
- audit write failure blocks finalization
- synthetic/mock data is clearly labeled

## GCP definition of done

- app runs locally without GCP credentials
- app can be configured for GCP mode
- Cloud Run container builds
- Gemini calls use `google-genai` through one wrapper
- model IDs are config-driven
- Agent Search is behind retrieval interface
- Firestore is behind repository interface
- Cloud Storage is behind storage interface
- no secrets committed
- structured logs include request ID, agent, model, prompt version, evidence IDs, confidence, latency, and outcome

## Demo definition of done

Stakeholders can see:

- all six agents acting on data
- request extraction
- triage and routing
- response package draft
- human approval gate
- audit timeline
- product/domain governance metrics
- synthetic data clearly marked
- AHT/efficiency relevance

# Leadership demo acceptance test

A leadership reviewer must be able to answer “where are the six agents?” within 10 seconds.

The demo presenter should be able to click into a single request and show:

1. Indexing Agent output
2. Triaging Agent output
3. ETL Agent output
4. Note Taking and Data Entry Agent output
5. Text Content Agent output
6. Automation Agent output

For each, the presenter must be able to show:

- what input it used
- what output it produced
- whether human review is required
- what audit event was created

If this cannot be shown, the prototype is not demo-ready.
