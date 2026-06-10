from fastapi import FastAPI

from app.api.routes.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="CaseFlow Agent API",
        version="0.1.0",
        description=(
            "Human-led LERS request workflow prototype. Synthetic data only; "
            "no production systems are connected."
        ),
    )
    app.include_router(health_router)
    return app


app = create_app()
