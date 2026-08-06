from pathlib import Path

from app.ingestion.validation import DatasetValidator


def test_validator_reports_reusable_quality_rules() -> None:
    validator = DatasetValidator(
        required_columns={"name", "priority", "quantity"},
        unique_columns={"name"},
        non_null_columns={"name"},
        allowed_values={"priority": {"low", "high"}},
        column_types={"quantity": int},
        min_rows=2,
    )
    rows: list[dict[str, str | None]] = [
        {"name": "same", "priority": "urgent", "quantity": "many"},
        {"name": "same", "priority": "low", "quantity": "2"},
    ]

    report = validator.validate(Path("input.csv"), ["name", "priority", "quantity"], rows)

    assert not report.valid
    assert {issue.rule for issue in report.issues} == {
        "duplicate_detection",
        "invalid_value",
        "unexpected_type",
    }
