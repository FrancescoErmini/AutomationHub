from pydantic import BaseModel


class TcoCostImportRowReport(BaseModel):
    line: int
    description: str | None
    action: str  # "inserted" | "skipped"
    errors: list[str]


class TcoCostImportReport(BaseModel):
    committed: bool
    total_rows: int
    inserted: int
    updated: int
    skipped: int
    rows: list[TcoCostImportRowReport]  # only skipped rows are listed
