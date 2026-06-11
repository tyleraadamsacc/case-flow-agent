"""Request queue/detail, intake, extraction, and validation endpoints.

Every state-changing endpoint follows the same discipline: load → assert
transition → apply services → write audit → persist → respond. The audit
write happens BEFORE persistence, so an audit failure abandons the
transition.
"""

import uuid

from fastapi import APIRouter, Depends

from app.api.deps import Container, get_container
from app.api.schemas import (
    ActionResponse,
    CompletenessScoreResponse,
    ExtractResponse,
    LegalRequestCreate,
    ValidateResponse,
)
from app.errors import NotFoundError
from app.models.enums import ActorType, AuditAction
from app.models.legal_request import LegalRequest
from app.models.workflow_state import WorkflowState
from app.services.request_completeness_score_service import RequestCompletenessScoreService

router = APIRouter(prefix="/api/legal-requests", tags=["legal-requests"])


def _load(container: Container, legal_request_id: str) -> LegalRequest:
    request = container.legal_request_repository.get(legal_request_id)
    if request is None:
        raise NotFoundError("legal_request", legal_request_id)
    return request


@router.get("")
def list_legal_requests(container: Container = Depends(get_container)) -> list[LegalRequest]:
    return sorted(
        container.legal_request_repository.list_all(), key=lambda r: r.legal_request_id
    )


@router.post("", status_code=201)
def create_legal_request(
    body: LegalRequestCreate, container: Container = Depends(get_container)
) -> ActionResponse:
    legal_request_id = body.legal_request_id or f"LER-{uuid.uuid4().hex[:10].upper()}"
    request = LegalRequest(
        legal_request_id=legal_request_id,
        source_type=body.source_type,
        date_received=body.date_received,
        raw_source_uri=body.raw_source_uri,
        raw_source_text=body.raw_source_text,
    )
    event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.SYSTEM,
        actor_id="intake_api",
        action=AuditAction.REQUEST_INGESTED,
        before_state=None,
        after_state=request.workflow_state,
        summary="Legal request ingested into the intake queue (synthetic data only).",
    )
    container.legal_request_repository.save(request)
    return ActionResponse(legal_request=request, audit_event=event)


@router.get("/{legal_request_id}")
def get_legal_request(
    legal_request_id: str, container: Container = Depends(get_container)
) -> LegalRequest:
    request = _load(container, legal_request_id)
    # Hydrate the latest run per agent from the agent-run repository (the
    # source of truth for runs); list order is execution order, so later
    # runs win.
    request.agent_runs = {
        run.agent_id: run
        for run in container.agent_run_repository.list_for_request(legal_request_id)
    }
    return request


@router.get("/{legal_request_id}/completeness-score")
def get_completeness_score(
    legal_request_id: str, container: Container = Depends(get_container)
) -> CompletenessScoreResponse:
    request = _load(container, legal_request_id)
    request_for_score = request.model_copy(deep=True)
    if request_for_score.production_package is not None:
        findings = container.response_package_service.validate_package(
            request_for_score.production_package
        )
        request_for_score.production_package.validation_findings = findings
        request_for_score.package_validation_findings = findings
    return CompletenessScoreResponse(
        score=RequestCompletenessScoreService(container.approval_policy).score(
            request_for_score
        )
    )


@router.post("/{legal_request_id}/extract")
def extract(
    legal_request_id: str, container: Container = Depends(get_container)
) -> ExtractResponse:
    request = _load(container, legal_request_id)
    container.state_machine.assert_can_transition(
        request.workflow_state, WorkflowState.REQUEST_EXTRACTED
    )

    extraction = container.extraction_service.extract(request)
    container.extraction_service.apply(request, extraction)
    request.scope_authority_checks = container.scope_authority_service.analyze(request)
    request.deficiency_findings = container.deficiency_service.evaluate(request)
    before = container.state_machine.transition(request, WorkflowState.REQUEST_EXTRACTED)

    event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.SERVICE,
        actor_id="request_extraction_service",
        action=AuditAction.REQUEST_EXTRACTED,
        before_state=before,
        after_state=request.workflow_state,
        summary=(
            f"Extracted {len(request.subject_identifiers)} identifier(s), "
            f"{len(request.requested_data_categories)} data categor(ies), "
            f"{len(request.legal_authorities)} authorit(ies), "
            f"{len(request.source_sections)} source section(s); "
            f"{len(request.deficiency_findings)} preliminary deficienc(ies). "
            "Template placeholder text stripped."
        ),
    )
    container.legal_request_repository.save(request)
    return ExtractResponse(
        legal_request=request,
        deficiency_findings=request.deficiency_findings,
        audit_event=event,
    )


@router.post("/{legal_request_id}/validate")
def validate(
    legal_request_id: str, container: Container = Depends(get_container)
) -> ValidateResponse:
    request = _load(container, legal_request_id)
    container.state_machine.assert_can_transition(
        request.workflow_state, WorkflowState.REQUEST_VALIDATED
    )

    request.scope_authority_checks = container.scope_authority_service.analyze(request)
    request.deficiency_findings = container.deficiency_service.evaluate(request)
    special_handling = container.special_handling_service.check(request)
    policy = container.approval_policy.evaluate(request)

    before = container.state_machine.transition(request, WorkflowState.REQUEST_VALIDATED)
    container.state_machine.transition(request, WorkflowState.ANALYST_REVIEW_PENDING)

    event = container.audit_service.record(
        legal_request_id=legal_request_id,
        actor_type=ActorType.SERVICE,
        actor_id="special_handling_service",
        action=AuditAction.SPECIAL_HANDLING_CHECKED,
        before_state=before,
        after_state=request.workflow_state,
        summary=(
            f"Special handling flags: {', '.join(special_handling.active_flags) or 'none'}. "
            f"Deficiencies: {len(request.deficiency_findings)}. "
            f"Human review required: {policy.human_review_required}."
        ),
        evidence_ids=special_handling.evidence_ids,
    )
    container.legal_request_repository.save(request)
    return ValidateResponse(
        legal_request=request,
        deficiency_findings=request.deficiency_findings,
        special_handling=special_handling,
        approval_policy=policy,
        audit_event=event,
    )
