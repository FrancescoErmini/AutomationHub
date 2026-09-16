from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

COST_TYPES: frozenset[str] = frozenset({"CAPEX", "OPEX"})


class TcoCostRead(BaseModel):
    id: int
    cost_date: date
    cost_eur: Decimal
    cost_type: str
    subtype: str | None
    description: str | None
    created_at: datetime


class TcoCostUpdate(BaseModel):
    """Full replace of the editable fields -- the frontend always submits the
    whole row when saving an edit (mirrors TicketUpdate)."""

    cost_date: date
    cost_eur: Decimal = Field(ge=0)
    cost_type: str
    subtype: str | None = Field(default=None, max_length=60)
    description: str | None = None

    @field_validator("subtype", "description", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @field_validator("cost_type")
    @classmethod
    def _known_cost_type(cls, value: str) -> str:
        if value not in COST_TYPES:
            raise ValueError(f"unknown cost type: {value!r} (expected CAPEX or OPEX)")
        return value


class TcoCostCreate(TcoCostUpdate):
    """New-cost payload -- same editable fields as an update."""


class TcoCostOptions(BaseModel):
    subtypes: list[str]
