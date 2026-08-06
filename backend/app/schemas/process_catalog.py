from pydantic import BaseModel


class ProcessCatalogItem(BaseModel):
    title: str
    department: str
    description: str | None
    status: str | None
    is_live: bool
