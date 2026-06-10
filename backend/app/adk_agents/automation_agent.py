"""Automation Agent — sixth and last in the rail.

Prepares — never executes — the next workflow action: approval task,
deficiency follow-up, SME escalation/assignment, routine queue
assignment, or no-records review. The output status is type-constrained
to prepared_pending_human, and the agent has no dependency on any
repository write path: executing an action is impossible by construction.
"""

from datetime import date
from typing import Any

from app.adk_agents import session_state
from app.adk_agents.base import CaseFlowAgent
from app.adk_agents.registry import AUTOMATION_AGENT, OFFICIAL_AGENT_NAMES
from app.adk_agents.shared import (
    has_human_approval,
    blocking_deficiencies,
    is_overbroad,
    request_input_summary,
    sme_reasons_present,
)
from app.models.agent_run import AgentRunDraft
from app.models.automation_output import AutomationOutput
from app.models.classification_result import ClassificationResult
from app.models.enums import AgentRunStatus
from app.models.legal_request import LegalRequest

SLA_WARNING_DAYS = 7

SME_REASON_PHRASES = {
    "pen_register_requested": "Pen register requested",
    "trap_and_trace_requested": "Trap and trace requested",
    "non_disclosure_requested": "Non-disclosure requested",
    "sealed_order_requested": "Sealed order",
    "no_adverse_action_requested": "No adverse action ordered",
    "sensitive_party": "Sensitive-party registry match",
}


class AutomationAgent(CaseFlowAgent):
    """Prepares route, escalation, assignment, QA sampling, or follow-up
    actions.

    Prepares only — it never executes the actions it prepares.
    """

    def execute(self, state: dict[str, Any]) -> AgentRunDraft:
        request = session_state.get_legal_request(state)
        if request is None:
            return self.blocked("awaiting_triage", input_summary="no request in context")
        classification = session_state.get_classification(state)
        if classification is None:
            return self.blocked(
                "awaiting_triage",
                output_summary="Blocked: no triaging output to prepare actions from.",
                input_summary=request_input_summary(request),
            )

        output = self._prepare(state, request, classification)
        action_phrase = output.action_type.removeprefix("prepare_").replace("_", " ")
        return self.result(
            status=AgentRunStatus.COMPLETE,
            input_summary=request_input_summary(request),
            output_summary=(
                f"Prepared {action_phrase} for {output.target}. "
                "Not executed — human approval required."
            ),
            output={"automation_output": output.model_dump(mode="json")},
            rationale=output.reason,
            requires_human_review=True,
            review_reasons=[reason.value for reason in classification.review_reasons],
            risk_flags=(["sla_risk"] if output.sla_risk else [])
            + sme_reasons_present([r.value for r in classification.review_reasons]),
        )

    def _prepare(
        self,
        state: dict[str, Any],
        request: LegalRequest,
        classification: ClassificationResult,
    ) -> AutomationOutput:
        queue = classification.recommended_queue or "General Intake Review"
        sla_risk = self._sla_risk(state, request)
        etl_output = session_state.get_etl_output(state)
        sme_reasons = sme_reasons_present(
            [reason.value for reason in classification.review_reasons]
        )

        blocking = blocking_deficiencies(request)
        if blocking:
            codes = ", ".join(finding.code.value for finding in blocking)
            return AutomationOutput(
                action_type="prepare_deficiency_followup",
                target=queue,
                reason=(
                    f"Blocking deficiency ({codes}); production path on hold "
                    "pending clarification from the requesting agency."
                ),
                follow_up_tasks=[
                    "Send deficiency clarification to requesting agency "
                    "(draft pending human approval)."
                ],
                sla_risk=sla_risk,
            )

        approved = has_human_approval(request)
        if sme_reasons and not approved:
            phrases = [SME_REASON_PHRASES.get(reason, reason) for reason in sme_reasons]
            return AutomationOutput(
                action_type="prepare_sme_escalation",
                target="SME Review",
                reason=" and ".join(phrases[:2]) + ("." if phrases else ""),
                follow_up_tasks=[
                    "Notify SME queue (SME notification draft pending human approval)."
                ],
                sla_risk=sla_risk,
            )

        if is_overbroad(request) and not approved:
            return AutomationOutput(
                action_type="prepare_sme_assignment",
                target="SME Review",
                reason=(
                    f"Overbroad scope: {len(request.product_domains)} product "
                    "domains requested; SME scope assessment required."
                ),
                follow_up_tasks=[
                    "Request scope narrowing from requesting agency "
                    "(clarification draft pending human approval)."
                ],
                sla_risk=sla_risk,
            )

        if etl_output is not None and etl_output.total_responsive_records > 0:
            return AutomationOutput(
                action_type="prepare_approval_task",
                target=queue,
                reason=(
                    "Response package drafted with "
                    f"{etl_output.total_responsive_records} synthetic record(s); "
                    "awaiting analyst approval."
                ),
                follow_up_tasks=["Analyst review of drafted response package."],
                sla_risk=sla_risk,
            )

        if etl_output is not None and etl_output.records_ref is not None:
            # A mapped mock source genuinely returned zero records — the
            # no-records response draft needs analyst review (Scenario F).
            # An unmapped source (no records_ref) is the routine case.
            return AutomationOutput(
                action_type="prepare_no_records_review_task",
                target=queue,
                reason=(
                    "Mock retrieval returned zero responsive records; "
                    "no-records response draft awaits analyst review."
                ),
                follow_up_tasks=["Analyst review of no-responsive-records draft."],
                sla_risk=sla_risk,
            )

        return AutomationOutput(
            action_type="prepare_queue_assignment",
            target=queue,
            reason="Routine queue assignment prepared.",
            follow_up_tasks=["Analyst confirmation of queue assignment."],
            sla_risk=sla_risk,
        )

    @staticmethod
    def _sla_risk(state: dict[str, Any], request: LegalRequest) -> bool:
        deadline_days = request.special_handling.production_deadline_days
        if deadline_days is None or request.date_received is None:
            return False
        as_of_raw = state.get(session_state.AS_OF_DATE)
        as_of = date.fromisoformat(as_of_raw) if as_of_raw else date.today()
        elapsed = (as_of - request.date_received).days
        return (deadline_days - elapsed) <= SLA_WARNING_DAYS


def create_automation_agent() -> AutomationAgent:
    return AutomationAgent(
        name=AUTOMATION_AGENT,
        display_name=OFFICIAL_AGENT_NAMES[AUTOMATION_AGENT],
        description=(
            "Prepares route, escalation, assignment, QA sampling, or "
            "follow-up actions (prepared pending human; never executed)."
        ),
    )
