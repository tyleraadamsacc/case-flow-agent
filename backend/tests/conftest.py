import pytest
from fastapi.testclient import TestClient

from app.api.deps import Container
from app.config import Settings
from app.main import create_app


@pytest.fixture()
def app():
    return create_app(Settings())


@pytest.fixture()
def container(app) -> Container:
    return app.state.container


@pytest.fixture()
def client(app) -> TestClient:
    return TestClient(app)


@pytest.fixture()
def advance_to_review(client):
    """Drive a seeded request through extract + validate so it sits in
    analyst_review_pending."""

    def _advance(legal_request_id: str) -> None:
        for step in ("extract", "validate"):
            response = client.post(f"/api/legal-requests/{legal_request_id}/{step}")
            assert response.status_code == 200, response.text

    return _advance
