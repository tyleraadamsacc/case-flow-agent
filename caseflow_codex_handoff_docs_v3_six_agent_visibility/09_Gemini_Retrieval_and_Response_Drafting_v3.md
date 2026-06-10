# CaseFlow Agent — Gemini, Retrieval, and Response Drafting v2

## Principle

Gemini should support structured extraction, classification, drafting, validation, and insight generation.

Gemini should not own workflow state or approvals.

## Gemini-backed tasks

| Task | Agent / service |
|---|---|
| request extraction | Request Extraction Service |
| legal process classification | Triaging Agent |
| requested data category classification | Triaging Agent |
| note drafting | Note Taking and Data Entry Agent |
| response package drafting | Text Content Agent |
| deficiency response drafting | Text Content Agent |
| QA validation | QA / Guardrail Service |
| governance insight synthesis | Governance Insights Service |

## Prompt files

```text
app/prompts/caseflow/
  request_extraction.md
  triage_classification.md
  note_draft.md
  production_package_draft.md
  deficiency_response_draft.md
  qa_guardrail.md
  governance_insights.md
```

## Request extraction prompt output

```json
{
  "legal_process": {},
  "requesting_agency": {},
  "subject_identifiers": [],
  "requested_data_categories": [],
  "product_domains": [],
  "requested_period": {},
  "special_handling": {},
  "legal_authorities": [],
  "deficiency_findings": [],
  "confidence": 0.91
}
```

## Response package drafting prompt output

The Text Content Agent should draft the Template LERS Response structure:

```json
{
  "header": {
    "request_id": "LER-2026-004812",
    "production_id": "PROD-2026-004812-01",
    "date_produced": "2026-06-09"
  },
  "requesting_agency": {},
  "subject_identifiers": {},
  "production_summary": {},
  "index_of_produced_records": [],
  "data_field_definitions": [],
  "chain_of_custody": {},
  "production_certification": {},
  "risk_flags": [],
  "requires_human_approval": true
}
```

## Retrieval design

Use local retrieval first, Agent Search later.

Evidence types:

- SOP snippets
- routing rules
- deficiency rules
- response package template
- product/domain taxonomy
- sensitive/special handling rules
- mock responsive records

## Evidence reference model

```json
{
  "evidence_id": "RESP-TEMPLATE-001",
  "source_type": "response_template",
  "title": "Template LERS Response",
  "snippet": "Production package includes request ID, production ID, date produced...",
  "confidence": 1.0
}
```

## Structured output validation

All Gemini outputs must validate against Pydantic schemas.

If invalid:

1. attempt one repair call
2. if still invalid, return blocked result
3. require human review
4. audit the failure

## Drafting guardrails

The Text Content Agent must:

- mark all output as draft
- never mark production package as final
- never certify records as final without human approval
- never send or release output
- never include unsupported records
- distinguish mock/synthetic records from real records
- preserve source evidence references

## Model routing

Tasks should be config-driven:

```text
request_extraction -> gemini flash/pro model configured by env
triage_classification -> gemini model configured by env
response_package_draft -> gemini model configured by env
qa_validation -> gemini model configured by env
```

Do not hardcode model IDs in agent files.
