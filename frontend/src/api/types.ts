/** TypeScript mirror of the backend API contracts
 * (backend/app/api/schemas.py and backend/app/models/). Field names are
 * snake_case to match the JSON wire format exactly. Statuses that the
 * backend constrains to pending-human literals are mirrored as literals
 * so no frontend code can even type a final/agent-approved state. */

export type WorkflowState =
  | "request_received"
  | "request_extracted"
  | "request_indexed"
  | "request_classified"
  | "request_validated"
  | "route_recommended"
  | "etl_simulated"
  | "note_drafted"
  | "response_package_drafted"
  | "deficiency_response_drafted"
  | "analyst_review_pending"
  | "analyst_approved"
  | "escalated"
  | "sent_to_qa"
  | "changes_requested"
  | "audit_complete";

export type AgentRunStatus =
  | "waiting"
  | "running"
  | "complete"
  | "blocked"
  | "needs_review"
  | "failed";

export interface AgentRun {
  agent_run_id: string;
  legal_request_id: string;
  agent_id: string;
  agent_name: string;
  status: AgentRunStatus;
  input_summary: string;
  output_summary: string;
  output: Record<string, unknown>;
  confidence: number | null;
  rationale: string | null;
  evidence_ids: string[];
  requires_human_review: boolean;
  review_reasons: string[];
  risk_flags: string[];
  blocked_reason: string | null;
  validation_status: string;
  started_at: string | null;
  completed_at: string | null;
  latency_ms: number | null;
  audit_event_id: string | null;
  model_id: string | null;
  prompt_version: string | null;
  retry_count: number;
}

export interface RequestingAgency {
  agency: string | null;
  case_number: string | null;
  officer: string | null;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
}

export type LegalProcessType =
  | "search_warrant"
  | "ex_parte_order"
  | "subpoena"
  | "court_order"
  | "pen_register"
  | "trap_and_trace"
  | "legal_process_request"
  | "unknown"
  | (string & {});

export interface LegalProcess {
  type: LegalProcessType;
  components: LegalProcessType[];
  court_order_included: boolean;
  ex_parte_order: boolean;
  pen_register: boolean;
  trap_and_trace: boolean;
  location_tracking: boolean;
  stored_communications: boolean;
}

export interface SubjectIdentifier {
  type: string;
  value: string;
  confidence: number;
  source_span: string | null;
}

export interface RequestedDataCategory {
  category: string;
  product_domain: string;
  sensitivity: string;
  content_type: string | null;
  requires_sme_review: boolean;
}

export interface RequestedPeriod {
  start: string | null;
  end: string | null;
  valid: boolean;
  issues: string[];
}

export interface SpecialHandlingFlags {
  sealed: boolean;
  non_disclosure_to_subscriber: boolean;
  no_adverse_action: boolean;
  pen_register_requested: boolean;
  trap_and_trace_requested: boolean;
  ongoing_access_requested: boolean;
  location_tracking_requested: boolean;
  content_requested: boolean;
  tombstone_requested: boolean;
  production_deadline_days: number | null;
  service_deadline_days: number | null;
  nondisclosure_period: string | null;
  ongoing_duration_days?: number | null;
  ongoing_update_interval_minutes?: number | null;
}

export interface LegalAuthority {
  citation: string;
  description: string | null;
  source_span: string | null;
}

export interface SourceDocumentSection {
  section_id: string;
  title: string;
  start_line: number;
  end_line: number;
  text: string;
}

export type ScopeAuthorityStatus =
  | "covered"
  | "needs_review"
  | "missing_authority";

export interface ScopeAuthorityCheck {
  category: string;
  status: ScopeAuthorityStatus;
  required_citations: string[];
  matched_citations: string[];
  message: string;
}

export interface PackageValidationFinding {
  code: string;
  severity: "blocking" | "warning";
  section: string;
  message: string;
}

export interface DeficiencyFinding {
  code: string;
  severity: string;
  message: string;
  requires_human_review: boolean;
  suggested_resolution: string | null;
  evidence_ids: string[];
}

