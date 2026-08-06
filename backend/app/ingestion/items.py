from pathlib import Path

from sqlalchemy.orm import Session

from app.core.exceptions import DataValidationError, DuplicateItemError
from app.ingestion.csv_reader import read_csv
from app.ingestion.reporting import write_report
from app.ingestion.validation import DataQualityReport, DatasetValidator
from app.repositories.items import ItemRepository
from app.schemas.item import ItemCreate
from app.services.items import ItemService


def ingest_items_csv(
    path: Path, report_dir: Path, session: Session
) -> tuple[int, DataQualityReport, Path]:
    columns, rows = read_csv(path)
    validator = DatasetValidator(
        required_columns={"name", "description"},
        unique_columns={"name"},
        non_null_columns={"name"},
        min_rows=1,
    )
    report = validator.validate(path, columns, rows)
    report_path = write_report(report, report_dir)
    if not report.valid:
        raise DataValidationError(f"CSV validation failed; see {report_path}")

    service = ItemService(ItemRepository(session))
    imported = 0
    for row in rows:
        try:
            service.create_item(
                ItemCreate(name=row["name"] or "", description=row.get("description"))
            )
            imported += 1
        except DuplicateItemError:
            continue
    return imported, report, report_path
