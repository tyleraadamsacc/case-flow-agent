"""Shared plumbing for the GCP adapter skeletons (plan §19 PR 10).

The prototype runs fully local with zero credentials; every GCP adapter
is a config-selected skeleton behind the same repository/service
interfaces. Selecting one without the optional dependencies or required
configuration fails loudly with instructions — never silently.
"""


class GcpAdapterNotReadyError(RuntimeError):
    """A GCP adapter was selected but cannot run: missing optional
    dependency, missing configuration, or post-MVP wiring not yet
    implemented."""


def require_gcp_package(module_name: str) -> None:
    """Import-check an optional GCP dependency with install guidance."""
    import importlib.util

    try:
        spec = importlib.util.find_spec(module_name)
    except ModuleNotFoundError:  # parent namespace package absent
        spec = None
    if spec is None:
        raise GcpAdapterNotReadyError(
            f"GCP mode requires the '{module_name}' package. Install the "
            'optional extra: pip install -e "./backend[gcp]"'
        )


def require_setting(value: str | None, env_name: str) -> str:
    if not value:
        raise GcpAdapterNotReadyError(
            f"GCP mode requires {env_name} in the environment (no secrets "
            "are committed; see docs/DEPLOYMENT.md)."
        )
    return value
