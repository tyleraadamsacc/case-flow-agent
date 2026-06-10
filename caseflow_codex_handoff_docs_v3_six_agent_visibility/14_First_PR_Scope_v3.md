# CaseFlow Agent — First PR Scope v2

## Goal

The first PR must create a deterministic six-agent scaffold. The six agents can be mock/deterministic, but they must exist as named workflow actors and produce structured outputs.



The first PR should establish the deterministic request-processing workflow with mock data.

Do not add Gemini yet.

## Include

### Backend

- FastAPI app shell
- `/healthz`
- config loader
- structured logging
- local repositories
- core Pydantic models
- workflow state machine
- approval policy
- audit service
- mock data loader

### Models

- `LegalRequest`
- `LegalProcess`
- `RequestingAgency`
- `SubjectIdentifier`
- `RequestedDataCategory`
- `RequestedPeriod`
- `SpecialHandlingFlags`
- `DeficiencyFinding`
- `ClassificationResult`
- `RoutingRecommendation`
- `ProductionPackage`
- `ResponsiveRecord`
- `ChainOfCustody`
- `Certification`
- `HumanReview`
- `AuditEvent`
- `WorkflowState`

### Endpoints

- `GET /api/legal-requests`
- `GET /api/legal-requests/{id}`
- `POST /api/legal-requests/{id}/extract`
- `POST /api/legal-requests/{id}/index`
- `POST /api/legal-requests/{id}/classify`
- `POST /api/legal-requests/{id}/validate`
- `POST /api/legal-requests/{id}/etl/simulate`
- `POST /api/legal-requests/{id}/production-package/draft`
- `POST /api/legal-requests/{id}/review`
- `GET /api/legal-requests/{id}/audit`
- `GET /api/governance/summary`
- `GET /api/governance/work-needing-attention`
- `GET /api/governance/agent-activity`
- `GET /api/legal-requests/{id}/agent-runs`

### Six-agent scaffold

Create deterministic/mock implementations or stubs for:

- Indexing Agent
- Triaging Agent
- ETL Agent
- Note Taking and Data Entry Agent
- Text Content Agent
- Automation Agent

Each should return:

- official agent name
- status
- input summary
- output summary
- confidence if applicable
- evidence IDs if applicable
- audit event ID

### Mock scenarios

At least:

1. GPS location happy path
2. missing date range deficiency
3. pen register / trap-and-trace with non-disclosure
4. overbroad all-Google-data request
5. simple subscriber info request
6. no responsive records

### Tests

- health endpoint
- request list
- request detail
- extraction placeholder
- classification placeholder
- validation / deficiency detection
- ETL simulation
- production package draft
- review endpoint
- audit timeline
- governance summary
- invalid state transition
- approval policy

## Exclude

- Gemini
- Agent Search
- Firestore
- Cloud Storage
- production LERS integration
- production Cases write-back
- production email send
- legal sufficiency determination
- Terraform
- final UI polish

## Acceptance criteria

- app runs locally
- tests pass locally
- no GCP credentials needed
- Scenario A runs end-to-end and includes all six agent outputs
- every state-changing endpoint writes audit event
- production package is draft-only
- human approval required
- mock data clearly marked
- no unsafe endpoint names like `/send-final-response`

## First PR six-agent acceptance criteria

- `agent_runs` object exists on request detail response
- Scenario A produces six agent run records
- each agent run writes an audit event
- governance summary exposes agent activity counts
- tests confirm all six official RFP agent names are present
- no generic `ai_agent` placeholder is used in place of the six named agents
