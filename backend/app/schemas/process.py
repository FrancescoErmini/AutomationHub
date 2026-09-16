from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.schemas.process_stakeholder import ProcessStakeholderRead


class ProcessRead(BaseModel):
    id: int
    canonical_name: str
    description: str | None
    documentation_url: str | None
    department_id: int | None
    department_name: str | None
    company_id: int | None
    company_name: str | None
    ams_year_id: int | None
    ams_year_code: str | None
    process_type_id: int | None
    process_type_name: str | None
    status: str | None
    go_live_date: date | None
    in_pipeline: bool
    stakeholders: list[ProcessStakeholderRead]


class ProcessUpdate(BaseModel):
    """Full replace of the editable fields -- the frontend always submits the
    whole row when saving an edit (mirrors TicketUpdate)."""

    canonical_name: str = Field(min_length=1, max_length=300)
    description: str | None = None
    documentation_url: str | None = Field(default=None, max_length=1000)
    department_id: int | None = None
    company_id: int | None = None
    ams_year_id: int | None = None
    process_type_id: int | None = None
    status: str | None = Field(default=None, max_length=60)
    go_live_date: date | None = None
    in_pipeline: bool = False

    @field_validator("description", "documentation_url", "status", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        return value


class ProcessCreate(ProcessUpdate):
    """New-process payload -- same editable fields as an update."""


class ProcessRefOption(BaseModel):
    id: int
    label: str


class ProcessOptions(BaseModel):
    companies: list[ProcessRefOption]
    departments: list[ProcessRefOption]
    ams_years: list[ProcessRefOption]
    process_types: list[ProcessRefOption]
    roles: list[str]
