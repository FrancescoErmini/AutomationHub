from pydantic import BaseModel


class PersonRead(BaseModel):
    id: int
    email: str
    name: str | None
