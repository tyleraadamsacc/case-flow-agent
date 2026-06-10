"""Per-agent deterministic business logic, exercised directly through
execute(state) with constructed session states."""

from datetime import UTC, date, datetime

from app.adk_agents import session_state
from app.adk_agents.automation_agent import create_automation_agent
from app.adk_agents.etl_agent import create_etl_agent
from app.adk_agents.indexing_agent import create_indexing_agent
from app.adk_agents.triaging_agent import create_triaging_agent
from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import (
    AgentRunStatus,
    DeficiencyCode,
    DeficiencySeverity,
    IdentifierType,
    LegalProcessType,
)
from app.models.legal_process import LegalProcess
from app.models.legal_request import LegalRequest
from app.models.requested_period import RequestedPeriod
from app.models.special_handling import SpecialHandlingFlags
from app.models.subject_identifier import SubjectIdentifier


def location_request(**overrides) -> LegalRequest:
    payload = dict(
        legal_request_id="LER-TEST-0001",
        date_received=date(2026, 6, 1),
        legal_process=LegalProcess(
            type=LegalProcessType.SEARCH_WARRANT,
            court_order_included=True,
            location_tracking=True,
            stored_communications=True,
        ),
        subject_identifiers=[
            SubjectIdentifier(type=IdentifierType.ACCOUNT_ID, value="ACC-1", confidence=0.9)
        ],
        product_domains=["Maps / Location"],
        requested_period=RequestedPeriod(
            start=datetime(2026, 5, 10, tzinfo=UTC),
            end=datetime(2026, 5, 15, tzinfo=UTC),
            valid=True,
        ),
        special_handling=SpecialHandlingFlags(
            location_tracking_requested=True, production_deadline_days=35
        ),
    )
    payload.update(overrides)
    return LegalRequest(**payload)


def state_for(request: LegalRequest, **extra) -> dict:
    state = {session_state.LEGAL_REQUEST: request.model_dump(mode="json")}
    state.update(extra)
    return state


def with_run(state: dict, agent, base_state: dict | None = None) -> dict:
    draft = agent.execute(base_state if base_state is not None else state)
    state[session_state.run_key(agent.name)] = draft.model_dump(mode="json")
    return state


def test_indexing_blocked_without_extracted_fields():
    draft = create_indexing_agent().execute(
        state_for(LegalRequest(legal_request_id="LER-EMPTY"))
    )
    assert draft.status == AgentRunStatus.BLOCKED
    assert draft.blocked_reason == "extraction_incomplete"


def test_indexing_pen_register_gets_priority_one_and_sop_match():
    request = location_request(
        product_domains=["Account / Subscriber"],
        legal_process=LegalProcess(type=LegalProcessType.EX_PARTE_ORDER, pen_register=True),
        special_handling=SpecialHandlingFlags(
            pen_register_requested=True, trap_and_trace_requested=True
        ),
    )
    draft = create_indexing_agent().execute(state_for(request))
    output = draft.output["indexing_output"]
    assert output["priority_rank"] == 1
    assert "SOP-PEN-REGISTER-TT" in output["sop_matches"]


def test_triaging_blocked_without_indexing_output():
    draft = create_triaging_agent().execute(state_for(location_request()))
    assert draft.status == AgentRunStatus.BLOCKED
    assert draft.blocked_reason == "awaiting_indexing"


def test_triaging_routes_location_to_location_response_review():
    state = with_run(state_for(location_request()), create_indexing_agent())
    draft = create_triaging_agent().execute(state)
    classification = draft.output["classification"]
    assert classification["request_category"] == "Location Data Production"
    assert classification["recommended_queue"] == "Location Response Review"
    assert classification["confidence"] == 0.94
    routing = draft.output["routing_recommendation"]
    assert routing["status"] == "recommended_pending_human"
    assert routing["requires_approval"] is True


