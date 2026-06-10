from typing import Literal

from app.models.base import CaseFlowModel
from app.models.enums import DraftType


class TextDraft(CaseFlowModel):
    """Text Content Agent output (produced in PR 2; modeled now). The
    status is type-constrained to draft_not_final."""

    schema_version: str = "1.0"
    draft_type: DraftType
    sections: dict[str, str] = {}
    status: Literal["draft_not_final"] = "draft_not_final"
    requires_human_approval: Literal[True] = True
    evidence_ids: list[str] = []
