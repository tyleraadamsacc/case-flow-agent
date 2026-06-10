# CaseFlow Agent — Codex Handoff Package v2

## Purpose

This package updates the CaseFlow Agent handoff after new meeting notes, two LERS templates, and the leadership requirement that the six RFP agents must be visibly demonstrated in the UI:

1. Meeting notes from the LIS prototype check-in.
2. `LERS Request Template.docx`
3. `Template LERS Response.docx`

The major update is that CaseFlow should no longer be framed only as **email triage in the Cases Platform**.

It should now be framed as:

> **LERS request intake → extraction → triage → route / escalation → mock data retrieval → response package drafting → human review → governance insights.**

This is still a human-led workflow. The prototype must not imply autonomous legal decision-making, autonomous disclosure, autonomous production, or autonomous email sending.

## What changed from v1

| Area | v1 direction | v2 direction |
|---|---|---|
| Core workflow | Case pool email triage | LERS request package intake and response package preparation |
| Main artifact | PDF page 50 workflow | PDF page 50 + LERS Request Template + Template LERS Response |
| Data model | Case intake and email objects | Legal request, legal process, identifiers, requested data categories, production package |
| Output | Notes and email draft | Response package draft, deficiency response draft, notes, audit trail |
| Governance | Queue health, SLA, audit | Product/domain volume, processing time by product, bottlenecks, response status, agent acceptance, audit |
| Demo scenarios | Triage scenarios | 6 synthetic legal request scenarios |
| Agent visibility | Six agents mapped to case triage | Six agents visibly mapped to request intake and response package preparation |

## Files in this package

| File | Purpose |
|---|---|
| `01_Product_Brief_and_Source_of_Truth_v2.md` | Updated product definition and source hierarchy. |
| `02_LERS_Request_and_Response_Template_Analysis.md` | What the two LERS templates add to the product scope. |
| `03_Synthetic_Data_and_Demo_Scenarios.md` | Synthetic demo scenarios and example payload strategy. |
| `04_Target_GCP_Architecture_v2.md` | Updated GCP/Gemini architecture for request intake and response package drafting. |
| `05_Codex_Workplan_v2.md` | Updated staged workplan for Codex. |
| `06_Backend_Foundation_Scaffold_Spec_v2.md` | Updated backend scaffold spec. |
| `07_Data_Model_and_API_Contracts_v2.md` | Updated core models and API routes. |
| `08_Agent_Contracts_and_Behavior_v2.md` | Updated six-agent contracts mapped to LERS request processing. |
| `09_Gemini_Retrieval_and_Response_Drafting_v2.md` | Gemini, prompt, retrieval, response package drafting, and validation plan. |
| `10_Governance_Insights_and_Audit_Spec_v2.md` | Updated governance layer with product/domain KPIs and audit readiness. |
| `11_UI_Workflow_and_Screen_Requirements_v2.md` | Updated UI screens and flow. |
| `12_Testing_Evaluation_and_Golden_Scenarios_v2.md` | Updated golden scenarios and evaluation plan. |
| `13_Definition_of_Done_v2.md` | Updated definition of done. |
| `14_First_PR_Scope_v2.md` | Updated first PR scope. |
| `15_Story_Capture_Reuse_Analysis_Instructions_v2.md` | Reuse-analysis instructions updated with v2 direction. |
| `00_Combined_Codex_Handoff_Master_v2.md` | Combined single-file package for Codex ingestion. |


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


## Core guardrails

- No Law Enforcement disclosure steps are automated.
- No autonomous production package release.
- No autonomous email sending.
- No production Cases / LERS write-back in MVP.
- No legal determination should be made by the agent.
- Human approval is required for route, note, response package, deficiency response, and any simulated production state.
- Sensitive, urgent, non-disclosure, pen register / trap-and-trace, sealed, low-confidence, ambiguous, missing-field, and overbroad requests require human review.
- Every agent and human action must create an audit event.
- Local development must run without live GCP credentials.
- GCP integrations must be adapter-based and swappable.

## Recommended immediate build path

1. Update mock data and data model around legal request packages.
2. Build deterministic request extraction, classification, validation, response package draft, and audit flow.
3. Add all six agents as visible workflow steps.
4. Add governance metrics around product/domain volume, processing time, bottlenecks, response package status, human overrides, and audit readiness.
5. Add Gemini after deterministic workflow is stable.