export interface ClassificationResult {
  legal_process_type: string;
  request_category: string;
  product_domains: string[];
  urgency_tier: string | null;
  sensitivity: string;
  recommended_queue: string | null;
  complexity: string | null;
  missing_fields: string[];
  confidence: number;
  human_review_required: boolean;
  review_reasons: string[];
  rationale: string | null;
  evidence_ids: string[];
}

export interface RoutingRecommendation {
  target_queue: string | null;
  target_owner: string | null;
  escalation_target: string | null;
  reason: string | null;
  sla_risk: boolean;
  requires_approval: true;
  evidence_ids: string[];
  status: "recommended_pending_human";
}

export interface NoteDraft {
  note_type: string;
  body: string;
  fields_to_update: Record<string, string>;
  missing_fields: string[];
  requires_human_approval: true;
}

export type DraftType =
  | "production_package"
  | "deficiency_response"
  | "sme_notification"
  | "production_summary"
  | "no_responsive_records";

export interface TextDraft {
  draft_type: DraftType;
  sections: Record<string, string>;
  status: "draft_not_final";
  requires_human_approval: true;
  evidence_ids: string[];
}

export interface ResponsiveRecord {
  record_id: string;
  timestamp_utc: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  source: string | null;
  data_confidence: "synthetic_mock";
}

export interface ProductionSummary {
  start_date: string | null;
  end_date: string | null;
  total_responsive_records: number;
  ordinary_course_statement: string | null;
}

export interface DataFieldDefinition {
  name: string;
  definition: string;
}

export interface ChainOfCustody {
  collection_date: string | null;
  collection_method: string | null;
  collected_by: string | null;
  review_status: string;
}

export interface Certification {
  authorized_representative: string | null;
  title: string | null;
  certification_text: string | null;
  status: "draft_pending_approval";
}

export type ProductionPackageStatus =
  | "draft_pending_analyst_review"
  | "changes_requested"
  | "approved_by_analyst";

export interface ProductionPackage {
  request_id: string;
  production_id: string;
  date_produced: string | null;
  requesting_agency: RequestingAgency | null;
  subject_identifiers: SubjectIdentifier[];
  production_summary: ProductionSummary;
  records: ResponsiveRecord[];
  field_definitions: DataFieldDefinition[];
  chain_of_custody: ChainOfCustody;
  certification: Certification;
  status: ProductionPackageStatus;
  risk_flags: string[];
  section_provenance: Record<string, string>;
  validation_findings: PackageValidationFinding[];
}

export interface HumanReview {
  review_id: string;
  legal_request_id: string;
  target_type: string;
  reviewer_id: string;
  role: string;
  action: string;
  edits: Record<string, string>;
  comments: string | null;
  timestamp: string;
}

export interface ApprovalDecision {
  approval_id: string;
  legal_request_id: string;
  target_type: string;
  decision: string;
  decided_by: string;
  role: string;
  policy_reasons: string[];
  comments: string | null;
  timestamp: string;
  audit_event_id: string | null;
}

/** Human-in-the-lead records (all synthetic, all audited). */

export type OverrideTarget =
  | "requested_period"
  | "legal_process_type"
  | "recommended_queue"
  | "production_summary_text"
  | "certification_representative";

export interface HumanOverride {
  override_id: string;
  legal_request_id: string;
  target: OverrideTarget;
  field_path: string;
  before_value: string;
  after_value: string;
  reason: string;
  overridden_by: string;
  role: string;
  cleared_deficiencies: string[];
  timestamp: string;
  audit_event_id: string | null;
}

export type AgentRunDecision = "accepted" | "sent_back";

export interface AgentRunReview {
  review_id: string;
  legal_request_id: string;
  agent_id: string;
  agent_run_id: string | null;
  decision: AgentRunDecision;
  instruction: string | null;
  reviewed_by: string;
  role: string;
  timestamp: string;
  audit_event_id: string | null;
}

