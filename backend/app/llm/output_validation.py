"""Structured-output validation for model responses.

The repair/retry/block discipline (plan §15): validate against the task's
Pydantic schema; one repair attempt; a second failure blocks the run for
human review — invalid model output never flows into the workflow.
Preparation only: nothing calls a live model yet.
"""

import json

from pydantic import ValidationError

from app.models.base import CaseFlowModel


class OutputValidationResult(CaseFlowModel):
    valid: bool
    errors: list[str] = []
    repaired: bool = False


def validate_structured_output(
    raw_text: str, schema: type[CaseFlowModel]
) -> tuple[CaseFlowModel | None, OutputValidationResult]:
    """Parse and validate model text against a schema. Returns the parsed
    model (or None) plus a result the caller audits."""
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        return None, OutputValidationResult(valid=False, errors=[f"invalid JSON: {exc}"])
    try:
        return schema.model_validate(payload), OutputValidationResult(valid=True)
    except ValidationError as exc:
        errors = [
            f"{'.'.join(str(loc) for loc in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        ]
        return None, OutputValidationResult(valid=False, errors=errors)


def repair_prompt(original_prompt: str, errors: list[str]) -> str:
    """The single repair attempt: restate the schema violations. A second
    failure must block the run (status blocked + audit), never retry again."""
    return (
        f"{original_prompt}\n\n"
        "Your previous response failed schema validation with these errors:\n"
        + "\n".join(f"- {error}" for error in errors)
        + "\nReturn ONLY corrected JSON that satisfies the schema."
    )
