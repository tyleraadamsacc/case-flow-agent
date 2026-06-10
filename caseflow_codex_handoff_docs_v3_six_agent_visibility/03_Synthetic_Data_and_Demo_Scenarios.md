# CaseFlow Agent — Synthetic Data and Demo Scenarios v2

## Principle

The meeting notes emphasized that the team needs credible synthetic examples quickly. The goal is clarity and storytelling, not perfect realism.

Use synthetic data only for MVP.

## Required synthetic dataset

Create a synthetic dataset with:

- legal request documents
- extracted request fields
- mock SOP/routing rules
- mock sensitive-party registry
- mock product/data-domain taxonomy
- mock responsive record repository
- mock response package outputs
- mock audit events
- mock governance metrics

## Scenario set

### Scenario A — Happy path GPS location production package

| Field | Value |
|---|---|
| Request type | Search warrant |
| Data category | GPS location records |
| Product/domain | Maps / Location |
| Identifiers | Account ID, customer reference, device ID |
| Date range | May 10–15, 2026 |
| Expected behavior | Extract → classify → route → mock ETL → draft response package → analyst approval |
| Agents shown | All six |

Purpose: demonstrates end-to-end value.

### Scenario B — Deficiency: missing date range

| Field | Value |
|---|---|
| Request type | Search warrant |
| Data category | Subscriber + location records |
| Problem | Missing or invalid date range |
| Expected behavior | Extract partial fields → flag deficiency → draft clarification response → hold for analyst |
| Agents shown | Indexing, Triaging, Note/Data, Text Content, Automation |

Purpose: demonstrates quality control and human intervention.

### Scenario C — Escalation: pen register / trap and trace with non-disclosure

| Field | Value |
|---|---|
| Request type | Ex parte order + pen register / trap and trace |
| Special handling | Non-disclosure, no adverse action, ongoing access |
| Expected behavior | High-sensitivity classification → SME escalation → block auto-response → audit reason |
| Agents shown | Indexing, Triaging, Automation, Note/Data, Governance |

Purpose: demonstrates safety and escalation.

### Scenario D — Overbroad request for all Google data

| Field | Value |
|---|---|
| Request type | Search warrant |
| Data category | Broad list across Gmail, YouTube, Drive, Photos, Voice, Pay, Tombstone |
| Problem | Overbroad / complex request scope |
| Expected behavior | Flag broad scope → classify multiple product domains → require SME review |
| Agents shown | Indexing, Triaging, QA/Guardrail, Governance |

Purpose: demonstrates complexity handling.

### Scenario E — Common case: subscriber information request

| Field | Value |
|---|---|
| Request type | Legal process request |
| Data category | Subscriber info and account creation |
| Expected behavior | Fast extraction, triage, route, note draft |
| Agents shown | Indexing, Triaging, Note/Data, Automation |

Purpose: demonstrates the 80% common case.

### Scenario F — No responsive records

| Field | Value |
|---|---|
| Request type | Search warrant |
| Data category | GPS location records |
| Mock ETL result | 0 responsive records |
| Expected behavior | Draft “no responsive records” package for analyst review |
| Agents shown | ETL, Text Content, Note/Data, Audit |

Purpose: demonstrates response package variation.

## Example synthetic request object

```json
{
  "request_id": "LER-2026-004812",
  "source_type": "lers_request_template",
  "legal_process_type": "Search Warrant",
  "requesting_agency": {
    "agency": "Los Angeles County Sheriff's Office",
    "case_number": "MC-26-11784",
    "officer": "Detective Sarah Johnson"
  },
  "date_received": "2026-06-01",
  "recipient": "Google Legal Investigations Support",
  "subject_identifiers": {
    "gmail_account": "synthetic.user@example.com",
    "google_id": "ACC-7784512",
    "device_id": "DEV-88471"
  },
  "requested_data_categories": ["GPS Location Records"],
  "product_domains": ["Maps / Location"],
  "requested_period": {
    "start": "2026-05-10T00:00:00Z",
    "end": "2026-05-15T23:59:59Z"
  },
  "special_handling": {
    "sealed": false,
    "non_disclosure_to_subscriber": false,
    "no_adverse_action": false,
    "pen_register_requested": false,
    "trap_and_trace_requested": false,
    "ongoing_access_requested": false
  }
}
```

