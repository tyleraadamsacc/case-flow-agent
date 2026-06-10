# CaseFlow Agent — Governance Insights and Audit Spec v2

## Purpose

The governance layer is a core differentiator. It should show decision-makers where volume, delays, compliance risk, and operational bottlenecks are concentrated.

## Updated governance focus

The meeting notes emphasized:

- volume distribution by product
- processing time by product
- turnaround efficiency
- compliance bottlenecks
- highest AHT reduction potential
- CCI / financial alignment
- all six agents visibly acting on data

## Executive metrics

| Metric | Definition |
|---|---|
| Incoming requests | Count of legal requests in selected period. |
| Open backlog | Requests not completed. |
| SLA-risk requests | Requests at risk of deadline breach. |
| Product/domain volume | Request count by Gmail, Android, YouTube, Maps/Location, Voice, Drive, Photos, etc. |
| AHT by request type | Average handling time by request category. |
| TAT by legal process | Turnaround time by search warrant, subpoena, court order, pen register, etc. |
| Deficiency rate | Percent of requests missing fields or requiring clarification. |
| SME escalation rate | Percent requiring SME review. |
| Response package draft rate | Percent with agent-drafted response package. |
| Human override rate | Percent where analyst changed agent classification/route/draft. |
| Audit coverage | Percent of required events logged. |

## Product/domain segmentation

Suggested domains:

- Gmail
- Android
- YouTube
- Maps / Location
- Google Voice
- Drive / Docs / Sheets / Slides
- Photos / Videos
- Pay / Payments
- Calendar
- Contacts
- Google Cloud / Google One
- Chromebook
- Tombstone archive

## Work Needing Attention

Prioritize:

- missing identifiers
- missing/invalid date range
- pen register / trap-and-trace
- non-disclosure
- sealed matters
- no adverse action
- overbroad request scope
- low-confidence classification
- SLA risk
- response package awaiting approval
- audit exceptions
- no responsive records requiring review

## Audit event taxonomy

| Event | Actor |
|---|---|
| `request_ingested` | system |
| `request_extracted` | request_extraction_service |
| `request_indexed` | indexing_agent |
| `request_classified` | triaging_agent |
| `special_handling_checked` | special_handling_service |
| `route_recommended` | triaging_agent |
| `etl_simulated` | etl_agent |
| `note_drafted` | note_data_entry_agent |
| `production_package_drafted` | text_content_agent |
| `deficiency_response_drafted` | text_content_agent |
| `qa_validation_completed` | qa_guardrail_service |
| `analyst_reviewed` | analyst |
| `route_approved` | analyst |
| `response_package_approved` | analyst |
| `request_escalated` | analyst / automation_agent |
| `sent_to_qa` | analyst |
| `finalization_blocked` | qa_guardrail_service |
| `audit_completed` | system |

## Audit readiness

Track:

- complete audit trail count
- missing required review steps
- agent actions logged
- human approvals logged
- response package drafts approved before release
- deficiency responses approved before sending
- exceptions requiring review

## Data confidence

Every governance metric should be labeled:

- `fully_tracked`
- `partially_tracked`
- `estimated`
- `synthetic_mock`
- `unavailable`

## Governance insight example

```json
{
  "title": "Location requests are driving SLA risk",
  "what_changed": "Maps / Location requests represent 38% of open backlog and 62% of SLA-risk items.",
  "why_it_matters": "Location productions require more review and response package preparation time.",
  "suggested_action": "Shift one analyst to Location Response Review for the afternoon window.",
  "evidence_ids": ["metric:product-volume-location", "metric:sla-risk-location"],
  "data_confidence": "synthetic_mock"
}
```

# Agent Activity / Agent Coverage Metrics

The governance layer must prove that all six agents are operating, not hidden.

## Required agent coverage metrics

| Metric | Definition |
|---|---|
| Agent runs by agent | Count of completed runs per RFP agent. |
| Blocked runs by agent | Count of agent runs that failed, blocked, or required human review. |
| Average confidence by agent | Mean confidence for agents that produce confidence. |
| Human overrides by agent | Number of times a human changed an agent's output. |
| Audit events by agent | Count of audit events written by each agent. |
| Scenario coverage by agent | Which synthetic scenarios demonstrate each agent. |
| Agent output acceptance | Percent of agent outputs accepted with no/minor/major edits. |

## Required governance module

Add a UI module titled **Six-Agent Activity** or **RFP Agent Coverage**.

Example:

```json
{
  "title": "RFP Agent Coverage",
  "period": "last_7_days",
  "agents": [
    {"agent": "Indexing Agent", "runs": 128, "audit_events": 128, "coverage": "demonstrated"},
    {"agent": "Triaging Agent", "runs": 128, "audit_events": 128, "coverage": "demonstrated"},
    {"agent": "ETL Agent", "runs": 42, "audit_events": 42, "coverage": "demonstrated"},
    {"agent": "Note Taking and Data Entry Agent", "runs": 71, "audit_events": 71, "coverage": "demonstrated"},
    {"agent": "Text Content Agent", "runs": 56, "audit_events": 56, "coverage": "demonstrated"},
    {"agent": "Automation Agent", "runs": 64, "audit_events": 64, "coverage": "demonstrated"}
  ]
}
```

## Audit filter requirement

The audit timeline must support filtering by agent name so a reviewer can inspect what each agent did.
