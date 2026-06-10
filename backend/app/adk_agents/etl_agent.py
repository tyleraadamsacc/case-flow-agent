"""ETL Agent — third in the rail.

Simulates the responsive data pull from the synthetic mock record store.
Mock-only and read-only, MVP and beyond: the records are seeded into
session state by the execution bridge from mock_data/response_records/,
and the output is type-constrained to data_confidence=synthetic_mock.

The agent refuses to run — a visible blocked run, never a silent skip —
when a blocking deficiency exists, when SME escalation is pending, or
when the scope is overbroad without review.
"""

from typing import Any

from app.adk_agents import session_state
from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import ETL_AGENT, OFFICIAL_AGENT_NAMES, TRIAGING_AGENT
from app.adk_agents.shared import (
    blocking_deficiencies,
    is_overbroad,
    request_input_summary,
    sme_reasons_present,
)
from app.models.agent_run import AgentRunDraft
from app.models.enums import AgentRunStatus
from app.models.etl_output import EtlOutput
from app.models.legal_request import LegalRequest
from app.models.responsive_record import ResponsiveRecord

NO_PRODUCTION_BACKEND = "No production backend connected"


class EtlAgent(CaseFlowAgent):
    """Simulates an approved responsive data pull from the mock repository.

    Mock-only and read-only in MVP: no production backend is ever
    connected, and all results are labeled synthetic.
    """

    def execute(self, state: dict[str, Any]) -> AgentRunDraft:
        request = session_state.get_legal_request(state)
        if request is None:
            return self.blocked("awaiting_triage", input_summary="no request in context")
        input_summary = request_input_summary(request)

        triaging_draft = session_state.get_run_draft(state, TRIAGING_AGENT)
        if triaging_draft is None or not triaging_draft.output.get("classification"):
            return self.blocked("awaiting_triage", input_summary=input_summary)

        blocking = blocking_deficiencies(request)
        if blocking:
            names = ", ".join(finding.code.value.replace("_", " ") for finding in blocking)
            return self.blocked(
                f"blocking_deficiency: {', '.join(f.code.value for f in blocking)}",
                output_summary=f"Blocked: {names} deficiency.",
                input_summary=input_summary,
                review_reasons=[finding.code.value for finding in blocking],
                risk_flags=["blocking_deficiency"],
            )

        sme_reasons = sme_reasons_present(triaging_draft.review_reasons)
        if sme_reasons:
            return self.blocked(
                "sme_escalation_pending",
                output_summary=(
                    "Blocked: SME escalation pending — "
                    f"{', '.join(sme_reasons)}. No retrieval until SME review."
                ),
                input_summary=input_summary,
                review_reasons=sme_reasons,
                risk_flags=["sme_escalation_pending"],
            )

        if is_overbroad(request):
            return self.blocked(
                "overbroad_scope_pending_review",
                output_summary=(
                    "Blocked: overbroad scope — "
                    f"{len(request.product_domains)} product domains requested; "
                    "SME scope review required before retrieval."
                ),
                input_summary=input_summary,
                review_reasons=["overbroad_scope"],
                risk_flags=["overbroad_scope"],
            )

        records = self._records_in_period(state, request)
        records_ref = state.get(session_state.RECORDS_REF)
        limitations = [NO_PRODUCTION_BACKEND]
        if records_ref is None:
            limitations.append("No mock record source is mapped for this request.")

        output = EtlOutput(
            query_type=self._query_type(request),
            data_sources_checked=[
                f"mock_store:{domain}" for domain in request.product_domains
            ]
            or ["mock_store:Account / Subscriber"],
            total_responsive_records=len(records),
            records_ref=records_ref,
            limitations=limitations,
        )
        noun = "GPS record" if output.query_type == "gps_location_history" else "record"
        return self.result(
            status=AgentRunStatus.COMPLETE,
            input_summary=input_summary,
            output_summary=(
                f"{len(records)} synthetic {noun}{'' if len(records) == 1 else 's'} "
                "found for requested period."
            ),
            output={
                "etl_output": output.model_dump(mode="json"),
                "records": [record.model_dump(mode="json") for record in records],
            },
            rationale=(
                "Deterministic filter of the seeded mock record store by subject "
                "identifiers and requested period. Synthetic data only."
            ),
            risk_flags=["zero_responsive_records"] if not records else [],
        )

    @staticmethod
    def _records_in_period(
        state: dict[str, Any], request: LegalRequest
    ) -> list[ResponsiveRecord]:
        records = [
            ResponsiveRecord.model_validate(item)
            for item in state.get(session_state.RESPONSIVE_RECORDS) or []
        ]
        period = request.requested_period
        if period is None or period.start is None or period.end is None:
            return records
        return [
            record
            for record in records
            if record.timestamp_utc is None
            or period.start <= record.timestamp_utc <= period.end
        ]

    @staticmethod
    def _query_type(request: LegalRequest) -> str:
        if any(
            category.content_type == "location"
            for category in request.requested_data_categories
        ):
            return "gps_location_history"
        if "Account / Subscriber" in request.product_domains:
            return "subscriber_information"
        return "general_records"


def create_etl_agent() -> EtlAgent:
    return EtlAgent(
        name=ETL_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[ETL_AGENT],
        description=(
            "Simulates an approved responsive data pull from the mock "
            "repository (mock-only, read-only, synthetic data)."
        ),
    )
