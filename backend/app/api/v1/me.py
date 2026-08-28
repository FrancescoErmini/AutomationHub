from fastapi import APIRouter
from pydantic import BaseModel

from app.dependencies import CurrentUser

router = APIRouter(tags=["me"])


class MeRead(BaseModel):
    email: str | None
    preferred_username: str | None
    name: str | None
    role: str


@router.get("/me", response_model=MeRead)
def read_me(user: CurrentUser) -> MeRead:
    return MeRead(
        email=user.email,
        preferred_username=user.preferred_username,
        name=user.name,
        role=user.role,
    )