export type AttestationItem =
  | "scope_verified"
  | "identifiers_match"
  | "nondisclosure_reviewed"
  | "sealed_handling_acknowledged"
  | "content_scope_confirmed"
  | "authority_scope_match_confirmed"
  | "ongoing_collection_reviewed"
  | "package_completeness_confirmed"
  | "certification_reviewed";

export interface Attestation {
  item: AttestationItem;
  attested_by: string;
  role: string;
  timestamp: string;
  audit_event_id: string | null;
}

export interface AuditEvent {
  audit_event_id: string;
  legal_request_id: string;
  timestamp: string;
  actor_type: "system" | "agent" | "service" | "human";
  actor_id: string;
  action: string;
  before_state: WorkflowState | null;
  after_state: WorkflowState | null;
  summary: string;
  evidence_ids: string[];
  confidence: number | null;
  approval_id: string | null;
  correlation_id: string | null;
}

export interface LegalRequest {
  legal_request_id: string;
  source_type: string;
  date_received: string | null;
  workflow_state: WorkflowState;
  source_sections: SourceDocumentSection[];
  requesting_agency: RequestingAgency | null;
  legal_process: LegalProcess | null;
  subject_identifiers: SubjectIdentifier[];
  requested_data_categories: RequestedDataCategory[];
  product_domains: string[];
  requested_period: RequestedPeriod | null;
  special_handling: SpecialHandlingFlags;
  legal_authorities: LegalAuthority[];
  scope_authority_checks: ScopeAuthorityCheck[];
  deficiency_findings: DeficiencyFinding[];
  package_validation_findings: PackageValidationFinding[];
  reviews: HumanReview[];
  approvals: ApprovalDecision[];
  human_overrides: HumanOverride[];
  agent_run_reviews: AgentRunReview[];
  attestations: Attestation[];
  agent_runs: Record<string, AgentRun>;
  classification: ClassificationResult | null;
  routing_recommendation: RoutingRecommendation | null;
  note_drafts: NoteDraft[];
  text_drafts: TextDraft[];
  production_package: ProductionPackage | null;
  owner: string | null;
  urgency_tier: string | null;
  raw_source_uri: string | null;
  raw_source_text: string | null;
}

export interface ApprovalPolicyResult {
  human_review_required: boolean;
  review_reasons: string[];
  blocking_reasons: string[];
  warnings: string[];
}

export interface SpecialHandlingCheck {
  active_flags: string[];
  review_reasons: string[];
  evidence_ids: string[];
}

export interface ExtractResponse {
  legal_request: LegalRequest;
  deficiency_findings: DeficiencyFinding[];
  audit_event: AuditEvent;
}

export interface ValidateResponse {
  legal_request: LegalRequest;
  deficiency_findings: DeficiencyFinding[];
  special_handling: SpecialHandlingCheck;
  approval_policy: ApprovalPolicyResult;
  audit_event: AuditEvent;
}

export interface RailRunResponse {
  legal_request: LegalRequest;
  agent_runs: AgentRun[];
}

export interface DraftRunResponse {
  agent_run: AgentRun;
  text_draft: TextDraft | null;
  production_package: ProductionPackage | null;
  requires_human_approval: true;
  risk_flags: string[];
  audit_event_id: string | null;
}

export type ReviewTargetType =
  | "route"
  | "note"
  | "production_package"
  | "deficiency_response"
  | "escalation"
  | "qa";

export interface ReviewBody {
  target_type?: ReviewTargetType;
  action: "approve" | "request_changes";
  comments?: string;
  edits?: Record<string, string>;
}

export interface ReviewResponse {
  legal_request: LegalRequest;
  review: HumanReview;
  audit_event: AuditEvent;
}

export interface ApproveResponse {
  legal_request: LegalRequest;
  approval_decision: ApprovalDecision;
  finalized: boolean;
  audit_events: AuditEvent[];
  approvals_recorded: number;
  approvals_required: number;
  awaiting_approval: boolean;
}

export interface ActionResponse {
  legal_request: LegalRequest;
  audit_event: AuditEvent;
}

