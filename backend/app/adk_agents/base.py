from collections.abc import AsyncGenerator

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types


class CaseFlowAgent(BaseAgent):
    """Shared base for the six RFP agents.

    ADK requires ``name`` to be a valid identifier, so it carries the
    snake_case agent id; ``display_name`` carries the exact official RFP
    name shown in UI, audit, and governance surfaces.

    Execution layer only: no CaseFlow agent may finalize route, response
    package, production, release, or send actions — those transitions live
    behind code-enforced human approval in the FastAPI application layer.
    """

    display_name: str

    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        # PR 0 placeholder: prove the agent executes inside ADK with zero
        # credentials. Deterministic workflow behavior arrives in PR 2.
        yield Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            content=types.Content(
                role="model",
                parts=[
                    types.Part(
                        text=(
                            f"{self.display_name}: placeholder run — "
                            "deterministic workflow behavior arrives in PR 2."
                        )
                    )
                ],
            ),
        )
