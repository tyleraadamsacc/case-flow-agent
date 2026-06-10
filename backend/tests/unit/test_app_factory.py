from app.main import create_app


def test_create_app_registers_healthz():
    app = create_app()
    paths = {route.path for route in app.routes}
    assert "/healthz" in paths
