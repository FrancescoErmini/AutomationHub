from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status

from app.dependencies import TcoCostImportServiceDependency, TcoCostServiceDependency
from app.schemas.tco_cost import TcoCostCreate, TcoCostOptions, TcoCostRead, TcoCostUpdate
from app.schemas.tco_cost_import import TcoCostImportReport

router = APIRouter(prefix="/tco-costs", tags=["tco-costs"])


@router.get("", response_model=list[TcoCostRead])
def list_tco_costs(service: TcoCostServiceDependency) -> list[TcoCostRead]:
    return [TcoCostRead(**row) for row in service.list_costs()]


@router.get("/options", response_model=TcoCostOptions)
def tco_cost_options(service: TcoCostServiceDependency) -> TcoCostOptions:
    return TcoCostOptions(**service.get_options())


@router.post("/import", response_model=TcoCostImportReport)
async def import_tco_costs(
    service: TcoCostImportServiceDependency,
    file: Annotated[UploadFile, File()],
    commit: Annotated[bool, Form()] = False,
) -> TcoCostImportReport:
    content = await file.read()
    return service.run(content=content, commit=commit)


@router.post("", response_model=TcoCostRead, status_code=status.HTTP_201_CREATED)
def create_tco_cost(payload: TcoCostCreate, service: TcoCostServiceDependency) -> TcoCostRead:
    return TcoCostRead(**service.create(payload))


@router.patch("/{cost_id}", response_model=TcoCostRead)
def update_tco_cost(
    cost_id: int,
    payload: TcoCostUpdate,
    service: TcoCostServiceDependency,
) -> TcoCostRead:
    return TcoCostRead(**service.update(cost_id, payload))


@router.delete("/{cost_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tco_cost(cost_id: int, service: TcoCostServiceDependency) -> None:
    service.delete(cost_id)
