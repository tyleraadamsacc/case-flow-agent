# CaseFlow Agent — Product Brief and Source of Truth v2

## Product statement

**CaseFlow Agent** is a GCP-native, human-led agentic workflow for Google Legal Investigations Support / LERS-style request processing.

It assists legal operations analysts with:

- LERS request package intake
- request document parsing
- legal process extraction
- subject identifier extraction
- requested data category extraction
- product / data-domain classification
- urgency and sensitivity classification
- special-handling detection
- missing-field / deficiency detection
- route and escalation recommendations
- mock data pull / ETL simulation
- response package drafting
- deficiency response drafting
- backend note drafting
- analyst review and approval
- audit logging
- governance insights

It is **not** a chatbot and it is **not** autonomous legal processing.

## Updated source-of-truth hierarchy

| Priority | Source | How Codex should use it |
|---:|---|---|
| 1 | Meeting notes | Establish prototype priorities: governance/insights, synthetic data, all six agents visible, triage + response, AHT/CCI alignment. |
| 2 | LERS Request Template | Defines request intake fields, request complexity, legal process flags, product/data categories, identifiers, special handling. |
| 3 | Template LERS Response | Defines response package output contract: request ID, production ID, agency, identifiers, production summary, records, definitions, chain of custody, certification. |
| 4 | PDF page 50 | Existing core workflow: email triage in Cases Platform; still useful as intake/routing/audit guardrail. |
| 5 | PDF page 48 | Six illustrative agents that must be visibly represented. |
| 6 | PDF page 47 | Agentic architecture guardrails: GCP-native, no Core Eng changes, risk controls, escalation logic, UAT, no LE disclosure automation. |
| 7 | PDF pages 36–43 and 53–54 | Governance/analytics requirements: queue health, SLA, bottlenecks, AHT, TAT, data confidence. |
| 8 | Story Capture backend reuse analysis | Implementation pattern reference only. |
| 9 | UI mockups/design direction | Frontend visual direction only. |

## Updated product thesis

The prototype should show a controlled workflow where CaseFlow Agent can ingest a real-style legal request package, extract operationally relevant fields, classify and prioritize the request, prepare routing/escalation, simulate approved data retrieval, draft a response package, and preserve a complete audit trail for human review.

## Updated MVP narrative

> “CaseFlow Agent helps legal operations teams turn complex LERS requests into structured, reviewable work. It extracts the request, classifies the legal process and product/data domain, identifies risk flags and missing information, recommends routing, simulates approved data retrieval, drafts a response package, and gives leaders a governance view of volume, processing time, bottlenecks, exceptions, and audit readiness.”


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


## Non-negotiable product guardrails

- The agent does not decide whether production is legally valid.
- The agent does not release records.
- The agent does not send the final response.
- The agent does not automate LE disclosure steps.
- The agent does not make legal determinations.
- The agent does not write to production Google systems in MVP.
- Every route, note, draft, response package, or escalation remains human-reviewed.
- All sensitive handling flags require analyst / SME review.
- Auditability is a first-class product feature.

## Primary users

| User | Needs |
|---|---|
| Analyst | Review extracted request fields, classification, route recommendation, note draft, response package draft, and approve/escalate. |
| SME | Review sensitive, complex, missing-field, sealed, non-disclosure, pen register / trap-and-trace, or low-confidence cases. |
| QA / Governance reviewer | Inspect agent decisions, human overrides, missing review steps, and audit trail completeness. |
| Operations lead | Monitor volume by product, SLA risk, processing time, backlog, response package status, escalations, and agent usefulness. |
| Google stakeholder | Understand whether the workflow is controlled, compliant, auditable, and economically relevant. |

## Updated MVP scope

The MVP should demonstrate:

0. all six RFP agents visibly acting on data in a named workflow rail
1. request intake queue
2. request detail page showing source request and extracted fields
3. all six agents visibly represented
4. legal process and product/domain classification
5. special-handling and risk flag detection
6. missing-field / deficiency detection
7. route / escalation recommendation
8. mock ETL / responsive record simulation
9. response package draft based on the Template LERS Response
10. deficiency response draft for bad requests
11. analyst review / approval
12. audit timeline
13. governance dashboard

## Out of scope for MVP

- production LERS integration
- production Cases write-back
- production data pull from Google systems
- production email send
- actual disclosure automation
- legal sufficiency determination
- external law enforcement portal access
- real requester data
- real PII
- cross-silo production deployment

## Key open questions

1. Which request types are highest volume?
2. Which product/domain segmentation matters most: Gmail, Android, YouTube, Maps/Location, Voice, Drive, Photos, Pay, etc.?
3. What are the actual queue names and routing rules?
4. What makes a request deficient?
5. Which request types always require SME review?
6. What AHT reduction assumptions should the demo align to?
7. Should response drafting show “draft package only” or “approved production package” with synthetic records?

## Required Six-Agent Demo Coverage

The MVP must include one primary scenario where all six agents run in sequence against the same legal request.

Recommended primary scenario: **Scenario A — GPS location happy path**.

| Agent | Required output in Scenario A |
|---|---|
| Indexing Agent | Request labels: search warrant, GPS/location, Maps/Location, account/device identifiers |
| Triaging Agent | Product/domain, urgency, route recommendation, review need |
| ETL Agent | Mock responsive records and data confidence |
| Note Taking and Data Entry Agent | Internal note draft and fields to update |
| Text Content Agent | Response package draft sections |
| Automation Agent | Prepared route/assignment/approval action |

Secondary scenarios may skip ETL when no data pull is appropriate, but the total demo set must show each of the six agents at least once.
