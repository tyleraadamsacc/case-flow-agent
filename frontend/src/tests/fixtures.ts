/** Test fixtures shaped like the backend wire format. */

import type {
  AgentRun,
  LegalRequest,
  ProductionPackage,
} from "../api/types";

export function makeAgentRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    agent_run_id: "run_test0001",
    legal_request_id: "LER-2026-004812",
    agent_id: "indexing_agent",
    agent_name: "Indexing Agent",
    status: "complete",
    input_summary: "Synthetic request fields.",
    output_summary: "Labeled the request.",
    output: {},
    confidence: 0.95,
    rationale: null,
    evidence_ids: ["SOP-TEST-001"],
    requires_human_review: false,
    review_reasons: [],
    risk_flags: [],
    blocked_reason: null,
    validation_status: "valid",
    started_at: "2026-06-10T08:43:00Z",
    completed_at: "2026-06-10T08:43:01Z",
    latency_ms: 12.5,
    audit_event_id: "evt_test0001",
    model_id: null,
    prompt_version: null,
    retry_count: 0,
    ...overrides,
  };
}

export function makeProductionPackage(
  overrides: Partial<ProductionPackage> = {},
): ProductionPackage {
  return {
    request_id: "LER-2026-004812",
    production_id: "PROD-LER-2026-004812-01",
    date_produced: "2026-06-10",
    requesting_agency: {
      agency: "Synthetic County Sheriff (SYNTHETIC)",
      case_number: "MC-26-11784",
      officer: "Detective Synthetic",
      contact_email: null,
      phone: null,
      address: null,
    },
    subject_identifiers: [
      {
        type: "account_id",
        value: "ACC-7784512",
        confidence: 0.99,
        source_span: null,
      },
    ],
    production_summary: {
      start_date: "2026-05-10T00:00:00Z",
      end_date: "2026-05-15T00:00:00Z",
      total_responsive_records: 2,
      ordinary_course_statement: "Synthetic records for prototype demo.",
    },
    records: [
      {
        record_id: "GPS-0001",
        timestamp_utc: "2026-05-10T08:14:00Z",
        latitude: 39.7421,
        longitude: -104.9915,
        accuracy_meters: 12,
        source: "Mobile Device",
        data_confidence: "synthetic_mock",
      },
      {
        record_id: "GPS-0002",
        timestamp_utc: "2026-05-11T09:47:00Z",
        latitude: 39.7395,
        longitude: -104.9848,
        accuracy_meters: 15,
        source: "Mobile Device",
        data_confidence: "synthetic_mock",
      },
    ],
    field_definitions: [
      { name: "record_id", definition: "Stable identifier of the record." },
    ],
    chain_of_custody: {
      collection_date: "2026-06-10",
      collection_method: "synthetic mock retrieval",
      collected_by: "ETL Agent (mock)",
      review_status: "pending_analyst_review",
    },
    certification: {
      authorized_representative: "Records Custodian (SYNTHETIC)",
      title: "Custodian of Records",
      certification_text: "Draft certification — pending human approval.",
      status: "draft_pending_approval",
    },
    status: "draft_pending_analyst_review",
    risk_flags: [],
    section_provenance: {
      requesting_agency: "Text Content Agent",
      subject_identifiers: "Indexing Agent",
      production_summary: "Text Content Agent",
      record_index: "ETL Agent",
      field_definitions: "Text Content Agent",
      chain_of_custody: "Text Content Agent",
      certification: "Text Content Agent",
    },
    ...overrides,
  };
}

export function makeLegalRequest(
  overrides: Partial<LegalRequest> = {},
): LegalRequest {
  return {
    legal_request_id: "LER-2026-004812",
    source_type: "lers_request_template",
    date_received: "2026-06-01",
    workflow_state: "analyst_review_pending",
    requesting_agency: {
      agency: "Synthetic County Sheriff (SYNTHETIC)",
      case_number: "MC-26-11784",
      officer: "Detective Synthetic",
      contact_email: null,
      phone: null,
      address: null,
    },
    legal_process: {
      type: "search_warrant",
      court_order_included: true,
      ex_parte_order: false,
      pen_register: false,
      trap_and_trace: false,
      location_tracking: true,
      stored_communications: false,
    },
    subject_identifiers: [
      {
        type: "account_id",
        value: "ACC-7784512",
        confidence: 0.99,
        source_span: "account ACC-7784512",
      },
    ],
    requested_data_categories: [
      {
        category: "gps_location_records",
        product_domain: "Maps / Location",
        sensitivity: "high",
        content_type: null,
        requires_sme_review: false,
      },
    ],
    product_domains: ["Maps / Location"],
    requested_period: {
      start: "2026-05-10T00:00:00Z",
      end: "2026-05-15T00:00:00Z",
      valid: true,
      issues: [],
    },
    special_handling: {
      sealed: false,
      non_disclosure_to_subscriber: false,
      no_adverse_action: false,
      pen_register_requested: false,
      trap_and_trace_requested: false,
      ongoing_access_requested: false,
      location_tracking_requested: true,
      content_requested: false,
      tombstone_requested: false,
      production_deadline_days: 35,
      service_deadline_days: 14,
      nondisclosure_period: null,
    },
    legal_authorities: [
      { citation: "18 U.S.C. §2703", description: null, source_span: null },
    ],
    deficiency_findings: [],
    reviews: [],
    approvals: [],
    agent_runs: {},
    classification: null,
    routing_recommendation: null,
    note_drafts: [],
    text_drafts: [],
    production_package: null,
    owner: null,
    urgency_tier: "standard",
    raw_source_uri: "local://legal_requests/scenario_a.json",
    raw_source_text:
      "SEARCH WARRANT (SYNTHETIC). GPS location records for account ACC-7784512 between 2026-05-10 and 2026-05-15. SYNTHETIC DATA — NOT A REAL LEGAL DOCUMENT.",
    ...overrides,
  };
}
