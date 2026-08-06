from pathlib import Path

from app.ingestion.csv_reader import read_csv
from app.ingestion.validation import DatasetValidator


def test_example_csv_meets_contract() -> None:
    source = Path("data/fixtures/items.csv")
    columns, rows = read_csv(source)
    report = DatasetValidator(
        required_columns={"name", "description"},
        unique_columns={"name"},
        non_null_columns={"name"},
    ).validate(source, columns, rows)

    assert report.valid
    assert report.row_count == 2

