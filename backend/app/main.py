from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.deps import Container
from app.api.routes.audit import router as audit_router
from app.api.routes.governance import router as governance_router
from app.api.routes.health import router as health_router
from app.api.routes.legal_requests import router as legal_requests_router
from app.api.routes.review import router as review_router
from app.config import Settings
from app.errors import (
    AuditWriteError,
    FinalizationBlockedError,
    InvalidStateTransitionError,
    NotFoundError,
)
from app.logging_config import new_correlation_id, setup_logging


def create_app(
    settings: Settings | None = None, container: Container | None = None
) -> FastAPI:
    settings = settings or Settings()
    setup_logging(settings.log_level)

    app = FastAPI(
        title="CaseFlow Agent API",
        version="0.1.0",
        description=(
            "Human-led LERS request workflow prototype. Synthetic data only; "
            "no production systems are connected."
        ),
    )

    container = container or Container(settings)
    if settings.seed_on_startup:
        container.seed()
    app.state.container = container

    app.include_router(health_router)
    app.include_router(legal_requests_router)
    app.include_router(review_router)
    app.include_router(audit_router)
    app.include_router(governance_router)

    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next):
        correlation_id = new_correlation_id()
        response = await call_next(request)
        response.headers["X-Request-ID"] = correlation_id
        return response

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(InvalidStateTransitionError)
    async def invalid_transition_handler(request: Request, exc: InvalidStateTransitionError):
        return JSONResponse(
            status_code=409,
            content={
                "detail": str(exc),
                "from_state": exc.from_state.value,
                "to_state": exc.to_state.value,
            },
        )

    @app.exception_handler(FinalizationBlockedError)
    async def finalization_blocked_handler(request: Request, exc: FinalizationBlockedError):
        return JSONResponse(
            status_code=409,
            content={
                "detail": str(exc),
                "blocked": True,
                "reasons": exc.reasons,
            },
        )

    @app.exception_handler(AuditWriteError)
    async def audit_write_handler(request: Request, exc: AuditWriteError):
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    return app


app = create_app()
