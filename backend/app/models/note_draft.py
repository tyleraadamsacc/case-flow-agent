from typing import Literal

from app.models.base import CaseFlowModel
from app.models.enums import NoteType


class NoteDraft(CaseFlowModel):
    """Note Taking and Data Entry Agent output (produced in PR 2; modeled
    now). Always requires human approval before any field is applied."""

    schema_version: str = "1.0"
    note_type: NoteType
    body: str
    fields_to_update: dict[str, str] = {}
    missing_fields: list[str] = []
    requires_human_approval: Literal[True] = True
