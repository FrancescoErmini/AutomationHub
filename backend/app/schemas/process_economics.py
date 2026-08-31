from decimal import Decimal

from pydantic import BaseModel, Field

# ``roi_expected_yr`` stays an integer column; the frontend offers 1 / 2 / 3 / 5
# as a dropdown but the API accepts any non-negative integer.


class ProcessOption(BaseModel):
    """A selectable process for the "add row" dropdown. ``has_economics`` flags
    processes that already own a row (``process_id`` is unique)."""

    id: int
    canonical_name: str
    has_economics: bool


class ProcessEconomicsRead(BaseModel):
    id: int
    process_id: int
    process_name: str
    capex_eur: float
    roi_expected_yr: int | None
    fte_hours_month_actual: float
    extra_annual_saving_eur: float
    note: str | None


class ProcessEconomicsCreate(BaseModel):
    process_id: int
    capex_eur: Decimal = Field(ge=0)
    roi_expected_yr: int | None = Field(default=None, ge=0)
    fte_hours_month_actual: Decimal = Field(ge=0)
    extra_annual_saving_eur: Decimal = Field(default=Decimal("0"), ge=0)
    note: str | None = None


class ProcessEconomicsUpdate(BaseModel):
    """Full replace of the editable fields — the frontend always submits the
    whole row when saving an edit."""

    capex_eur: Decimal = Field(ge=0)
    roi_expected_yr: int | None = Field(default=None, ge=0)
    fte_hours_month_actual: Decimal = Field(ge=0)
    extra_annual_saving_eur: Decimal = Field(ge=0)
    note: str | None = None