export interface OverrideBody {
  target: OverrideTarget;
  reason: string;
  text_value?: string;
  period_start?: string;
  period_end?: string;
}

export interface AttestBody {
  item: AttestationItem;
}

export interface OverrideResponse {
  legal_request: LegalRequest;
  override: HumanOverride;
  audit_event: AuditEvent;
}

export interface AgentRunReviewResponse {
  legal_request: LegalRequest;
  agent_run: AgentRun | null;
  agent_run_review: AgentRunReview;
  audit_event: AuditEvent;
}

export interface AttestResponse {
  legal_request: LegalRequest;
  attestation: Attestation;
  audit_event: AuditEvent;
  required_attestations: AttestationItem[];
  satisfied: boolean;
}

export interface FinalizationStatus {
  workflow_state: WorkflowState;
  required_attestations: AttestationItem[];
  attested: AttestationItem[];
  missing_attestations: AttestationItem[];
  approvals_recorded: number;
  approvals_required: number;
  requires_senior_approval: boolean;
  senior_approval_present: boolean;
  blocked_agent_runs: string[];
  blocking_reasons: string[];
  ready_for_approval: boolean;
}

/** Lightweight synthetic reviewer roles (X-CaseFlow-Role header). */
export type Role = "analyst" | "senior_analyst" | "sme" | "qa";

export type DataConfidence =
  | "fully_tracked"
  | "partially_tracked"
  | "estimated"
  | "synthetic_mock"
  | "unavailable";

export type LeadershipHealthStatus =
  | "on_track"
  | "at_risk"
  | "needs_intervention";

export type DashboardRiskLevel = "low" | "watch" | "at_risk" | "critical";

export type DashboardSlaStatus = "met" | "at_risk" | "missed" | "unknown";

export type LeadershipKpiStatus = "healthy" | "watch" | "at_risk";

export type LeadershipKpiUnit =
  | "count"
  | "tickets"
  | "percent"
  | "hours"
  | "ratio"
  | "tickets_per_day";

export interface LisIrtDashboardFilters {
  silo?: string;
  workflow_category?: string;
  workflow?: string;
  region?: string;
  manager_name?: string;
  sla_status?: DashboardSlaStatus | "all";
  risk_level?: DashboardRiskLevel | "all";
  date_range?: "last_7_days" | "last_14_days" | "last_30_days";
  platform?: string;
  source?: string;
  legal_process_type?: string;
  nature_of_case?: string;
  ticket_type?: string;
  country?: string;
  tags?: string;
  manager_region?: string;
  owner?: string;
  partition_day?: string;
  status_change_start?: string;
  status_change_end?: string;
}

export interface DashboardFilterOptions {
  silos: string[];
  workflow_categories: string[];
  workflows: string[];
  regions: string[];
  countries: string[];
  manager_regions: string[];
  manager_names: string[];
  owners: string[];
  sla_statuses: DashboardSlaStatus[];
  risk_levels: DashboardRiskLevel[];
  platforms: string[];
  sources: string[];
  legal_process_types: string[];
  nature_of_case: string[];
  ticket_types: string[];
  tags: string[];
}

export interface DashboardFreshness {
  generated_at: string;
  latest_complete_day: string;
  current_period_label: string;
  comparison_period_label: string;
  source_label: string;
  data_confidence: DataConfidence;
  is_synthetic: boolean;
}

export interface RiskDriver {
  driver_id: string;
  title: string;
  description: string;
  severity: DashboardRiskLevel;
  dimension: string;
  value: number;
  unit: LeadershipKpiUnit;
}

export interface LeadershipHealth {
  status: LeadershipHealthStatus;
  narrative: string;
  drivers: RiskDriver[];
}

export interface LeadershipKpi {
  metric_id: string;
  title: string;
  value: number;
  unit: LeadershipKpiUnit;
  status: LeadershipKpiStatus;
  target_value: number | null;
  target_label: string | null;
  previous_value: number | null;
  delta_value: number | null;
  delta_direction: "up" | "down" | "flat";
  caption: string;
  data_confidence: DataConfidence;
  drilldown_filter?: Partial<LisIrtDashboardFilters>;
}

