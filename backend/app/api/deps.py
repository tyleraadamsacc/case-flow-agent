"""Dependency wiring. Local mode only in PR 1; GCP-backed repositories
swap in behind the same container attributes in later PRs."""

from dataclasses import dataclass

from fastapi import Request

from app.config import Settings
from app.mock_data.seed import seed_legal_requests
from app.models.enums import ActorType
from app.orchestration.approval_policy import ApprovalPolicy
from app.orchestration.workflow_state_machine import WorkflowStateMachine
from app.repositories.local_agent_run_repository import LocalAgentRunRepository
from app.repositories.local_audit_repository import LocalAuditRepository
from app.repositories.local_legal_request_repository import LocalLegalRequestRepository
from app.repositories.local_response_record_repository import LocalResponseRecordRepository
from app.repositories.local_storage_repository import LocalStorageRepository
from app.services.audit_service import AuditService
from app.services.deficiency_service import DeficiencyService
from app.services.governance_metrics_service import GovernanceMetricsService
from app.services.request_extraction_service import RequestExtractionService
from app.services.sensitive_special_handling_service import SensitiveSpecialHandlingService


@dataclass(frozen=True)
class CurrentActor:
    """Local mock user. IAP / Workspace identity arrives in a later PR."""

    actor_id: str = "analyst.local"
    actor_type: ActorType = ActorType.HUMAN
    role: str = "analyst"


class Container:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        mock_dir = settings.mock_data_dir

        self.legal_request_repository = LocalLegalRequestRepository()
        self.audit_repository = LocalAuditRepository()
        self.agent_run_repository = LocalAgentRunRepository()
        self.response_record_repository = LocalResponseRecordRepository(
            mock_dir / "response_records"
        )
        self.storage_repository = LocalStorageRepository(mock_dir)

        self.audit_service = AuditService(self.audit_repository)
        self.state_machine = WorkflowStateMachine()
        self.approval_policy = ApprovalPolicy()
        self.extraction_service = RequestExtractionService(mock_dir / "legal_requests")
        self.special_handling_service = SensitiveSpecialHandlingService(
            mock_dir / "sop" / "special_handling_rules.json"
        )
        self.deficiency_service = DeficiencyService(mock_dir / "sop" / "deficiency_rules.json")
        self.governance_service = GovernanceMetricsService(
            self.legal_request_repository, self.audit_repository, self.approval_policy
        )

    def seed(self) -> int:
        return seed_legal_requests(
            self.legal_request_repository, self.audit_service, self.settings.mock_data_dir
        )


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_current_actor() -> CurrentActor:
    return CurrentActor()
