# CaseFlow Agent — Agent Contracts and Behavior v2

## Principle

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

## Six-Agent Contract Requirements

Each of the six RFP agents must have:

- backend service class or function
- typed input schema
- typed output schema
- deterministic/mock mode
- Gemini-ready prompt profile if applicable
- visible UI card/step
- structured output summary
- confidence/rationale/evidence where applicable
- audit event type
- golden scenario coverage
- failure behavior



The six RFP agents must be visibly represented in the prototype. They should be bounded workflow capabilities, not standalone chatbots.

## 1. Indexing Agent

### Purpose

Rank and index legal requests according to SOP and training materials.

### CaseFlow v2 role

Index request package by:

- legal process type
- requesting agency
- subject identifiers
- requested data categories
- product/domain
- legal authority
- date range
- special handling flags
- priority / risk

### Output

```json
{
  "primary_labels": ["search_warrant", "gps_location", "maps_location"],
  "product_domains": ["Maps / Location"],
  "legal_process_tags": ["stored_communications", "location_tracking"],
  "priority_rank": 1,
  "sop_matches": ["SOP-REQUEST-INTAKE-LOCATION"],
  "confidence": 0.92
}
```

## 2. Triaging Agent

### Purpose

Use request content to triage and classify request in correct pool.

### CaseFlow v2 role

Classify:

- request type
- product/domain
- urgency
- sensitivity
- SME review requirement
- target queue
- missing fields
- complexity level

### Output

```json
{
  "legal_process_type": "Search Warrant",
  "request_category": "Location Data Production",
  "product_domains": ["Maps / Location"],
  "urgency_tier": "P1",
  "recommended_queue": "Location Response Review",
  "confidence": 0.94,
  "human_review_required": true,
  "review_reasons": ["production_package_required"]
}
```

## 3. ETL Agent

### Purpose

Query data from backend systems according to SOP.

### CaseFlow v2 role

For MVP, simulate approved responsive record retrieval from mock data.

### Output

```json
{
  "query_type": "mock_location_data_pull",
  "data_sources_checked": ["mock_location_repository"],
  "total_responsive_records": 8,
  "data_confidence": "synthetic_mock",
  "limitations": ["No production backend connected"]
}
```

### Guardrails

- Mock only in MVP.
- Read-only.
- Label data confidence.
- No real user data.
- No production data pull.

## 4. Note Taking and Data Entry Agent

### Purpose

Take notes and perform data entry in predefined format.

### CaseFlow v2 role

Draft:

- request summary note
- classification note
- routing rationale
- deficiency note
- response package preparation note
- analyst decision note

### Output

```json
{
  "note_type": "request_intake_note",
  "body": "Search warrant received from synthetic agency. Request seeks GPS location records for ACC-7784512 from May 10–15, 2026. Routed to Location Response Review.",
  "fields_to_update": {
    "legal_process": "Search Warrant",
    "product_domain": "Maps / Location",
    "recommended_queue": "Location Response Review"
  },
  "requires_human_approval": true
}
```

## 5. Text Content Agent

### Purpose

Create text material such as draft email based on SOP.

### CaseFlow v2 role

Draft:

- response package narrative
- production summary
- field definitions
- chain-of-custody language
- certification draft
- deficiency response
- SME notification

### Output

```json
{
  "draft_type": "production_package",
  "sections": {
    "production_summary": "...",
    "field_definitions": "...",
    "chain_of_custody": "...",
    "certification": "..."
  },
  "status": "draft_not_final",
  "requires_human_approval": true
}
```

### Guardrails

- Never send.
- Never certify final production.
- Never release records.
- No disclosure automation.
- Human review required.

## 6. Automation Agent

### Purpose

Automate manual workflow steps such as transfers or escalations.

### CaseFlow v2 role

Prepare actions:

- route to queue
- assign owner
- escalate to SME
- send to QA
- flag SLA risk
- mark response package awaiting review
- create follow-up task

### Output

```json
{
  "action_type": "prepare_escalation",
  "target": "SME Review",
  "reason": "Pen register and non-disclosure requested.",
  "requires_approval": true,
  "status": "prepared_pending_human"
}
```

## Supporting control services

These may appear in backend and UI but should not distract from the six RFP agents.

| Service | Purpose |
|---|---|
| Request Extraction Service | Extract structured fields from request package. |
| Sensitive / Special Handling Checker | Detect non-disclosure, sealed, pen register, trap-and-trace, no adverse action, location/content flags. |
| QA / Guardrail Service | Validate missing fields, disclosure risk, unsupported claims, missing approval, audit completeness. |
| Governance Insights Service | Generate operational insights from metrics and audit trail. |

## Agent output requirements

Every agent output must include:

- `agent_name`
- `schema_version`
- `confidence`
- `rationale`
- `evidence_ids`
- `requires_human_review`
- `risk_flags`
- `audit_metadata`

# Six-Agent UI Output Contract

Every agent run should expose a UI-safe summary object:

```json
{
  "agent_id": "triaging_agent",
  "agent_name": "Triaging Agent",
  "status": "complete",
  "input_summary": "Search warrant requesting GPS location records for one account/device",
  "output_summary": "Classified as Location Data Production; recommended Location Response Review",
  "confidence": 0.94,
  "evidence_ids": ["SOP-REQUEST-INTAKE-LOCATION", "ROUTE-LOCATION-P1"],
  "requires_human_review": true,
  "review_reason": ["production_package_required"],
  "audit_event_id": "audit_002"
}
```

The UI must use the official RFP agent names exactly:

1. Text Content Agent
2. Automation Agent
3. ETL Agent
4. Note Taking and Data Entry Agent
5. Triaging Agent
6. Indexing Agent