export interface DailyOpsPoint {
  date: string;
  volume_in: number;
  volume_out: number;
  net_flow: number;
  slo_compliance_percent: number;
  median_tat_hours: number;
  median_triage_hours: number;
  backlog: number;
  partner_controllable_backlog_percent: number;
  escalation_rate_percent: number;
  qa_score_percent: number;
  audit_rate_percent: number;
}

export interface SlaStatusBreakdown {
  status: DashboardSlaStatus;
  label: string;
  count: number;
  percent: number;
}

export interface WorkflowBreakdown {
  silo: string;
  workflow: string;
  category: string;
  volume: number;
  share_percent: number;
  slo_compliance_percent: number;
  median_tat_hours: number;
  risk_level: DashboardRiskLevel;
}

export interface AnalystProductivityPoint {
  analyst_id: string;
  analyst_name: string;
  manager_name: string;
  region: string;
  tickets_per_day: number;
  median_claim_hours: number;
  utilization_percent: number;
  risk_level: DashboardRiskLevel;
}

export interface RegionalBreakdown {
  region: string;
  country: string;
  volume_in: number;
  volume_out: number;
  slo_compliance_percent: number;
  backlog: number;
  risk_level: DashboardRiskLevel;
}

export interface WorkAttentionItem {
  item_id: string;
  workflow: string;
  silo: string;
  manager_name: string;
  owner: string;
  region: string;
  country: string;
  risk_level: DashboardRiskLevel;
  aging_hours: number;
  sla_status: DashboardSlaStatus;
  current_volume: number;
  reason: string;
  recommended_action: string;
}

export interface LisIrtDashboardResponse {
  freshness: DashboardFreshness;
  active_filters: LisIrtDashboardFilters;
  filter_options: DashboardFilterOptions;
  health: LeadershipHealth;
  kpis: LeadershipKpi[];
  daily_trends: DailyOpsPoint[];
  sla_status_breakdown: SlaStatusBreakdown[];
  workflow_breakdown: WorkflowBreakdown[];
  analyst_productivity: AnalystProductivityPoint[];
  regional_breakdown: RegionalBreakdown[];
  work_attention: WorkAttentionItem[];
}

export interface GovernanceMetric {
  metric_id: string;
  title: string;
  value: number;
  unit: string;
  dimension: string | null;
  period: string | null;
  data_confidence: DataConfidence;
  evidence_ids: string[];
}

export interface AgentActivity {
  agent_id: string;
  agent_name: string;
  runs_total: number;
  runs_completed: number;
  runs_blocked: number;
  runs_needs_review: number;
  runs_failed: number;
  audit_events: number;
  average_confidence: number | null;
  requests_covered: string[];
  data_confidence: DataConfidence;
}

export interface AttentionItem {
  legal_request_id: string;
  workflow_state: WorkflowState;
  reasons: string[];
  priority: number;
  related_agent_run_ids: string[];
}

export interface AuditReadinessReport {
  requests_total: number;
  requests_with_all_required_events: number;
  coverage_percent: number;
  missing_events_by_request: Record<string, string[]>;
  finalization_blocked_events: number;
  data_confidence: DataConfidence;
}

export interface GovernanceSummaryResponse {
  metrics: GovernanceMetric[];
}

export interface AgentActivityResponse {
  agents: AgentActivity[];
}

export interface WorkNeedingAttentionResponse {
  items: AttentionItem[];
}

export interface AuditEventFilters {
  legal_request_id?: string;
  action?: string;
  actor_type?: string;
  /** Snake_case agent id or the exact official RFP name. */
  agent?: string;
}

export type EvidenceSourceType =
  | "sop"
  | "routing_rule"
  | "deficiency_rule"
  | "response_template"
  | "taxonomy"
  | "registry"
  | "record"
  | string;

export interface EvidenceReference {
  evidence_id: string;
  source_type: EvidenceSourceType;
  title: string;
  snippet: string | null;
  confidence: number;
}
