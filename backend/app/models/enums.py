"""Controlled vocabularies shared across the domain models."""

from enum import StrEnum


class ActorType(StrEnum):
    SYSTEM = "system"
    AGENT = "agent"
    SERVICE = "service"
    HUMAN = "human"


class Role(StrEnum):
    """Human reviewer roles (lightweight, synthetic — no real auth).

    Carried on the request actor via the X-CaseFlow-Role header and used
    to gate sensitive human actions: dual-control finalization of a
    high-sensitivity request requires a senior_analyst co-signer.
    """

    ANALYST = "analyst"
    SENIOR_ANALYST = "senior_analyst"
    SME = "sme"
    QA = "qa"


class AuditAction(StrEnum):
    """Audit event taxonomy (plan §14). Agent-run actions are listed for
    completeness but are not emitted until PR 2."""

    REQUEST_INGESTED = "request_ingested"
    REQUEST_EXTRACTED = "request_extracted"
    REQUEST_INDEXED = "request_indexed"
    REQUEST_CLASSIFIED = "request_classified"
    SPECIAL_HANDLING_CHECKED = "special_handling_checked"
    ROUTE_RECOMMENDED = "route_recommended"
    ETL_SIMULATED = "etl_simulated"
    NOTE_DRAFTED = "note_drafted"
    PRODUCTION_PACKAGE_DRAFTED = "production_package_drafted"
    DEFICIENCY_RESPONSE_DRAFTED = "deficiency_response_drafted"
    SME_NOTIFICATION_DRAFTED = "sme_notification_drafted"
    WORKFLOW_ACTION_PREPARED = "workflow_action_prepared"
    QA_VALIDATION_COMPLETED = "qa_validation_completed"
    ANALYST_REVIEWED = "analyst_reviewed"
    ROUTE_APPROVED = "route_approved"
    RESPONSE_PACKAGE_APPROVED = "response_package_approved"
    REQUEST_ESCALATED = "request_escalated"
    SENT_TO_QA = "sent_to_qa"
    FINALIZATION_BLOCKED = "finalization_blocked"
    AUDIT_COMPLETED = "audit_completed"
    HUMAN_OVERRIDE_APPLIED = "human_override_applied"
    AGENT_RUN_RERUN_REQUESTED = "agent_run_rerun_requested"
    AGENT_RUN_ACCEPTED = "agent_run_accepted"
    AGENT_RUN_SENT_BACK = "agent_run_sent_back"
    ATTESTATION_RECORDED = "attestation_recorded"


class AgentRunStatus(StrEnum):
    """Status of one agent execution. Blocked runs stay visible — an agent
    that cannot proceed reports why instead of disappearing."""

    WAITING = "waiting"
    RUNNING = "running"
    COMPLETE = "complete"
    BLOCKED = "blocked"
    NEEDS_REVIEW = "needs_review"
    FAILED = "failed"


class LegalProcessType(StrEnum):
    SEARCH_WARRANT = "search_warrant"
    EX_PARTE_ORDER = "ex_parte_order"
    SUBPOENA = "subpoena"
    COURT_ORDER = "court_order"
    PEN_REGISTER = "pen_register"
    TRAP_AND_TRACE = "trap_and_trace"
    LOCATION_TRACKING = "location_tracking"
    LEGAL_PROCESS_REQUEST = "legal_process_request"
    UNKNOWN = "unknown"


class IdentifierType(StrEnum):
    ACCOUNT_ID = "account_id"
    GMAIL_ACCOUNT = "gmail_account"
    GOOGLE_ID = "google_id"
    CUSTOMER_REFERENCE = "customer_reference"
    DEVICE_ESN = "device_esn"
    DEVICE_IMEI = "device_imei"
    DEVICE_MEID = "device_meid"
    MAC_ID = "mac_id"
    PHONE_NUMBER = "phone_number"
    OTHER = "other"


class Sensitivity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DeficiencyCode(StrEnum):
    MISSING_DATE_RANGE = "missing_date_range"
    INVALID_DATE_RANGE = "invalid_date_range"
    MISSING_IDENTIFIER = "missing_identifier"
    OVERBROAD_SCOPE = "overbroad_scope"
    AMBIGUOUS_REQUEST_TYPE = "ambiguous_request_type"
    UNRESOLVED_TEMPLATE_PLACEHOLDER = "unresolved_template_placeholder"
    SCOPE_AUTHORITY_MISMATCH = "scope_authority_mismatch"


class DeficiencySeverity(StrEnum):
    BLOCKING = "blocking"
    WARNING = "warning"


