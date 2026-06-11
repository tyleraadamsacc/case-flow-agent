"""Dependency wiring. Local mode only in PR 1; GCP-backed repositories
swap in behind the same container attributes in later PRs."""

from dataclasses import dataclass

from fastapi import Request

from app.config import Settings
from app.mock_data.seed import fixtures_dir, seed_legal_requests
from app.models.enums import ActorType, Role
from app.llm.model_assist import ModelAssist
from app.llm.model_router import ModelRouter
from app.llm.prompt_loader import PromptLoader
from app.orchestration.agent_execution_service import AgentExecutionService
from app.orchestration.approval_policy import ApprovalPolicy
from app.orchestration.override_service import OverrideService
from app.orchestration.workflow_state_machine import WorkflowStateMachine
from app.repositories.local_agent_run_repository import LocalAgentRunRepository
from app.repositories.local_audit_repository import LocalAuditRepository
from app.repositories.local_legal_request_repository import LocalLegalRequestRepository
from app.repositories.local_response_record_repository import LocalResponseRecordRepository
from app.repositories.local_storage_repository import LocalStorageRepository
from app.services.audit_service import AuditService
from app.services.deficiency_service import DeficiencyService
from app.services.governance_metrics_service import GovernanceMetricsService
from app.services.response_package_service import ResponsePackageService
from app.services.request_extraction_service import RequestExtractionService
from app.services.sensitive_special_handling_service import SensitiveSpecialHandlingService
from app.services.scope_authority_service import ScopeAuthorityService
from app.services.sop_retrieval_service import LocalSopRetrievalService


@dataclass(frozen=True)
class CurrentActor:
    """Local mock user. IAP / Workspace identity arrives in a later PR.

    Identity is taken from request headers so the demo can switch between
    reviewers (and roles) to exercise dual-control approval. This is
    synthetic convenience, not an authentication boundary.
    """

    actor_id: str = "analyst.local"
    actor_type: ActorType = ActorType.HUMAN
    role: Role = Role.ANALYST


class Container:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        mock_dir = settings.mock_data_dir

        # Adapter selection is config-only (plan §19 PR 10): GCP mode
        # swaps the persistence/retrieval adapters behind the same
        # interfaces. The GCP adapters are post-MVP skeletons that fail
        # with guidance; local mode (the default) needs zero credentials.
        if settings.app_mode == "gcp":
            from app.repositories.firestore_audit_repository import (
                FirestoreAuditRepository,
            )
            from app.repositories.firestore_legal_request_repository import (
                FirestoreLegalRequestRepository,
            )
            from app.repositories.gcs_storage_repository import GcsStorageRepository

            self.legal_request_repository = FirestoreLegalRequestRepository(
                project=settings.gcp_project,
                collection_prefix=settings.firestore_collection_prefix,
            )
            self.audit_repository = FirestoreAuditRepository(
                project=settings.gcp_project,
                collection_prefix=settings.firestore_collection_prefix,
            )
            self.storage_repository = GcsStorageRepository(bucket=settings.gcs_bucket)
        else:
            self.legal_request_repository = LocalLegalRequestRepository()
            self.audit_repository = LocalAuditRepository()
            self.storage_repository = LocalStorageRepository(mock_dir)
        self.agent_run_repository = LocalAgentRunRepository()
        self.response_record_repository = LocalResponseRecordRepository(
            mock_dir / "response_records"
        )

        self.audit_service = AuditService(self.audit_repository)
        self.state_machine = WorkflowStateMachine()
        self.approval_policy = ApprovalPolicy()
        self.extraction_service = RequestExtractionService(
            fixtures_dir(mock_dir, settings.seed_dataset)
        )
        self.special_handling_service = SensitiveSpecialHandlingService(
            mock_dir / "sop" / "special_handling_rules.json"
        )
        self.deficiency_service = DeficiencyService(mock_dir / "sop" / "deficiency_rules.json")
        self.scope_authority_service = ScopeAuthorityService()
        self.response_package_service = ResponsePackageService(
            mock_dir / "sop" / "response_package_rules.json"
        )
        self.override_service = OverrideService(self.deficiency_service)
        if settings.app_mode == "gcp" and settings.agent_search_datastore:
            from app.services.agent_search_retrieval_service import (
                AgentSearchRetrievalService,
            )

            self.retrieval_service = AgentSearchRetrievalService(
                datastore=settings.agent_search_datastore
            )
        else:
            self.retrieval_service = LocalSopRetrievalService(mock_dir)
        self.governance_service = GovernanceMetricsService(
            self.legal_request_repository,
            self.audit_repository,
            self.approval_policy,
            self.agent_run_repository,
        )
        self.model_router = ModelRouter(settings)
        # ModelAssist only exists in model-assisted modes; deterministic
        # mode (the default) never constructs a model client.
        self.model_assist = (
            ModelAssist(self.model_router, PromptLoader())
            if settings.model_mode in ("mock_model", "gemini")
            else None
        )
        self.agent_execution_service = AgentExecutionService(
            self.legal_request_repository,
            self.agent_run_repository,
            self.response_record_repository,
            self.audit_service,
            mock_data_dir=mock_dir,
            llm_assist=self.model_assist,
        )

    def seed(self) -> int:
        return seed_legal_requests(
            self.legal_request_repository,
            self.audit_service,
            self.settings.mock_data_dir,
            dataset=self.settings.seed_dataset,
        )


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_current_actor(request: Request) -> CurrentActor:
    """Resolve the acting reviewer from request headers.

    X-CaseFlow-Actor sets the actor id, X-CaseFlow-Role the role. Both
    default to the local analyst so existing clients and tests are
    unaffected; an unknown role falls back to analyst rather than failing.
    """
    actor_id = request.headers.get("X-CaseFlow-Actor", "").strip() or "analyst.local"
    role_raw = request.headers.get("X-CaseFlow-Role", "").strip().lower()
    try:
        role = Role(role_raw) if role_raw else Role.ANALYST
    except ValueError:
        role = Role.ANALYST
    return CurrentActor(actor_id=actor_id, role=role)
