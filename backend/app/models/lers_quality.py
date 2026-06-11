"""LERS-specific quality review artifacts derived from request/package text."""

from typing import Literal

from app.models.base import CaseFlowModel


class SourceDocumentSection(CaseFlowModel):
    """A navigable source-document region for analyst review."""

    section_id: str
    title: str
    start_line: int
    end_line: int
    text: str


class SourceTraceTarget(CaseFlowModel):
    """Stable source target derived from an extraction source span."""

    section_id: str
    source_span: str | None = None
    match: Literal["exact_span", "normalized_span", "section"] = "section"


class ScopeAuthorityCheck(CaseFlowModel):
    """Whether a requested data category is covered by cited legal authority."""

    category: str
    status: Literal["covered", "needs_review", "missing_authority"]
    required_citations: list[str] = []
    matched_citations: list[str] = []
    message: str


class PackageValidationFinding(CaseFlowModel):
    """Completeness/integrity finding for a drafted response package."""

    code: str
    severity: Literal["blocking", "warning"]
    section: str
    message: str
