from fastapi import APIRouter, status

from app.dependencies import AmsYearServiceDependency
from app.schemas.ams_year import AmsYearCreate, AmsYearRead, AmsYearUpdate

router = APIRouter(prefix="/ams-years", tags=["ams-years"])


@router.get("", response_model=list[AmsYearRead])
def list_ams_years(service: AmsYearServiceDependency) -> list[AmsYearRead]:
    return [AmsYearRead(**row) for row in service.list_years()]


@router.post("", response_model=AmsYearRead, status_code=status.HTTP_201_CREATED)
def create_ams_year(payload: AmsYearCreate, service: AmsYearServiceDependency) -> AmsYearRead:
    return AmsYearRead(**service.create(payload))


@router.patch("/{year_id}", response_model=AmsYearRead)
def update_ams_year(
    year_id: int,
    payload: AmsYearUpdate,
    service: AmsYearServiceDependency,
) -> AmsYearRead:
    return AmsYearRead(**service.update(year_id, payload))


@router.delete("/{year_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ams_year(year_id: int, service: AmsYearServiceDependency) -> None:
    service.delete(year_id)
