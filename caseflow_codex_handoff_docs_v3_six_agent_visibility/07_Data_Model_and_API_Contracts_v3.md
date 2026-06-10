# CaseFlow Agent — Data Model and API Contracts v2

## Core data objects

### LegalRequest

```json
{
  "legal_request_id": "LER-2026-004812",
  "source_type": "lers_request_template",
  "date_received": "2026-06-01",
  "workflow_state": "request_received",
  "requesting_agency": {},
  "legal_process": {},
  "subject_identifiers": [],
  "requested_data_categories": [],
  "product_domains": [],
  "requested_period": {},
  "special_handling": {},
  "legal_authorities": [],
  "raw_source_uri": "local://mock_data/legal_requests/scenario_a.docx"
}
```

### LegalProcess

```json
{
  "type": "Search Warrant",
  "court_order_included": true,
  "ex_parte_order": false,
  "pen_register": false,
  "trap_and_trace": false,
  "location_tracking": true,
  "stored_communications": true
}
```

### RequestingAgency

```json
{
  "agency": "Los Angeles County Sheriff's Office",
  "case_number": "MC-26-11784",
  "officer": "Detective Sarah Johnson",
  "contact_email": "synthetic.detective@example.gov",
  "phone": "555-0100"
}
```

### SubjectIdentifier

```json
{
  "type": "account_id",
  "value": "ACC-7784512",
  "confidence": 0.98,
  "source_span": "Account ID: ACC-7784512"
}
```

### RequestedDataCategory

```json
{
  "category": "GPS Location Records",
  "product_domain": "Maps / Location",
  "sensitivity": "high",
  "content_type": "location",
  "requires_sme_review": false
}
```

### RequestedPeriod

```json
{
  "start": "2026-05-10T00:00:00Z",
  "end": "2026-05-15T23:59:59Z",
  "valid": true,
  "issues": []
}
```

### SpecialHandlingFlags

```json
{
  "sealed": false,
  "non_disclosure_to_subscriber": false,
  "no_adverse_action": false,
  "pen_register_requested": false,
  "trap_and_trace_requested": false,
  "ongoing_access_requested": false,
  "location_tracking_requested": true,
  "content_requested": false,
  "tombstone_requested": false
}
```

### DeficiencyFinding

```json
{
  "code": "missing_date_range",
  "severity": "blocking",
  "message": "Requested period is missing or incomplete.",
  "requires_human_review": true,
  "suggested_resolution": "Request clarification from the requesting agency."
}
```

### ProductionPackage

```json
{
  "request_id": "LER-2026-004812",
  "production_id": "PROD-2026-004812-01",
  "date_produced": "2026-06-09",
  "requesting_agency": {},
  "subject_identifiers": {},
  "production_summary": {},
  "records": [],
  "field_definitions": [],
  "chain_of_custody": {},
  "certification": {},
  "status": "draft_pending_analyst_review"
}
```

### ResponsiveRecord

```json
{
  "record_id": "GPS-0001",
  "timestamp_utc": "2026-05-10T08:14:22Z",
  "latitude": 39.7421,
  "longitude": -104.9915,
  "accuracy_meters": 12,
  "source": "Mobile Device"
}
```

## API contracts

### Health

`GET /healthz`

### Legal requests

`GET /api/legal-requests`

`GET /api/legal-requests/{legal_request_id}`

`POST /api/legal-requests`

### Extraction and classification

`POST /api/legal-requests/{id}/extract`

`POST /api/legal-requests/{id}/index`

`POST /api/legal-requests/{id}/classify`

`POST /api/legal-requests/{id}/validate`

`POST /api/legal-requests/{id}/route-recommendation`

### ETL / responsive records

`POST /api/legal-requests/{id}/etl/simulate`

`GET /api/legal-requests/{id}/responsive-records`

### Draft outputs

`POST /api/legal-requests/{id}/notes/draft`

`POST /api/legal-requests/{id}/production-package/draft`

`GET /api/legal-requests/{id}/production-package`

`POST /api/legal-requests/{id}/deficiency-response/draft`

### Review

`POST /api/legal-requests/{id}/review`

`POST /api/legal-requests/{id}/approve`

`POST /api/legal-requests/{id}/escalate`

`POST /api/legal-requests/{id}/send-to-qa`

### Audit

`GET /api/legal-requests/{id}/audit`

`GET /api/audit/events`

### Governance

`GET /api/governance/summary`

`GET /api/governance/work-needing-attention`

`GET /api/governance/product-volume`

`GET /api/governance/processing-time-by-product`

`GET /api/governance/bottlenecks`

`GET /api/governance/audit-readiness`

`GET /api/governance/agent-performance`

`GET /api/governance/response-package-status`

## Response package draft API output

```json
{
  "production_package": {
    "request_id": "LER-2026-004812",
    "production_id": "PROD-2026-004812-01",
    "status": "draft_pending_analyst_review"
  },
  "requires_human_approval": true,
  "risk_flags": [],
  "audit_event": {}
}
```
