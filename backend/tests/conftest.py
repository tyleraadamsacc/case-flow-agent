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


SENIOR_HEADERS = {"X-CaseFlow-Actor": "senior.local", "X-CaseFlow-Role": "senior_analyst"}


@pytest.fixture()
def attest_required(client):
    """Record every required pre-finalization attestation for a request
    (theme E), so an approve attempt is not blocked on attestations.
    Returns the list of items attested."""

    def _attest(legal_request_id: str, *, headers: dict | None = None) -> list[str]:
        status = client.get(
            f"/api/legal-requests/{legal_request_id}/finalization-status"
        ).json()
        required = status["required_attestations"]
        for item in required:
            response = client.post(
                f"/api/legal-requests/{legal_request_id}/attest",
                json={"item": item},
                headers=headers or {},
            )
            assert response.status_code in (200, 409), response.text
        return required

    return _attest


@pytest.fixture()
def finalize(client, attest_required):
    """Complete the human finalization gate (theme B + E): attest all
    required items, then approve — co-signing as a senior analyst when the
    request requires dual control. Returns the final approve response."""

    def _finalize(legal_request_id: str):
        attest_required(legal_request_id)
        approve = client.post(
            f"/api/legal-requests/{legal_request_id}/approve", json={}
        )
        if approve.status_code == 200 and approve.json().get("awaiting_approval"):
            approve = client.post(
                f"/api/legal-requests/{legal_request_id}/approve",
                json={},
                headers=SENIOR_HEADERS,
            )
        return approve

    return _finalize
