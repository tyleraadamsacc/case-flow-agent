"""Deterministic response-package and outward-text assembly per the
Template LERS Response structure (response_package_rules.json).

Pure assembly over domain models — no repository access, no I/O beyond
the template file loaded at construction. Everything produced here is a
draft: ProductionPackage status and TextDraft status are type-constrained
so no agent-reachable final exists, and the record index is always copied
verbatim from the ETL output, never invented.
"""

import json
from datetime import date
from pathlib import Path
from typing import Any, Literal

from app.adk_agents.registry import (
    ETL_AGENT,
    INDEXING_AGENT,
    NOTE_TAKING_AND_DATA_ENTRY_AGENT,
    OFFICIAL_AGENT_NAMES,
    TEXT_CONTENT_AGENT,
)
from app.models.certification import Certification
from app.models.chain_of_custody import ChainOfCustody
from app.models.classification_result import ClassificationResult
from app.models.deficiency_finding import DeficiencyFinding
from app.models.enums import DraftType
from app.models.etl_output import EtlOutput
from app.models.legal_request import LegalRequest
from app.models.lers_quality import PackageValidationFinding
from app.models.production_package import (
    DataFieldDefinition,
    ProductionPackage,
    ProductionSummary,
)
from app.models.responsive_record import ResponsiveRecord

# Section → producing agent, rendered as provenance chips in the UI.
SECTION_PROVENANCE: dict[str, str] = {
    "header": OFFICIAL_AGENT_NAMES[TEXT_CONTENT_AGENT],
    "requesting_agency": OFFICIAL_AGENT_NAMES[TEXT_CONTENT_AGENT],
    "subject_identifiers": OFFICIAL_AGENT_NAMES[INDEXING_AGENT],
    "production_summary": OFFICIAL_AGENT_NAMES[TEXT_CONTENT_AGENT],
    "record_index": OFFICIAL_AGENT_NAMES[ETL_AGENT],
    "field_definitions": OFFICIAL_AGENT_NAMES[TEXT_CONTENT_AGENT],
    "chain_of_custody": OFFICIAL_AGENT_NAMES[NOTE_TAKING_AND_DATA_ENTRY_AGENT],
    "certification": OFFICIAL_AGENT_NAMES[TEXT_CONTENT_AGENT],
}