class ReviewReason(StrEnum):
    """Approval-policy review triggers (plan §4 / handoff doc 06)."""

    SEARCH_WARRANT = "search_warrant"
    PEN_REGISTER_REQUESTED = "pen_register_requested"
    TRAP_AND_TRACE_REQUESTED = "trap_and_trace_requested"
    NON_DISCLOSURE_REQUESTED = "non_disclosure_requested"
    NO_ADVERSE_ACTION_REQUESTED = "no_adverse_action_requested"
    SEALED_ORDER_REQUESTED = "sealed_order_requested"
    LOCATION_TRACKING_REQUESTED = "location_tracking_requested"
    CONTENT_REQUESTED = "content_requested"
    TOMBSTONE_REQUESTED = "tombstone_requested"
    OVERBROAD_SCOPE = "overbroad_scope"
    TEMPLATE_PLACEHOLDER_UNRESOLVED = "template_placeholder_unresolved"
    SCOPE_AUTHORITY_MISMATCH = "scope_authority_mismatch"
    ONGOING_COLLECTION_REQUESTED = "ongoing_collection_requested"
    RESPONSE_PACKAGE_VALIDATION_ISSUE = "response_package_validation_issue"
    RECORD_COUNT_MISMATCH = "record_count_mismatch"
    CERTIFICATION_INCOMPLETE = "certification_incomplete"
    MISSING_REQUIRED_IDENTIFIER = "missing_required_identifier"
    MISSING_OR_INVALID_DATE_RANGE = "missing_or_invalid_date_range"
    LOW_CLASSIFICATION_CONFIDENCE = "low_classification_confidence"
    SOP_CONFLICT = "sop_conflict"
    SENSITIVE_PARTY = "sensitive_party"
    PRODUCTION_PACKAGE_DRAFTED = "production_package_drafted"
    DEFICIENCY_RESPONSE_DRAFTED = "deficiency_response_drafted"
    CHAIN_OF_CUSTODY_GENERATED = "chain_of_custody_generated"
    CERTIFICATION_GENERATED = "certification_generated"
    AUDIT_EXCEPTION = "audit_exception"


class ReviewTargetType(StrEnum):
    ROUTE = "route"
    NOTE = "note"
    PRODUCTION_PACKAGE = "production_package"
    DEFICIENCY_RESPONSE = "deficiency_response"
    ESCALATION = "escalation"
    QA = "qa"


class ReviewAction(StrEnum):
    APPROVE = "approve"
    REQUEST_CHANGES = "request_changes"
    ESCALATE = "escalate"
    SEND_TO_QA = "send_to_qa"


class OverrideTarget(StrEnum):
    """The agent-produced fields a human may correct in place. Bounded by
    design: each target has an explicit, audited apply handler. Correcting
    an extraction field re-runs deficiency detection, so a human fix can
    clear a blocking deficiency."""

    REQUESTED_PERIOD = "requested_period"
    LEGAL_PROCESS_TYPE = "legal_process_type"
    RECOMMENDED_QUEUE = "recommended_queue"
    PRODUCTION_SUMMARY_TEXT = "production_summary_text"
    CERTIFICATION_REPRESENTATIVE = "certification_representative"


class AgentRunDecision(StrEnum):
    """A human's verdict on one persisted agent run (theme C)."""

    ACCEPTED = "accepted"
    SENT_BACK = "sent_back"


class AttestationItem(StrEnum):
    """Pre-finalization checks a human must personally confirm. The
    required subset is computed from the approval policy per request."""

    SCOPE_VERIFIED = "scope_verified"
    IDENTIFIERS_MATCH = "identifiers_match"
    NONDISCLOSURE_REVIEWED = "nondisclosure_reviewed"
    SEALED_HANDLING_ACKNOWLEDGED = "sealed_handling_acknowledged"
    CONTENT_SCOPE_CONFIRMED = "content_scope_confirmed"
    AUTHORITY_SCOPE_MATCH_CONFIRMED = "authority_scope_match_confirmed"
    ONGOING_COLLECTION_REVIEWED = "ongoing_collection_reviewed"
    PACKAGE_COMPLETENESS_CONFIRMED = "package_completeness_confirmed"
    CERTIFICATION_REVIEWED = "certification_reviewed"


class ApprovalDecisionType(StrEnum):
    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"
    ESCALATED = "escalated"


class ProductionPackageStatus(StrEnum):
    """No agent-reachable 'final' status exists by design; approval is a
    human-only transition enforced in the FastAPI layer."""

    DRAFT_PENDING_ANALYST_REVIEW = "draft_pending_analyst_review"
    CHANGES_REQUESTED = "changes_requested"
    APPROVED_BY_ANALYST = "approved_by_analyst"


class NoteType(StrEnum):
    REQUEST_INTAKE_NOTE = "request_intake_note"
    CLASSIFICATION_NOTE = "classification_note"
    ROUTING_RATIONALE = "routing_rationale"
    DEFICIENCY_NOTE = "deficiency_note"
    RESPONSE_PREP_NOTE = "response_prep_note"
    ANALYST_DECISION_NOTE = "analyst_decision_note"


class DraftType(StrEnum):
    PRODUCTION_PACKAGE = "production_package"
    DEFICIENCY_RESPONSE = "deficiency_response"
    SME_NOTIFICATION = "sme_notification"
    PRODUCTION_SUMMARY = "production_summary"
    NO_RESPONSIVE_RECORDS = "no_responsive_records"


class EvidenceSourceType(StrEnum):
    SOP = "sop"
    ROUTING_RULE = "routing_rule"
    DEFICIENCY_RULE = "deficiency_rule"
    RESPONSE_TEMPLATE = "response_template"
    TAXONOMY = "taxonomy"
    REGISTRY = "registry"
    MOCK_RECORD = "mock_record"
    SPECIAL_HANDLING_RULE = "special_handling_rule"


class DataConfidence(StrEnum):
    FULLY_TRACKED = "fully_tracked"
    PARTIALLY_TRACKED = "partially_tracked"
    ESTIMATED = "estimated"
    SYNTHETIC_MOCK = "synthetic_mock"
    UNAVAILABLE = "unavailable"
