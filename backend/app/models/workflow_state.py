from enum import StrEnum


class WorkflowState(StrEnum):
    REQUEST_RECEIVED = "request_received"
    REQUEST_EXTRACTED = "request_extracted"
    REQUEST_INDEXED = "request_indexed"
    REQUEST_CLASSIFIED = "request_classified"
    REQUEST_VALIDATED = "request_validated"
    ROUTE_RECOMMENDED = "route_recommended"
    ETL_SIMULATED = "etl_simulated"
    NOTE_DRAFTED = "note_drafted"
    RESPONSE_PACKAGE_DRAFTED = "response_package_drafted"
    DEFICIENCY_RESPONSE_DRAFTED = "deficiency_response_drafted"
    ANALYST_REVIEW_PENDING = "analyst_review_pending"
    ANALYST_APPROVED = "analyst_approved"
    ESCALATED = "escalated"
    SENT_TO_QA = "sent_to_qa"
    CHANGES_REQUESTED = "changes_requested"
    AUDIT_COMPLETE = "audit_complete"