class ResponsePackageService:
    def __init__(self, rules_path: Path) -> None:
        self._rules: dict[str, Any] = json.loads(rules_path.read_text())

    def evidence_id(self, draft_type: DraftType) -> str:
        return self._rules["evidence_ids"][draft_type.value]

    def build_production_package(
        self,
        request: LegalRequest,
        etl_output: EtlOutput,
        records: list[ResponsiveRecord],
        *,
        as_of: date,
        risk_flags: list[str] | None = None,
    ) -> ProductionPackage:
        period = request.requested_period
        no_records = not records
        summary_statement = (
            self._rules["no_responsive_records_statement"]
            if no_records
            else self._rules["ordinary_course_statement"]
        )
        field_kind = "gps" if self._is_location_request(request) else "subscriber"
        package = ProductionPackage(
            request_id=request.legal_request_id,
            # Format per Template LERS Response: PROD-2026-004812-01.
            production_id=f"PROD-{request.legal_request_id.removeprefix('LER-')}-01",
            date_produced=as_of,
            requesting_agency=request.requesting_agency,
            subject_identifiers=request.subject_identifiers,
            production_summary=ProductionSummary(
                start_date=period.start if period else None,
                end_date=period.end if period else None,
                total_responsive_records=etl_output.total_responsive_records,
                ordinary_course_statement=summary_statement,
            ),
            # The record index is copied verbatim from the ETL output.
            records=[record.model_copy(deep=True) for record in records],
            field_definitions=[]
            if no_records
            else [
                DataFieldDefinition.model_validate(item)
                for item in self._rules["field_definitions"][field_kind]
            ],
            chain_of_custody=ChainOfCustody(
                collection_date=as_of,
                collection_method=self._rules["chain_of_custody_template"][
                    "collection_method"
                ],
                collected_by=self._rules["chain_of_custody_template"]["collected_by"],
            ),
            certification=Certification(
                authorized_representative=self._rules["certification_template"].get(
                    "authorized_representative"
                ),
                title=self._rules["certification_template"]["title"],
                certification_text=self._rules["certification_template"][
                    "certification_text"
                ],
            ),
            risk_flags=risk_flags or [],
            section_provenance=dict(SECTION_PROVENANCE),
        )
        package.validation_findings = self.validate_package(package)
        return package

    def validate_package(
        self, package: ProductionPackage
    ) -> list[PackageValidationFinding]:
        findings: list[PackageValidationFinding] = []
        self._require(
            findings,
            bool(package.production_id),
            code="missing_production_id",
            section="header",
            message="Production package is missing a production ID.",
        )
        self._require(
            findings,
            bool(package.request_id),
            code="missing_request_id",
            section="header",
            message="Production package is missing the source legal request ID.",
        )
        self._require(
            findings,
            package.date_produced is not None,
            code="missing_date_produced",
            section="header",
            message="Production package is missing the production date.",
        )
        self._require(
            findings,
            package.requesting_agency is not None,
            code="missing_requesting_agency",
            section="requesting_agency",
            message="Production package is missing requesting agency details.",
        )
        self._require(
            findings,
            bool(package.subject_identifiers),
            code="missing_subject_identifiers",
            section="subject_identifiers",
            message="Production package is missing subject identifiers.",
        )

        record_count = len(package.records)
        summary_count = package.production_summary.total_responsive_records
        self._require(
            findings,
            summary_count == record_count,
            code="record_count_mismatch",
            section="record_index",
            message=(
                "Production summary count does not match the responsive record index "
                f"({summary_count} summary vs. {record_count} indexed)."
            ),
        )
        if record_count:
            self._require(
                findings,
                package.production_summary.start_date is not None
                and package.production_summary.end_date is not None,
                code="missing_production_period",
                section="production_summary",
                message="Responsive-record package is missing the produced date range.",
            )
            self._require(
                findings,
                bool(package.field_definitions),
                code="missing_field_definitions",
                section="field_definitions",
                message="Responsive-record package is missing field definitions.",
                severity="warning",
            )

        custody = package.chain_of_custody
        self._require(
            findings,
            custody.collection_date is not None
            and bool(custody.collection_method)
            and bool(custody.collected_by)
            and bool(custody.review_status),
            code="chain_of_custody_incomplete",
            section="chain_of_custody",
            message="Chain-of-custody section is incomplete.",
        )

        certification = package.certification
        self._require(
            findings,
            bool(certification.authorized_representative)
            and bool(certification.title)
            and bool(certification.certification_text),
            code="certification_incomplete",
            section="certification",
            message="Certification section is missing a representative, title, or text.",
        )
        return findings

    def package_sections(self, package: ProductionPackage) -> dict[str, str]:
        """Flatten the package into the TextDraft section map."""
        agency = package.requesting_agency
        identifiers = ", ".join(
            f"{identifier.type.value}={identifier.value}"
            for identifier in package.subject_identifiers
        )
        summary = package.production_summary
        return {
            "header": self._rules["header_template"].format(
                production_id=package.production_id,
                legal_request_id=package.request_id,
                date_produced=package.date_produced,
            ),
            "requesting_agency": agency.agency if agency else "Unknown agency",
            "subject_identifiers": identifiers or "None extracted",
            "production_summary": (
                f"Period {summary.start_date} to {summary.end_date}; "
                f"{summary.total_responsive_records} responsive record(s). "
                f"{summary.ordinary_course_statement}"
            ),
            "record_index": (
                f"{summary.total_responsive_records} synthetic record(s): "
                + (
                    ", ".join(record.record_id for record in package.records)
                    or "none"
                )
            ),
            "field_definitions": "; ".join(
                f"{definition.name}: {definition.definition}"
                for definition in package.field_definitions
            )
            or "Not applicable (no responsive records).",
            "chain_of_custody": (
                f"Collected {package.chain_of_custody.collection_date} via "
                f"{package.chain_of_custody.collection_method} by "
                f"{package.chain_of_custody.collected_by}. Status: "
                f"{package.chain_of_custody.review_status}."
            ),
            "certification": package.certification.certification_text or "",
        }

    def deficiency_response_sections(
        self, request: LegalRequest, findings: list[DeficiencyFinding]
    ) -> dict[str, str]:
        sections = {
            "header": (
                f"DRAFT deficiency response for {request.legal_request_id} "
                "— pending human approval. SYNTHETIC DATA."
            ),
            "summary": self._rules["deficiency_response_template"],
        }
        for index, finding in enumerate(findings, start=1):
            resolution = finding.suggested_resolution or "Review with the requesting agency."
            sections[f"deficiency_{index}"] = (
                f"{finding.code.value} ({finding.severity.value}): {finding.message} "
                f"Suggested resolution: {resolution}"
            )
        return sections

    def sme_notification_sections(
        self, request: LegalRequest, classification: ClassificationResult
    ) -> dict[str, str]:
        return {
            "header": (
                f"DRAFT SME notification for {request.legal_request_id} "
                "— pending human approval. SYNTHETIC DATA."
            ),
            "summary": self._rules["sme_notification_template"],
            "review_reasons": ", ".join(
                reason.value for reason in classification.review_reasons
            )
            or "none recorded",
            "requested_action": (
                f"Assign to {classification.recommended_queue or 'SME Review'} for "
                "subject-matter-expert review and routing confirmation."
            ),
        }

    @staticmethod
    def _is_location_request(request: LegalRequest) -> bool:
        return any(
            category.content_type == "location"
            for category in request.requested_data_categories
        ) or "Maps / Location" in request.product_domains

    @staticmethod
    def _require(
        findings: list[PackageValidationFinding],
        condition: bool,
        *,
        code: str,
        section: str,
        message: str,
        severity: Literal["blocking", "warning"] = "blocking",
    ) -> None:
        if not condition:
            findings.append(
                PackageValidationFinding(
                    code=code,
                    severity=severity,
                    section=section,
                    message=message,
                )
            )
