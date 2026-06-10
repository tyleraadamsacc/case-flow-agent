"""Governance and insight endpoints. Read-only aggregations; every metric
carries a data-confidence label, and the RFP Agent Coverage module lists
all six agents by exact official name."""

from fastapi import APIRouter, Depends

from app.api.deps import Container, get_container
from app.api.schemas import (
    AgentActivityResponse,
    GovernanceSummaryResponse,
    WorkNeedingAttentionResponse,
)
from app.services.governance_metrics_service import AuditReadinessReport

router = APIRouter(prefix="/api/governance", tags=["governance"])


@router.get("/summary")
def governance_summary(
    container: Container = Depends(get_container),
) -> GovernanceSummaryResponse:
    return GovernanceSummaryResponse(metrics=container.governance_service.summary())


@router.get("/agent-activity")
def agent_activity(
    container: Container = Depends(get_container),
) -> AgentActivityResponse:
    return AgentActivityResponse(agents=container.governance_service.agent_activity())


@router.get("/work-needing-attention")
def work_needing_attention(
    container: Container = Depends(get_container),
) -> WorkNeedingAttentionResponse:
    return WorkNeedingAttentionResponse(
        items=container.governance_service.work_needing_attention()
    )


@router.get("/product-volume")
def product_volume(
    container: Container = Depends(get_container),
) -> GovernanceSummaryResponse:
    return GovernanceSummaryResponse(metrics=container.governance_service.product_volume())


@router.get("/processing-time-by-product")
def processing_time_by_product(
    container: Container = Depends(get_container),
) -> GovernanceSummaryResponse:
    return GovernanceSummaryResponse(
        metrics=container.governance_service.processing_time_by_product()
    )


@router.get("/bottlenecks")
def bottlenecks(
    container: Container = Depends(get_container),
) -> GovernanceSummaryResponse:
    return GovernanceSummaryResponse(metrics=container.governance_service.bottlenecks())


@router.get("/audit-readiness")
def audit_readiness(
    container: Container = Depends(get_container),
) -> AuditReadinessReport:
    return container.governance_service.audit_readiness()


@router.get("/response-package-status")
def response_package_status(
    container: Container = Depends(get_container),
) -> GovernanceSummaryResponse:
    return GovernanceSummaryResponse(
        metrics=container.governance_service.response_package_status()
    )
