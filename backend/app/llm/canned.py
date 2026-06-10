"""Canned model responses for MODEL_MODE=mock_model (plan §15).

Built from the real Pydantic models so every canned payload is valid by
construction. All content is synthetic and draft-only. Tests exercise the
repair/fallback path by injecting deliberately invalid responses.
"""

from app.models.classification_result import ClassificationResult
from app.models.enums import DraftType, LegalProcessType, NoteType, Sensitivity
from app.models.note_draft import NoteDraft
from app.models.text_draft import TextDraft


def canned_valid_responses() -> dict[str, str]:
    """Per-task valid JSON payloads for the MockModelClient."""
    classification = ClassificationResult(
        legal_process_type=LegalProcessType.SEARCH_WARRANT,
        request_category="mock_model_classification",
        product_domains=["Maps / Location"],
        urgency_tier="standard",
        sensitivity=Sensitivity.HIGH,
        recommended_queue="Location Response Review",
        complexity="standard",
        missing_fields=[],
        confidence=0.9,
        human_review_required=True,
        review_reasons=[],
        rationale="Mock model classification — synthetic canned output.",
        evidence_ids=[],
    )
    note = NoteDraft(
        note_type=NoteType.REQUEST_INTAKE_NOTE,
        body=(
            "Mock model intake note (SYNTHETIC). Drafted for human review — "
            "no field is applied without analyst approval."
        ),
        fields_to_update={},
        missing_fields=[],
    )
    package_draft = TextDraft(
        draft_type=DraftType.PRODUCTION_SUMMARY,
        sections={
            "header": "DRAFT response narrative (SYNTHETIC) — pending human approval.",
            "summary": "Mock model production summary over synthetic records.",
        },
        evidence_ids=[],
    )
    deficiency_draft = TextDraft(
        draft_type=DraftType.DEFICIENCY_RESPONSE,
        sections={
            "header": "DRAFT deficiency clarification (SYNTHETIC) — pending human approval.",
            "request": "Mock model clarification request — nothing is sent.",
        },
        evidence_ids=[],
    )
    return {
        "triage_classification": classification.model_dump_json(),
        "note_drafting": note.model_dump_json(),
        "response_package_drafting": package_draft.model_dump_json(),
        "deficiency_response_drafting": deficiency_draft.model_dump_json(),
    }