## Example synthetic response records

```json
[
  {
    "record_id": "GPS-0001",
    "timestamp_utc": "2026-05-10T08:14:22Z",
    "latitude": 39.7421,
    "longitude": -104.9915,
    "accuracy_meters": 12,
    "source": "Mobile Device"
  },
  {
    "record_id": "GPS-0002",
    "timestamp_utc": "2026-05-10T09:47:03Z",
    "latitude": 39.7395,
    "longitude": -104.9848,
    "accuracy_meters": 15,
    "source": "Mobile Device"
  }
]
```

## Synthetic data files to create

```text
mock_data/
  legal_requests/
    scenario_a_gps_happy_path.json
    scenario_b_missing_date_range.json
    scenario_c_pen_register_nondisclosure.json
    scenario_d_overbroad_all_google_data.json
    scenario_e_subscriber_info_common.json
    scenario_f_no_responsive_records.json

  response_records/
    gps_records_scenario_a.json
    empty_records_scenario_f.json

  sop/
    request_intake_sop.json
    routing_rules.json
    deficiency_rules.json
    response_package_rules.json
    special_handling_rules.json

  registries/
    sensitive_party_registry.json
    product_domain_taxonomy.json
```

## Demo path

Use Scenario A as the primary demo. Keep Scenario C as the “safety / complexity” demo. Keep Scenario B as the quality-control demo.

# Six-Agent Demo Coverage Matrix

Every synthetic scenario should identify which of the six RFP agents participates. Scenario A must show all six.

| Scenario | Indexing | Triaging | ETL | Notes/Data Entry | Text Content | Automation | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| A — GPS location happy path | Yes | Yes | Yes | Yes | Yes | Yes | Primary end-to-end six-agent demo |
| B — Missing date range deficiency | Yes | Yes | No | Yes | Yes | Yes | ETL blocked because request is deficient |
| C — Pen register / non-disclosure escalation | Yes | Yes | No | Yes | Yes | Yes | ETL blocked; Automation prepares SME escalation |
| D — Overbroad all-Google-data request | Yes | Yes | No | Yes | Yes | Yes | Text Content drafts review/clarification package |
| E — Subscriber information common case | Yes | Yes | Optional | Yes | Yes | Yes | Demonstrates common high-volume flow |
| F — No responsive records | Yes | Yes | Yes | Yes | Yes | Yes | ETL returns zero records; Text Content drafts no-records package |

## Required agent-specific mock outputs

For each scenario, mock data should include an `agent_runs` section:

```json
{
  "agent_runs": {
    "indexing_agent": {
      "status": "complete",
      "output_summary": "Indexed as Search Warrant + GPS Location + Maps/Location",
      "audit_event_id": "audit_001"
    },
    "triaging_agent": {
      "status": "complete",
      "output_summary": "Routed to Location Response Review with 94% confidence",
      "audit_event_id": "audit_002"
    },
    "etl_agent": {
      "status": "complete",
      "output_summary": "8 mock GPS records returned",
      "audit_event_id": "audit_003"
    },
    "note_taking_data_entry_agent": {
      "status": "complete",
      "output_summary": "Internal response-prep note drafted",
      "audit_event_id": "audit_004"
    },
    "text_content_agent": {
      "status": "complete",
      "output_summary": "Response package draft generated",
      "audit_event_id": "audit_005"
    },
    "automation_agent": {
      "status": "complete",
      "output_summary": "Prepared analyst approval task",
      "audit_event_id": "audit_006"
    }
  }
}
```
