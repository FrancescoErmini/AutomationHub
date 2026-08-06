from collections import Counter
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ScalarParser = Callable[[str], object]


@dataclass(frozen=True)
class ValidationIssue:
    rule: str
    message: str
    severity: str = "error"
    row: int | None = None
    column: str | None = None


@dataclass(frozen=True)
class DataQualityReport:
    source: str
    generated_at: str
    row_count: int
    valid: bool
    issues: list[ValidationIssue]

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "generated_at": self.generated_at,
            "row_count": self.row_count,
            "valid": self.valid,
            "summary": {
                "errors": sum(issue.severity == "error" for issue in self.issues),
                "warnings": sum(issue.severity == "warning" for issue in self.issues),
            },
            "issues": [asdict(issue) for issue in self.issues],
        }


class DatasetValidator:
    def __init__(
        self,
        *,
        required_columns: set[str],
        unique_columns: set[str] | None = None,
        non_null_columns: set[str] | None = None,
        allowed_values: dict[str, set[str]] | None = None,
        column_types: dict[str, ScalarParser] | None = None,
        min_rows: int = 1,
        max_rows: int | None = None,
    ) -> None:
        self.required_columns = required_columns
        self.unique_columns = unique_columns or set()
        self.non_null_columns = non_null_columns or set()
        self.allowed_values = allowed_values or {}
        self.column_types = column_types or {}
        self.min_rows = min_rows
        self.max_rows = max_rows

    def validate(
        self, source: Path, columns: list[str], rows: list[dict[str, str | None]]
    ) -> DataQualityReport:
        issues: list[ValidationIssue] = []
        missing = sorted(self.required_columns - set(columns))
        for column in missing:
            issues.append(
                ValidationIssue(
                    "required_columns",
                    f"Required column '{column}' is missing",
                    column=column,
                )
            )

        if len(rows) < self.min_rows:
            issues.append(
                ValidationIssue(
                    "row_count",
                    f"Expected at least {self.min_rows} rows; got {len(rows)}",
                )
            )
        if self.max_rows is not None and len(rows) > self.max_rows:
            issues.append(
                ValidationIssue(
                    "row_count",
                    f"Expected at most {self.max_rows} rows; got {len(rows)}",
                )
            )

        for column in sorted(self.unique_columns & set(columns)):
            populated: list[str] = []
            for row in rows:
                value = row.get(column)
                if value is not None and value != "":
                    populated.append(value)
            duplicates = sorted(value for value, count in Counter(populated).items() if count > 1)
            for value in duplicates:
                issues.append(
                    ValidationIssue(
                        "duplicate_detection",
                        f"Duplicate value '{value}' in '{column}'",
                        column=column,
                    )
                )

        for index, row in enumerate(rows, start=2):
            for column in sorted(self.non_null_columns & set(columns)):
                value = row.get(column)
                if value is None or not value.strip():
                    issues.append(
                        ValidationIssue(
                            "null_detection",
                            f"Column '{column}' must not be empty",
                            row=index,
                            column=column,
                        )
                    )
            for column, allowed in self.allowed_values.items():
                value = row.get(column)
                if value not in (None, "") and value not in allowed:
                    issues.append(
                        ValidationIssue(
                            "invalid_value",
                            f"Value '{value}' is not allowed in '{column}'",
                            row=index,
                            column=column,
                        )
                    )
            for column, parser in self.column_types.items():
                value = row.get(column)
                if value is None or value == "":
                    continue
                try:
                    parser(value)
                except (TypeError, ValueError):
                    issues.append(
                        ValidationIssue(
                            "unexpected_type",
                            f"Value '{value}' has an unexpected type in '{column}'",
                            row=index,
                            column=column,
                        )
                    )

        return DataQualityReport(
            source=str(source),
            generated_at=datetime.now(UTC).isoformat(),
            row_count=len(rows),
            valid=not any(issue.severity == "error" for issue in issues),
            issues=issues,
        )
