import argparse
from pathlib import Path

from app.db.session import SessionLocal
from app.ingestion.apqc_loader import load_apqc_taxonomy_from_workbook
from app.ingestion.items import ingest_items_csv
from app.ingestion.rpa_pipeline import run_rpa_ingestion
from app.repositories.items import ItemRepository
from app.schemas.item import ItemCreate
from app.services.items import ItemService


def seed() -> None:
    with SessionLocal() as session:
        service = ItemService(ItemRepository(session))
        if not service.list_items():
            service.create_item(
                ItemCreate(
                    name="Welcome item",
                    description="A deterministic development seed record",
                )
            )
            print("Seeded 1 item")
        else:
            print("Seed skipped: items already exist")


def ingest(path: Path, report_dir: Path) -> None:
    with SessionLocal() as session:
        count, report, output = ingest_items_csv(path, report_dir, session)
    print(f"Imported {count} rows; valid={report.valid}; report={output}")


def ingest_rpa(path: Path) -> None:
    with SessionLocal() as session:
        summary = run_rpa_ingestion(session, path)
    print(
        f"Batch {summary.staging.batch_id}: staged {summary.staging.total_rows} rows "
        f"(valid={summary.staging.valid_rows}, rejected={summary.staging.rejected_rows})"
    )
    print("Core row counts:", summary.core.counts)
    for check in summary.relationships:
        flag = "BELOW THRESHOLD" if check.below_threshold else "ok"
        print(
            f"  {check.relationship_name}: {check.matched_rows}/{check.total_rows} matched "
            f"({check.match_pct}%, threshold {check.threshold_pct}%) [{flag}]"
        )


def ingest_apqc(path: Path) -> None:
    with SessionLocal() as session:
        summary = load_apqc_taxonomy_from_workbook(session, path)
    print(
        f"APQC taxonomy: categories={summary.categories}, "
        f"process_groups={summary.process_groups}, processes={summary.processes}, "
        f"skipped(level 4/5)={summary.skipped}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Automation Hub data commands")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("seed", help="Seed deterministic development records")
    ingest_parser = subparsers.add_parser("ingest", help="Validate and ingest an items CSV")
    ingest_parser.add_argument("path", type=Path)
    ingest_parser.add_argument("--report-dir", type=Path, default=Path("artifacts/data-quality"))
    ingest_rpa_parser = subparsers.add_parser(
        "ingest-rpa", help="Validate and ingest the RPA analytics workbook"
    )
    ingest_rpa_parser.add_argument("--path", type=Path, default=Path("../data/raw/RPA - o365.xlsx"))
    ingest_apqc_parser = subparsers.add_parser(
        "ingest-apqc", help="Validate and ingest the APQC taxonomy workbook"
    )
    ingest_apqc_parser.add_argument(
        "--path",
        type=Path,
        default=Path("../data/raw/K07122_Life_Sciences_v722_vsLife_Sciences_v721_2025.xlsx"),
    )
    args = parser.parse_args()

    if args.command == "seed":
        seed()
    elif args.command == "ingest":
        ingest(args.path, args.report_dir)
    elif args.command == "ingest-rpa":
        ingest_rpa(args.path)
    else:
        ingest_apqc(args.path)


if __name__ == "__main__":
    main()
