from datetime import UTC, date, datetime

from app.mock_data.seed import MOCK_DATA_DIR
from app.models.certification import Certification
from app.models.chain_of_custody import ChainOfCustody
from app.models.enums import IdentifierType
from app.models.production_package import (
    DataFieldDefinition,
    ProductionPackage,
    ProductionSummary,
)
from app.models.requesting_agency import RequestingAgency
from app.models.responsive_record import ResponsiveRecord
from app.models.subject_identifier import SubjectIdentifier
from app.services.response_package_service import ResponsePackageService


def make_service() -> ResponsePackageService:
    return ResponsePackageService(MOCK_DATA_DIR / "sop" / "response_package_rules.json")


def test_validation_catches_record_count_mismatch_and_incomplete_certification():
    package = ProductionPackage(
        request_id="LER-2026-UNIT",
        production_id="PROD-2026-UNIT-01",
        date_produced=date(2026, 6, 10),
        requesting_agency=RequestingAgency(agency="Synthetic Police Department"),
        subject_identifiers=[
            SubjectIdentifier(type=IdentifierType.ACCOUNT_ID, value="ACC-123")
        ],
        production_summary=ProductionSummary(
            start_date=datetime(2026, 5, 1, tzinfo=UTC),
            end_date=datetime(2026, 5, 2, tzinfo=UTC),
            total_responsive_records=2,
            ordinary_course_statement="Produced in ordinary course.",
        ),
        records=[ResponsiveRecord(record_id="REC-1")],
        field_definitions=[
            DataFieldDefinition(name="timestamp_utc", definition="Synthetic timestamp")
        ],
        chain_of_custody=ChainOfCustody(
            collection_date=date(2026, 6, 10),
            collection_method="synthetic export",
            collected_by="CaseFlow synthetic ETL",
        ),
        certification=Certification(
            authorized_representative=None,
            title="Custodian of Records",
            certification_text="Synthetic certification text.",
        ),
    )

    findings = make_service().validate_package(package)

    by_code = {finding.code: finding for finding in findings}
    assert by_code["record_count_mismatch"].severity == "blocking"
    assert by_code["record_count_mismatch"].section == "record_index"
    assert by_code["certification_incomplete"].severity == "blocking"
    assert by_code["certification_incomplete"].section == "certification"
