from datetime import date, datetime

from app.models.base import CaseFlowModel
from app.models.certification import Certification
from app.models.chain_of_custody import ChainOfCustody
from app.models.enums import ProductionPackageStatus
from app.models.requesting_agency import RequestingAgency
from app.models.responsive_record import ResponsiveRecord
from app.models.subject_identifier import SubjectIdentifier


class ProductionSummary(CaseFlowModel):
    start_date: datetime | None = None
    end_date: datetime | None = None
    total_responsive_records: int = 0
    ordinary_course_statement: str | None = None


class DataFieldDefinition(CaseFlowModel):
    name: str
    definition: str


class ProductionPackage(CaseFlowModel):
    """Response package draft per the Template LERS Response structure.

    No agent-reachable 'final' status exists; approval is a human-only
    transition enforced by the approval policy in the FastAPI layer.
    """

    schema_version: str = "1.0"
    request_id: str
    production_id: str
    date_produced: date | None = None
    requesting_agency: RequestingAgency | None = None
    subject_identifiers: list[SubjectIdentifier] = []
    production_summary: ProductionSummary = ProductionSummary()
    records: list[ResponsiveRecord] = []
    field_definitions: list[DataFieldDefinition] = []
    chain_of_custody: ChainOfCustody = ChainOfCustody()
    certification: Certification = Certification()
    status: ProductionPackageStatus = ProductionPackageStatus.DRAFT_PENDING_ANALYST_REVIEW
    risk_flags: list[str] = []
    section_provenance: dict[str, str] = {}
