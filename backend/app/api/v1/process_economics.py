from fastapi import APIRouter, status

# TODO: temporary — restore the RequireEditor dependency on the write endpoints
# below (add `_user: RequireEditor` and re-import it from app.dependencies).
from app.dependencies import ProcessEconomicsServiceDependency
from app.schemas.process_economics import (
    ProcessEconomicsCreate,
    ProcessEconomicsRead,
    ProcessEconomicsUpdate,
    ProcessOption,
)

router = APIRouter(prefix="/process-economics", tags=["process-economics"])


@router.get("", response_model=list[ProcessEconomicsRead])
def list_process_economics(
    service: ProcessEconomicsServiceDependency,
) -> list[ProcessEconomicsRead]:
    return [ProcessEconomicsRead(**row) for row in service.list_rows()]


@router.get("/process-options", response_model=list[ProcessOption])
def list_process_options(
    service: ProcessEconomicsServiceDependency,
) -> list[ProcessOption]:
    return [ProcessOption(**row) for row in service.process_options()]


@router.post("", response_model=ProcessEconomicsRead, status_code=status.HTTP_201_CREATED)
def create_process_economics(
    payload: ProcessEconomicsCreate,
    service: ProcessEconomicsServiceDependency,
) -> ProcessEconomicsRead:
    return ProcessEconomicsRead(**service.create(payload))


@router.patch("/{econ_id}", response_model=ProcessEconomicsRead)
def update_process_economics(
    econ_id: int,
    payload: ProcessEconomicsUpdate,
    service: ProcessEconomicsServiceDependency,
) -> ProcessEconomicsRead:
    return ProcessEconomicsRead(**service.update(econ_id, payload))


@router.delete("/{econ_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_process_economics(
    econ_id: int,
    service: ProcessEconomicsServiceDependency,
) -> None:
    service.delete(econ_id)
