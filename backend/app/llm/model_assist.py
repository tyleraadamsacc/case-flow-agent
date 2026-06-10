"""Model assistance for the applicable agents (plan §15).

The deterministic output is computed first and is always the safety net.
When a model-assisted mode is active, the agent's draft payload is
re-drafted by the model and validated against the task's schema:

1. one call, validated against the Pydantic schema;
2. on failure, one repair call with the validation errors appended;
3. on a second failure the deterministic output stands, the run is
   marked ``requires_human_review`` with ``validation_status``
   ``model_output_invalid``, and the failure is recorded in the run's
   audit summary (one audit event per run, failure included).

The model never touches workflow state, approvals, the record index, or
anything on the ALWAYS_DETERMINISTIC list — it re-drafts narrative and
classification payloads only, and every result remains a draft pending
human review.
"""

from typing import Any

from app.llm.model_router import ModelRouter
from app.llm.output_validation import repair_prompt, validate_structured_output
from app.llm.prompt_loader import PromptLoader
from app.models.agent_run import AgentRunDraft
from app.models.base import CaseFlowModel
from app.models.classification_result import ClassificationResult
from app.models.note_draft import NoteDraft
from app.models.text_draft import TextDraft

# task -> (output schema, the draft.output key the model re-drafts)
TASK_SPECS: dict[str, tuple[type[CaseFlowModel], str]] = {
    "triage_classification": (ClassificationResult, "classification"),
    "note_drafting": (NoteDraft, "note_draft"),
    "response_package_drafting": (TextDraft, "text_draft"),
    "deficiency_response_drafting": (TextDraft, "text_draft"),
}

VALIDATION_FAILED_STATUS = "model_output_invalid"
VALIDATION_FAILED_REASON = "model_output_validation_failed"


class ModelAssist:
    def __init__(self, router: ModelRouter, prompts: PromptLoader) -> None:
        self._router = router
        self._prompts = prompts

    def apply(
        self, *, task: str, draft: AgentRunDraft, context: dict[str, Any]
    ) -> AgentRunDraft:
        """Re-draft one payload of a completed deterministic draft."""
        spec = TASK_SPECS.get(task)
        client = self._router.client_for(task)
        if spec is None or client is None:
            return draft
        schema, output_key = spec
        if output_key not in draft.output:
            return draft

        prompt = self._prompts.get(task)
        rendered = prompt.render(
            {
                "deterministic_draft": draft.output[output_key],
                **context,
            }
        )
        draft.prompt_version = prompt.version

        response = client.complete(task=task, prompt=rendered)
        draft.model_id = response.model_id
        model, result = validate_structured_output(response.text, schema)

        if model is None:
            # The single repair attempt (plan §15) — then stop.
            draft.retry_count = 1
            response = client.complete(
                task=task, prompt=repair_prompt(rendered, result.errors)
            )
            model, result = validate_structured_output(response.text, schema)

        if model is None:
            # Deterministic fallback stands; a human must look at it.
            draft.validation_status = VALIDATION_FAILED_STATUS
            draft.requires_human_review = True
            if VALIDATION_FAILED_REASON not in draft.review_reasons:
                draft.review_reasons.append(VALIDATION_FAILED_REASON)
            draft.output_summary = (
                f"{draft.output_summary} Model output failed schema validation "
                "after one repair attempt; deterministic draft retained — "
                "human review required."
            )
            return draft

        merged = self._merge(draft, model, output_key)
        return merged

    def _merge(
        self, draft: AgentRunDraft, model: CaseFlowModel, output_key: str
    ) -> AgentRunDraft:
        """Adopt the validated model payload while preserving the
        deterministic evidence references (drafts must never lose their
        grounding) and the agent's review obligations."""
        deterministic = draft.output[output_key]
        payload = model.model_dump(mode="json")

        deterministic_evidence = (
            deterministic.get("evidence_ids", [])
            if isinstance(deterministic, dict)
            else []
        )
        if "evidence_ids" in payload:
            payload["evidence_ids"] = list(
                dict.fromkeys([*payload["evidence_ids"], *deterministic_evidence])
            )
            draft.evidence_ids = list(
                dict.fromkeys([*draft.evidence_ids, *payload["evidence_ids"]])
            )

        draft.output[output_key] = payload
        confidence = payload.get("confidence")
        if isinstance(confidence, (int, float)):
            draft.confidence = float(confidence)
        if payload.get("human_review_required"):
            draft.requires_human_review = True
        if payload.get("rationale"):
            draft.rationale = payload["rationale"]
        draft.validation_status = "valid"
        return draft
