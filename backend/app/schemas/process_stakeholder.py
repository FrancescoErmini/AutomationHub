from pydantic import BaseModel, Field, field_validator

# Fixed referent roles, sourced from the RPA pipeline sheet's referent
# columns. "Supplier Developer(s)" is normalized to the singular here --
# the model already allows more than one person per (process, role).
STAKEHOLDER_ROLES: tuple[str, ...] = (
    "ICT Referent",
    "Project Referent",
    "Business Process Owner",
    "Project Business Referent",
    "GAP Referent",
    "Supplier Project Manager",
    "Supplier Developer",
)


class ProcessStakeholderRead(BaseModel):
    id: int
    role: str
    person_id: int
    person_email: str
    person_name: str | None


class ProcessStakeholderCreate(BaseModel):
    role: str
    email: str = Field(min_length=3, max_length=320)
    name: str | None = Field(default=None, max_length=255)

    @field_validator("name", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @field_validator("role")
    @classmethod
    def _known_role(cls, value: str) -> str:
        if value not in STAKEHOLDER_ROLES:
            raise ValueError(f"unknown stakeholder role: {value!r}")
        return value

    @field_validator("email")
    @classmethod
    def _looks_like_email(cls, value: str) -> str:
        cleaned = value.strip()
        if "@" not in cleaned:
            raise ValueError(f"not a valid email: {value!r}")
        return cleaned