def test_triaging_ambiguous_process_gets_low_confidence_and_review():
    request = location_request(legal_process=None)
    state = with_run(state_for(request), create_indexing_agent())
    draft = create_triaging_agent().execute(state)
    assert draft.status == AgentRunStatus.NEEDS_REVIEW
    assert draft.confidence == 0.55
    assert "low_classification_confidence" in draft.review_reasons


def test_triaging_sensitive_party_forces_sme_queue_and_sop_conflict():
    request = location_request(
        product_domains=["Account / Subscriber"],
        legal_process=LegalProcess(type=LegalProcessType.COURT_ORDER),
        special_handling=SpecialHandlingFlags(),
    )
    request.requesting_agency = None
    state = with_run(state_for(request), create_indexing_agent())
    agent = create_triaging_agent()
    agent.sensitive_parties = ["Office of the Synthetic State Regulator"]
    from app.models.requesting_agency import RequestingAgency

    request.requesting_agency = RequestingAgency(
        agency="Office of the Synthetic State Regulator"
    )
    state[session_state.LEGAL_REQUEST] = request.model_dump(mode="json")
    draft = agent.execute(state)
    classification = draft.output["classification"]
    assert classification["recommended_queue"] == "SME Review"
    assert "sensitive_party" in draft.review_reasons
    assert "sop_conflict" in draft.review_reasons


def make_record(record_id: str, when: datetime) -> dict:
    return {
        "record_id": record_id,
        "timestamp_utc": when.isoformat(),
        "latitude": 34.05,
        "longitude": -118.24,
        "accuracy_meters": 10.0,
        "source": "gps",
    }


def etl_state(request: LegalRequest, records: list[dict], ref: str | None) -> dict:
    state = state_for(
        request,
        **{
            session_state.RESPONSIVE_RECORDS: records,
            session_state.RECORDS_REF: ref,
        },
    )
    with_run(state, create_indexing_agent())
    with_run(state, create_triaging_agent())
    return state


def test_etl_filters_records_to_the_requested_period():
    records = [
        make_record("REC-IN-1", datetime(2026, 5, 11, tzinfo=UTC)),
        make_record("REC-IN-2", datetime(2026, 5, 14, tzinfo=UTC)),
        make_record("REC-OUT", datetime(2026, 4, 1, tzinfo=UTC)),
    ]
    state = etl_state(location_request(), records, "local://response_records/test.json")
    draft = create_etl_agent().execute(state)
    assert draft.status == AgentRunStatus.COMPLETE
    output = draft.output["etl_output"]
    assert output["total_responsive_records"] == 2
    assert output["data_confidence"] == "synthetic_mock"
    assert [r["record_id"] for r in draft.output["records"]] == ["REC-IN-1", "REC-IN-2"]


def test_etl_blocking_deficiency_outranks_other_block_reasons():
    request = location_request(
        requested_period=None,
        deficiency_findings=[
            DeficiencyFinding(
                code=DeficiencyCode.MISSING_DATE_RANGE,
                severity=DeficiencySeverity.BLOCKING,
                message="Requested period is missing.",
            )
        ],
        special_handling=SpecialHandlingFlags(pen_register_requested=True),
    )
    state = etl_state(request, [], None)
    draft = create_etl_agent().execute(state)
    assert draft.status == AgentRunStatus.BLOCKED
    assert draft.blocked_reason.startswith("blocking_deficiency")


def test_automation_sla_risk_uses_injected_as_of_date():
    request = location_request()  # received 2026-06-01, 35-day deadline
    base = etl_state(request, [], None)
    agent = create_automation_agent()

    base[session_state.AS_OF_DATE] = "2026-06-10"
    relaxed = agent.execute(dict(base)).output["automation_output"]
    assert relaxed["sla_risk"] is False

    base[session_state.AS_OF_DATE] = "2026-07-04"  # 33 days elapsed of 35
    tight = agent.execute(dict(base)).output["automation_output"]
    assert tight["sla_risk"] is True
    assert tight["status"] == "prepared_pending_human"
    assert tight["requires_approval"] is True
