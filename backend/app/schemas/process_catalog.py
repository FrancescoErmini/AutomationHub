from datetime import date

from pydantic import BaseModel


class ProcessCatalogItem(BaseModel):
    title: str
    department: str
    description: str | None
    status: str | None
    is_live: bool
    company: str | None
    go_live_date: date | None
    applications: list[str]
