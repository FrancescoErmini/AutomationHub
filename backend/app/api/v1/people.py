from fastapi import APIRouter, Query

from app.dependencies import PersonServiceDependency
from app.schemas.person import PersonRead

router = APIRouter(prefix="/people", tags=["people"])


@router.get("", response_model=list[PersonRead])
def search_people(
    service: PersonServiceDependency,
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> list[PersonRead]:
    return [PersonRead(**row) for row in service.search(q, limit)]
