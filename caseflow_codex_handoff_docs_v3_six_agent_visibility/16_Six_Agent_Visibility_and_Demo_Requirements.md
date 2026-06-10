# Six-Agent Visibility and Demo Requirements

## Purpose

Leadership is focused on ensuring the six agents committed in the RFP are built and clearly shown in the prototype.

This document turns that into a hard product, backend, UI, test, and demo requirement.

## Official six RFP agents

Use these names exactly:

1. **Text Content Agent**
2. **Automation Agent**
3. **ETL Agent**
4. **Note Taking and Data Entry Agent**
5. **Triaging Agent**
6. **Indexing Agent**

## Non-negotiable rule

The prototype is not complete unless all six RFP agents are visibly represented in the UI, each acts on request data, each produces a structured output, and each writes an audit event.

## Required workflow representation

The Request Detail / Agent Workflow screen must include a named workflow rail:

```text
Indexing Agent
→ Triaging Agent
→ ETL Agent
→ Note Taking and Data Entry Agent
→ Text Content Agent
→ Automation Agent
```

Each step must show:

- official RFP agent name
- status: waiting / running / complete / blocked / needs review
- input summary
- output summary
- confidence where applicable
- evidence/rationale link
- audit event link
- human review requirement
- timestamp

## Required backend representation

Each agent must have:

- service or class/function implementation
- typed input schema
- typed output schema
- deterministic/mock mode
- Gemini-ready prompt profile if applicable
- output validation
- failure behavior
- audit event type
- tests

## Required UI proof by agent

| Agent | Required visible output | Example display copy |
|---|---|---|
| Indexing Agent | Request labels, SOP matches, product/domain, priority | “Indexed as Search Warrant + GPS Location + Maps/Location.” |
| Triaging Agent | Request classification, urgency, queue, review need | “Classified as Location Data Production. Route: Location Response Review. Human approval required.” |
| ETL Agent | Mock query and responsive records | “8 synthetic GPS records found for requested period.” |
| Note Taking and Data Entry Agent | Internal note and fields to update | “Drafted case note and populated legal process, date range, and routing fields.” |
| Text Content Agent | Response package / deficiency response sections | “Drafted production summary, field definitions, chain of custody, and certification.” |
| Automation Agent | Prepared route, escalation, QA, owner, or follow-up action | “Prepared analyst approval task and SME notification. Not executed.” |

## Required audit events by agent

| Agent | Required audit event |
|---|---|
| Indexing Agent | `request_indexed` |
| Triaging Agent | `request_classified` |
| ETL Agent | `etl_simulated` |
| Note Taking and Data Entry Agent | `note_drafted` |
| Text Content Agent | `production_package_drafted` or `deficiency_response_drafted` |
| Automation Agent | `workflow_action_prepared` |

## Required governance module

Governance & Insights must include an **RFP Agent Coverage** or **Agent Activity** module showing:

- runs by agent
- blocked runs by agent
- audit events by agent
- average confidence by agent where applicable
- human overrides by agent
- scenario coverage by agent

## Required scenario coverage

| Scenario | Required coverage |
|---|---|
| GPS location happy path | Must show all six agents completing successfully. |
| Missing date range deficiency | Must show ETL blocked and Text Content Agent drafting deficiency response. |
| Pen register / non-disclosure escalation | Must show Triaging Agent flagging risk and Automation Agent preparing SME escalation. |
| Overbroad all-Google-data request | Must show Indexing/Triaging surfacing multiple product domains and QA/review requirement. |
| No responsive records | Must show ETL returning zero records and Text Content Agent drafting no-records package. |

## Definition of done

The six-agent requirement is done only when:

- all six agents appear in the UI by official name
- Scenario A shows all six agents completing
- each agent output is structured JSON in backend
- each agent output appears in the UI
- each agent writes an audit event
- governance shows agent activity
- tests verify all six agents are present and functioning
- no agent finalizes production, response, route, note, or send action without human approval

## Demo talk track

Use this in the live demo:

> “This view makes the six RFP agents explicit. The Indexing Agent organizes the request, the Triaging Agent classifies and routes it, the ETL Agent simulates the approved data pull, the Note Taking and Data Entry Agent prepares the internal record, the Text Content Agent drafts the response package, and the Automation Agent prepares the next workflow action. Each step is visible, reviewable, and audit logged.”
