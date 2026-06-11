"""Response-package and deficiency drafting endpoints.

Drafting endpoints run the Text Content Agent through the execution
bridge; the agent applies the approval policy itself, so a request with a
blocking deficiency or pending SME escalation yields the policy-mandated
variant (deficiency response / blocked run) rather than a package —
drafting never bypasses policy. Everything produced is a draft pending
human review; no final, send, or release state is reachable.
"""

from fastapi import APIRouter, Depends

from app.api.deps import Container, get_container
from app.api.schemas import DraftRunResponse
from app.errors import NotFoundError
from app.models.agent_run import AgentRun
from app.models.enums import DraftType
from app.models.production_package import ProductionPackage
from app.models.responsive_record import ResponsiveRecord
from app.models.text_draft import TextDraft

from app.adk_agents.text_content_agent import create_text_content_agent

router = APIRouter(prefix="/api/legal-requests", tags=["drafting"])


def _assert_exists(container: Container, legal_request_id: str) -> None:
    if container.legal_request_repository.get(legal_request_id) is None:
        raise NotFoundError("legal_request", legal_request_id)


def _draft_response(run: AgentRun) -> DraftRunResponse:
    text_draft = (
        TextDraft.model_validate(run.output["text_draft"])
        if run.output.get("text_draft")
        else None
    )
    package = (
        ProductionPackage.model_validate(run.output["production_package"])
        if run.output.get("production_package")
        else None
    )
    return DraftRunResponse(
        agent_run=run,
        text_draft=text_draft,
        production_package=package,
        risk_flags=run.risk_flags,
        audit_event_id=run.audit_event_id,
    )


@router.get("/{legal_request_id}/responsive-records")
def list_responsive_records(
    legal_request_id: str, container: Container = Depends(get_container)
) -> list[ResponsiveRecord]:
    _assert_exists(container, legal_request_id)
    return container.response_record_repository.records_for_request(legal_request_id)


@router.post("/{legal_request_id}/production-package/draft")
def draft_production_package(
    legal_request_id: str, container: Container = Depends(get_container)
) -> DraftRunResponse:
    run = container.agent_execution_service.run_single(
        legal_request_id,
        create_text_content_agent(
            container.settings.mock_data_dir,
            container.agent_execution_service.llm_assist,
        ),
    )
    return _draft_response(run)


@router.get("/{legal_request_id}/production-package")
def get_production_package(
    legal_request_id: str, container: Container = Depends(get_container)
) -> ProductionPackage:
    _assert_exists(container, legal_request_id)
    request = container.legal_request_repository.get(legal_request_id)
    if request.production_package is None:
        raise NotFoundError("production_package", legal_request_id)
    findings = container.response_package_service.validate_package(
        request.production_package
    )
    request.production_package.validation_findings = findings
    request.package_validation_findings = findings
    return request.production_package


@router.post("/{legal_request_id}/deficiency-response/draft")
def draft_deficiency_response(
    legal_request_id: str, container: Container = Depends(get_container)
) -> DraftRunResponse:
    run = container.agent_execution_service.run_single(
        legal_request_id,
        create_text_content_agent(
            container.settings.mock_data_dir,
            container.agent_execution_service.llm_assist,
        ),
        requested_draft_type=DraftType.DEFICIENCY_RESPONSE.value,
    )
    return _draft_response(run)
