from pydantic import BaseModel, Field


class AmsYearRead(BaseModel):
    id: int
    code: str
    ordinal: int
    year: int | None


class AmsYearUpdate(BaseModel):
    """Full replace of the editable fields -- the frontend always submits the
    whole row when saving an edit (mirrors TicketUpdate)."""

    code: str = Field(min_length=1, max_length=10)
    ordinal: int
    year: int | None = None


class AmsYearCreate(AmsYearUpdate):
    """New-year payload -- same editable fields as an update."""
