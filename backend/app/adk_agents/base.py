from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions
from google.genai import types
from pydantic import ConfigDict

from app.adk_agents.session_state import LEGAL_REQUEST, run_key
from app.llm.model_assist import ModelAssist
from app.models.agent_run import AgentRunDraft
from app.models.enums import AgentRunStatus


class CaseFlowAgent(BaseAgent):
    """Shared base for the six RFP agents.

    ADK requires ``name`` to be a valid identifier, so it carries the
    snake_case agent id; ``display_name`` carries the exact official RFP
    name shown in UI, audit, and governance surfaces.

    Each run reads its context from ADK session state (scratchpad),
    computes a deterministic ``AgentRunDraft``, and writes it back via a
    state delta. Blocked and failed runs are reported the same way — an
    agent never silently disappears from the rail.

    Model assistance (plan §15): agents that declare ``llm_task`` and
    receive a ``ModelAssist`` re-draft their payload through the
    configured model AFTER the deterministic pass — the deterministic
    output is always the fallback, and assisted output remains a draft
    pending human review. ETL and Automation never declare a task.

    Execution layer only: no CaseFlow agent may finalize route, response
    package, production, release, or send actions — those transitions live
    behind code-enforced human approval in the FastAPI application layer.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    display_name: str
    llm_task: str | None = None
    llm_assist: ModelAssist | None = None

    def llm_task_for(self, draft: AgentRunDraft) -> str | None:
        """The model task for this draft; agents whose task depends on
        the produced draft (Text Content) override this."""
        del draft
        return self.llm_task

    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        started = datetime.now(UTC)
        try:
            state = dict(ctx.session.state)
            draft = self.execute(state)
            task = self.llm_task_for(draft)
            if (
                self.llm_assist is not None
                and task is not None
                and draft.status is AgentRunStatus.COMPLETE
            ):
                draft = self.llm_assist.apply(
                    task=task,
                    draft=draft,
                    context={"legal_request": state.get(LEGAL_REQUEST)},
                )
        except Exception as exc:  # noqa: BLE001 — failures must surface as audited runs
            draft = self.result(
                status=AgentRunStatus.FAILED,
                output_summary=f"{self.display_name} run failed: {exc}",
                rationale=str(exc),
                validation_status="invalid",
            )
        completed = datetime.now(UTC)
        draft.started_at = started
        draft.completed_at = completed
        draft.latency_ms = (completed - started).total_seconds() * 1000

        yield Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=f"{self.display_name}: {draft.output_summary}")],
            ),
            actions=EventActions(
                state_delta={run_key(self.name): draft.model_dump(mode="json")}
            ),
        )

    def execute(self, state: dict[str, Any]) -> AgentRunDraft:
        """Deterministic business behavior, implemented per agent."""
        raise NotImplementedError

    def result(
        self,
        *,
        status: AgentRunStatus,
        output_summary: str,
        input_summary: str = "",
        output: dict[str, Any] | None = None,
        confidence: float | None = None,
        rationale: str | None = None,
        evidence_ids: list[str] | None = None,
        requires_human_review: bool = False,
        review_reasons: list[str] | None = None,
        risk_flags: list[str] | None = None,
        blocked_reason: str | None = None,
        validation_status: str = "valid",
    ) -> AgentRunDraft:
        return AgentRunDraft(
            agent_id=self.name,
            agent_name=self.display_name,
            status=status,
            input_summary=input_summary,
            output_summary=output_summary,
            output=output or {},
            confidence=confidence,
            rationale=rationale,
            evidence_ids=evidence_ids or [],
            requires_human_review=requires_human_review,
            review_reasons=review_reasons or [],
            risk_flags=risk_flags or [],
            blocked_reason=blocked_reason,
            validation_status=validation_status,
        )

    def blocked(
        self,
        reason: str,
        *,
        output_summary: str | None = None,
        input_summary: str = "",
        review_reasons: list[str] | None = None,
        risk_flags: list[str] | None = None,
    ) -> AgentRunDraft:
        return self.result(
            status=AgentRunStatus.BLOCKED,
            output_summary=output_summary or f"Blocked: {reason}.",
            input_summary=input_summary,
            requires_human_review=True,
            review_reasons=review_reasons or [],
            risk_flags=risk_flags or [],
            blocked_reason=reason,
        )
