"""Role gating for sensitive human actions (synthetic, not real auth).

Kept dependency-free of the request/container wiring so it can be called
from any route without an import cycle. The role arrives on the actor via
the X-CaseFlow-Role header (see app/api/deps.py).
"""

from collections.abc import Iterable

from app.errors import AuthorizationError
from app.models.enums import Role


def require_role(role: Role, allowed: Iterable[Role], action: str) -> None:
    """Raise AuthorizationError unless ``role`` is in ``allowed``."""
    allowed_set = set(allowed)
    if role not in allowed_set:
        raise AuthorizationError(
            action, role.value, sorted(r.value for r in allowed_set)
        )
