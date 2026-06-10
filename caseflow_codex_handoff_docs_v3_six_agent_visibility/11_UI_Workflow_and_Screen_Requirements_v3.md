# CaseFlow Agent — UI Workflow and Screen Requirements v2

## UI story

The UI should show a full request lifecycle:

```text
Request queue
→ request detail / source document
→ extracted fields
→ six-agent workflow
→ route / escalation recommendation
→ mock ETL result
→ response package draft
→ analyst review
→ audit timeline
→ governance insights
```


## Six-Agent Visibility Requirement

Leadership has made this a hard requirement: the prototype must visibly demonstrate the six RFP agents, not merely implement them as hidden backend modules.

The prototype is not complete unless all six RFP agents are visibly represented in the UI, each acts on request data, each produces a structured output, and each writes an inspectable audit event.

| RFP Agent | Required visible demo action | UI proof |
|---|---|---|
| **Indexing Agent** | Indexes the request by legal process, product/domain, identifiers, SOP matches, and priority | Agent workflow step card showing labels, priority rank, SOP/evidence matches |
| **Triaging Agent** | Classifies request type, urgency, sensitivity, queue, and SME review need | Agent workflow step card showing classification, confidence, route, and rationale |
| **ETL Agent** | Simulates approved responsive data pull from mock repository | Agent workflow step card showing mock query, returned record count, data confidence |
| **Note Taking and Data Entry Agent** | Drafts structured internal notes and fields | Agent workflow step card showing note draft, fields to update, missing fields |
| **Text Content Agent** | Drafts response package, deficiency response, SME notification, or production summary | Agent workflow step card showing drafted sections and approval state |
| **Automation Agent** | Prepares route, escalation, assignment, QA sampling, or follow-up action | Agent workflow step card showing prepared action, target owner/queue, approval status |

The six agents should be shown as named workflow actors in the product experience. Do not collapse them into a generic “AI workflow service,” “assistant,” or “orchestrator” label.


## Required screens

## 1. Governance & Insights

Show:

- incoming requests
- open backlog
- SLA risk
- product/domain volume
- processing time by product
- bottlenecks
- deficiency rate
- SME escalation rate
- response package draft status
- human overrides
- audit coverage

## 2. Work Needing Attention

Prioritize requests needing action:

- missing identifiers
- missing date range
- pen register / trap-and-trace
- non-disclosure
- sealed order
- no adverse action
- overbroad scope
- low confidence
- response awaiting approval
- audit exception

## 3. Request Queue

List legal requests with:

- request ID
- agency
- legal process
- product/domain
- urgency
- deficiency status
- special handling
- owner
- next action

## 4. Request Detail

Two-column layout:

Left:
- source request document
- highlighted extracted spans

Right:
- extracted fields
- legal process
- identifiers
- requested data categories
- date range
- special handling
- missing fields

## 5. Six-Agent Workflow Rail

Show all six RFP agents as a sequence:

1. Indexing Agent
2. Triaging Agent
3. ETL Agent
4. Note Taking and Data Entry Agent
5. Text Content Agent
6. Automation Agent

Each agent card should show:

- official RFP agent name
- short description of its role
- status: waiting / running / complete / blocked / needs review
- input summary
- output summary
- confidence, where applicable
- evidence/rationale link
- audit event link
- human review requirement
- timestamp
- retry/error state, if applicable

## Six-Agent Workflow Rail Requirements

The workflow rail must be visible on the Request Detail / Agent Workflow screen and should use the official six-agent sequence:

```text
Indexing Agent → Triaging Agent → ETL Agent → Note Taking and Data Entry Agent → Text Content Agent → Automation Agent
```

Each agent should be visually distinct but not gimmicky. Use restrained color or icon treatment to help leadership understand that the six RFP agents are active.

Do not collapse these agents behind a generic “AI processing” or “CaseFlow Agent” label.

## 6. Response Package Draft

Use the Template LERS Response structure:

- header
- requesting agency
- subject identifiers
- production summary
- index of produced records
- data field definitions
- chain of custody
- production certification
- analyst approval banner

## 7. Deficiency Response Draft

Show if request is incomplete:

- missing fields
- reason blocked
- drafted clarification
- analyst approval control

## 8. Human Review

Show:

- agent recommendation
- risk flags
- editable note
- editable response package
- approve route
- request changes
- escalate
- send to QA

## 9. Audit Timeline

Show every action:

- request ingested
- fields extracted
- indexed
- classified
- special handling checked
- route recommended
- ETL simulated
- response drafted
- analyst reviewed
- approval pending/approved
- audit complete

## 10. Audit Detail

Governance view of one request:

- source evidence
- agent decisions
- human decision
- what changed
- final state
- audit completeness

## UI guardrails

- Never show “Send automatically.”
- Never show “Production released by agent.”
- Use “Draft,” “Prepared,” “Pending approval,” “Human review required.”
- Label synthetic/mock data.
- Show data confidence.
- Show evidence/rationale for all agent decisions.

# Response Package Agent Provenance

The Response Package Draft screen should show which agent produced or supported each section.

| Response package section | Agent provenance |
|---|---|
| Request metadata / labels | Indexing Agent |
| Request classification / route | Triaging Agent |
| Produced record index | ETL Agent |
| Internal notes / chain-of-custody fields | Note Taking and Data Entry Agent |
| Production summary / certification draft / deficiency response | Text Content Agent |
| Approval task / escalation / QA routing | Automation Agent |

# Governance Agent Coverage UI

Governance & Insights must include an **Agent Activity** module showing:

- six agents listed by official RFP name
- run count by agent
- blocked/review-required count by agent
- audit events by agent
- average confidence where applicable
- human override count by agent
- scenario coverage indicator

This is required because leadership needs to see that all six RFP agents are actually represented in the prototype.
