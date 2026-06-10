"""AgentRun model + repository: official names, serialization round-trip,
and the repository (not ADK session state) as source of truth."""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.adk_agents.registry import INDEXING_AGENT, OFFICIAL_AGENT_NAMES, RAIL_ORDER
from app.models.agent_run import AgentRun
from app.models.enums import AgentRunStatus
from app.repositories.local_agent_run_repository import LocalAgentRunRepository


def make_run(agent_id: str = INDEXING_AGENT, **overrides) -> AgentRun:
    payload = {
        "agent_id": agent_id,
        "agent_name": OFFICIAL_AGENT_NAMES[agent_id],
        "legal_request_id": "LER-2026-004812",
        "status": AgentRunStatus.COMPLETE,
        "input_summary": "LER-2026-004812: search warrant, 3 identifiers",
        "output_summary": "Indexed as Search Warrant + GPS Location + Maps/Location.",
        "output": {"primary_labels": ["Search Warrant"]},
        "confidence": 0.94,
        "started_at": datetime(2026, 6, 10, 12, 0, tzinfo=UTC),
        "completed_at": datetime(2026, 6, 10, 12, 0, 1, tzinfo=UTC),
    }
    payload.update(overrides)
    return AgentRun(**payload)


def test_agent_run_serializes_and_round_trips():
    run = make_run()
    assert run.agent_run_id.startswith("run_")
    assert run.model_id is None  # deterministic mode: no model involved
    restored = AgentRun.model_validate(run.model_dump(mode="json"))
    assert restored == run


def test_agent_run_carries_exact_official_display_name():
    for agent_id in RAIL_ORDER:
        run = make_run(agent_id=agent_id, agent_name=OFFICIAL_AGENT_NAMES[agent_id])
        assert run.agent_name == OFFICIAL_AGENT_NAMES[agent_id]


def test_agent_run_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        AgentRun(
            agent_id=INDEXING_AGENT,
            agent_name="Indexing Agent",
            legal_request_id="LER-X",
            status=AgentRunStatus.COMPLETE,
            approved=True,  # no agent-side approval field exists
        )


def test_blocked_run_keeps_reason_and_review_flags():
    run = make_run(
        status=AgentRunStatus.BLOCKED,
        blocked_reason="missing_date_range deficiency is blocking",
        requires_human_review=True,
        review_reasons=["missing_or_invalid_date_range"],
    )
    assert run.status == AgentRunStatus.BLOCKED
    assert run.blocked_reason is not None
    assert run.requires_human_review is True


def test_repository_save_get_and_list_for_request():
    repository = LocalAgentRunRepository()
    runs = [make_run(agent_id=agent_id) for agent_id in RAIL_ORDER]
    other = make_run(legal_request_id="LER-2026-004821")
    for run in [*runs, other]:
        repository.save(run)

    assert repository.get(runs[0].agent_run_id) == runs[0]
    listed = repository.list_for_request("LER-2026-004812")
    assert [run.agent_id for run in listed] == list(RAIL_ORDER)
    assert len(repository.list_all()) == 7


def test_repository_returns_copies_not_shared_state():
    repository = LocalAgentRunRepository()
    run = make_run()
    repository.save(run)
    fetched = repository.get(run.agent_run_id)
    fetched.output_summary = "mutated"
    assert repository.get(run.agent_run_id).output_summary != "mutated"
