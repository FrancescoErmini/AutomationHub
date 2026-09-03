from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class TicketRead(BaseModel):
    id: int
    ticket_id: str
    ticket_type: str
    priority_id: int | None
    priority_value: str | None
    process_id: int | None
    process_name: str | None
    requestor: str | None
    start_date: date | None
    end_date: date | None
    root_cause_id: int | None
    root_cause_name: str | None
    is_1l: bool
    support_level_id: int | None
    support_level_code: str | None
    company_id: int | None
    company_name: str | None
    ams_year_id: int | None
    ams_year_code: str | None
    note: str | None
    created_at: datetime
    is_open: bool


class TicketUpdate(BaseModel):
    """Full replace of the editable fields -- the frontend always submits the
    whole row when saving an edit (mirrors ProcessEconomicsUpdate)."""

    ticket_id: str = Field(min_length=1, max_length=60)
    ticket_type: str = Field(min_length=1, max_length=60)
    priority_id: int | None = None
    process_id: int | None = None
    requestor: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    root_cause_id: int | None = None
    is_1l: bool
    support_level_id: int | None = None
    company_id: int | None = None
    ams_year_id: int | None = None
    note: str | None = None

    @field_validator("requestor", "note", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        return value


class TicketCreate(TicketUpdate):
    """New-ticket payload -- same editable fields as an update."""


class TicketRefOption(BaseModel):
    id: int
    label: str


class TicketOptions(BaseModel):
    priorities: list[TicketRefOption]
    processes: list[TicketRefOption]
    root_causes: list[TicketRefOption]
    support_levels: list[TicketRefOption]
    companies: list[TicketRefOption]
    ams_years: list[TicketRefOption]
    ticket_types: list[str]
