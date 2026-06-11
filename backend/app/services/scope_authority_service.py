"""Deterministic LERS scope-to-authority review."""

from app.models.legal_request import LegalRequest
from app.models.lers_quality import ScopeAuthorityCheck
from app.models.requested_data_category import RequestedDataCategory


class ScopeAuthorityService:
    """Checks that requested records have an obvious cited authority family.

    This is intentionally conservative and deterministic. It does not make
    legal judgments; it gives analysts a visible coverage matrix and flags
    categories that need human confirmation.
    """

    def analyze(self, request: LegalRequest) -> list[ScopeAuthorityCheck]:
        citations = [authority.citation for authority in request.legal_authorities]
        return [
            self._check_category(category, citations)
            for category in request.requested_data_categories
        ]

    def _check_category(
        self, category: RequestedDataCategory, citations: list[str]
    ) -> ScopeAuthorityCheck:
        required = self._required_citations(category)
        matched = [
            citation
            for citation in citations
            if any(self._matches(citation, requirement) for requirement in required)
        ]
        if not required:
            return ScopeAuthorityCheck(
                category=category.category,
                status="needs_review",
                required_citations=[],
                matched_citations=matched,
                message="No deterministic authority rule exists for this requested category.",
            )
        if matched:
            return ScopeAuthorityCheck(
                category=category.category,
                status="covered",
                required_citations=required,
                matched_citations=matched,
                message="Requested category has matching cited authority.",
            )
        return ScopeAuthorityCheck(
            category=category.category,
            status="missing_authority",
            required_citations=required,
            matched_citations=[],
            message="Requested category does not have an obvious matching cited authority.",
        )

    @staticmethod
    def _required_citations(category: RequestedDataCategory) -> list[str]:
        text = f"{category.category} {category.product_domain}".lower()
        if category.content_type == "content" or any(
            term in text
            for term in (
                "email",
                "attachment",
                "draft",
                "photos",
                "videos",
                "voice",
                "docs",
                "sheets",
                "slides",
            )
        ):
            return ["18 U.S.C. §2703", "C.R.S. §16-3-301", "Crim. P. 41"]
        if category.content_type == "location" or any(
            term in text for term in ("location", "gps", "sensorvault")
        ):
            return ["C.R.S. §16-3-303.5", "18 U.S.C. §2703", "C.R.S. §16-3-301"]
        if any(term in text for term in ("pen register", "trap", "trace")):
            return ["18 U.S.C. §§3122 and 3123"]
        if any(
            term in text
            for term in (
                "subscriber",
                "account",
                "identifier",
                "device",
                "ip",
                "payment",
                "purchase",
                "tombstone",
                "activity",
                "calendar",
                "contacts",
                "cloud",
                "chromebook",
            )
        ):
            return ["18 U.S.C. §2703", "C.R.S. §16-3-301.1"]
        return []

    @staticmethod
    def _matches(citation: str, requirement: str) -> bool:
        citation_norm = citation.lower().replace(" ", "")
        requirement_norm = requirement.lower().replace(" ", "")
        return requirement_norm in citation_norm or citation_norm in requirement_norm
