# CaseFlow Agent — Backend Foundation Scaffold Spec v2

## Backend principle

Build a deterministic, typed, auditable workflow backend first. Add Gemini later.

## Suggested structure

```text
app/
  main.py
  config.py
  logging_config.py

  api/
    routes/
      health.py
      legal_requests.py
      extraction.py
      classification.py
      production_package.py
      review.py
      governance.py
      audit.py

  models/
    legal_request.py
    legal_process.py
    requesting_agency.py
    subject_identifier.py
    requested_data_category.py
    product_domain.py
    special_handling.py
    legal_authority.py
    deficiency_finding.py
    classification_result.py
    routing_recommendation.py
    production_package.py
    responsive_record.py
    chain_of_custody.py
    certification.py
    note_draft.py
    text_draft.py
    human_review.py
    audit_event.py
    workflow_state.py
    governance_metric.py

  orchestration/
    caseflow_orchestrator.py
    workflow_state_machine.py
    approval_policy.py

  services/
    request_extraction_service.py
    sensitive_special_handling_service.py
    routing_rules_service.py
    sop_retrieval_service.py
    response_record_service.py
    response_package_service.py
    deficiency_service.py
    audit_service.py
    governance_metrics_service.py

  agents/
    indexing_agent.py
    triaging_agent.py
    etl_agent.py
    note_data_entry_agent.py
    text_content_agent.py
    automation_agent.py
    qa_guardrail_agent.py
    governance_insights_agent.py

  repositories/
    legal_request_repository.py
    local_legal_request_repository.py
    audit_repository.py
    local_audit_repository.py
    response_record_repository.py
    local_response_record_repository.py
    storage_repository.py
    local_storage_repository.py

  prompts/
    caseflow/
      request_extraction.md
      indexing.md
      triage.md
      note_draft.md
      response_package_draft.md
      deficiency_response.md
      qa_guardrail.md
      governance_insights.md

  mock_data/
    legal_requests/
    response_records/
    sop/
    registries/

  tests/
    unit/
    api/
    golden/
```

## Updated workflow states

```text
request_received
→ request_extracted
→ request_indexed
→ request_classified
→ request_validated
→ route_recommended
→ etl_simulated
→ note_drafted
→ response_package_drafted | deficiency_response_drafted
→ analyst_review_pending
→ analyst_approved | escalated | sent_to_qa | changes_requested
→ audit_complete
```

## Approval policy

Human review required when:

- legal process is search warrant
- pen register requested
- trap and trace requested
- non-disclosure requested
- no adverse action requested
- sealed order requested
- location tracking requested
- content requested
- overbroad product/domain scope
- missing required identifier
- missing or invalid date range
- low classification confidence
- SOP conflict
- production package drafted
- deficiency response drafted
- chain-of-custody / certification generated

## Mock services

Before Gemini:

- extraction placeholder reads mock fields
- classification placeholder maps data category to product domain
- sensitive/special handling checker uses deterministic flags
- ETL placeholder reads mock response records
- response package generator uses Template LERS Response structure
- deficiency response generator uses template text
- governance metrics are computed from local repository

## Audit requirements

Every action must record:

- audit_event_id
- legal_request_id
- timestamp
- actor_type
- actor_id
- action
- before_state
- after_state
- summary
- evidence_ids
- confidence
- approval_id
- request_id / correlation_id

## Mock data requirements

Create at least six request scenarios:

1. GPS location happy path
2. missing date range deficiency
3. pen register / trap-and-trace with non-disclosure
4. overbroad all-Google-data request
5. simple subscriber info request
6. no responsive records
