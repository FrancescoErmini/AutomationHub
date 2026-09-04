from pydantic import BaseModel


class TicketImportRowReport(BaseModel):
    line: int
    ticket_id: str | None
    action: str  # "inserted" | "updated" | "skipped"
    errors: list[str]


class TicketImportReport(BaseModel):
    committed: bool
    total_rows: int
    inserted: int
    updated: int
    skipped: int
    rows: list[TicketImportRowReport]  # only skipped rows are listed
