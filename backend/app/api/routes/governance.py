from fastapi import APIRouter, Depends

from app.api.deps import Container, get_container
from app.api.schemas import GovernanceSummaryResponse

router = APIRouter(prefix="/api/governance", tags=["governance"])


@router.get("/summary")
def governance_summary(
    container: Container = Depends(get_container),
) -> GovernanceSummaryResponse:
    return GovernanceSummaryResponse(metrics=container.governance_service.summary())
