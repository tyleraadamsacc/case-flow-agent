# CaseFlow Agent — Testing, Evaluation, and Golden Scenarios v2

## Test principle

The deterministic workflow must pass before Gemini is added.

## Golden scenarios

1. GPS location happy path
2. missing date range deficiency
3. pen register / trap-and-trace with non-disclosure
4. overbroad all-Google-data request
5. simple subscriber info request
6. no responsive records
7. regulator / sensitive sender
8. low-confidence product/domain classification
9. SOP conflict
10. missing audit event blocks finalization
11. human route override
12. response package edited by analyst

## Required assertions

### Request extraction

- legal process extracted
- agency extracted
- identifiers extracted
- requested data categories extracted
- product domains classified
- date range validated
- legal authorities extracted
- special handling flags detected
- placeholder/instruction text ignored

### Classification

- search warrant classification correct
- location data request classified as Maps / Location
- subscriber info classified correctly
- pen register / trap-and-trace requires SME review
- non-disclosure requires SME review
- overbroad scope requires SME review

### ETL simulation

- Scenario A returns 8 GPS records.
- Scenario F returns 0 records.
- All ETL results are marked synthetic/mock.
- No real data source required.

### Drafting

- response package follows Template LERS Response structure
- deficiency response generated for missing fields
- chain-of-custody draft created
- certification draft marked pending approval
- no draft is marked final by agent

### Guardrails

- no autonomous send
- no autonomous production release
- no disclosure automation
- human approval required for response package
- missing audit event blocks finalization

## Evaluation metrics

| Metric | MVP target |
|---|---|
| Request extraction schema validity | 100% |
| Classification schema validity | 100% |
| Response package schema validity | 100% |
| Special handling recall on seeded cases | 100% |
| Missing field detection on seeded cases | 100% |
| Audit event coverage | 100% |
| Human approval gate coverage | 100% |
| Golden scenario pass rate | 100% deterministic mode |
| Local tests without credentials | Required |

## Test commands

Codex should support:

```bash
make test
make test-unit
make test-api
make test-golden
```

# Six-Agent Visibility Tests

Add tests that prove all six RFP agents are functional and visible.

## Required backend tests

- each of the six agents returns a valid structured output
- each of the six agents writes an audit event
- Scenario A includes all six agent outputs
- each agent output includes `agent_id`, `agent_name`, `status`, `output_summary`, and `audit_event_id`
- no agent output is hidden behind a generic service name
- all official RFP agent names are present exactly

## Required API tests

- request detail response includes `agent_runs` for all six agents after Scenario A
- audit timeline includes events for all six agents
- governance summary includes agent activity / coverage metrics
- work needing attention items reference agent outputs where applicable

## Required UI/e2e tests, if frontend test framework exists

- Six-Agent Workflow Rail renders all six agents
- each agent card shows status and output summary
- clicking agent evidence opens or reveals evidence/rationale
- clicking audit event opens the audit timeline entry
- governance screen shows Agent Activity / RFP Agent Coverage module

## Required golden scenario coverage

| Scenario | Must include all six agents? | Notes |
|---|---:|---|
| Scenario A — GPS location happy path | Yes | Primary six-agent demo |
| Scenario B — missing date range | No, ETL may be blocked | Must show ETL blocked due to deficiency |
| Scenario C — pen register / non-disclosure | No, ETL may be blocked | Must show Automation Agent prepares SME escalation |
| Scenario F — no responsive records | Yes | ETL returns zero records; Text Content drafts no-records package |
