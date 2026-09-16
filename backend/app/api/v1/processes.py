from fastapi import APIRouter, status

from app.dependencies import ProcessServiceDependency
from app.schemas.process import ProcessCreate, ProcessOptions, ProcessRead, ProcessUpdate
from app.schemas.process_stakeholder import ProcessStakeholderCreate, ProcessStakeholderRead

router = APIRouter(prefix="/processes", tags=["processes"])


@router.get("", response_model=list[ProcessRead])
def list_processes(service: ProcessServiceDependency) -> list[ProcessRead]:
    return [ProcessRead(**row) for row in service.list_processes()]


@router.get("/options", response_model=ProcessOptions)
def process_options(service: ProcessServiceDependency) -> ProcessOptions:
    return ProcessOptions(**service.get_options())


@router.post("", response_model=ProcessRead, status_code=status.HTTP_201_CREATED)
def create_process(payload: ProcessCreate, service: ProcessServiceDependency) -> ProcessRead:
    return ProcessRead(**service.create(payload))


@router.patch("/{process_id}", response_model=ProcessRead)
def update_process(
    process_id: int,
    payload: ProcessUpdate,
    service: ProcessServiceDependency,
) -> ProcessRead:
    return ProcessRead(**service.update(process_id, payload))


@router.delete("/{process_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_process(process_id: int, service: ProcessServiceDependency) -> None:
    service.delete(process_id)


@router.post(
    "/{process_id}/stakeholders",
    response_model=ProcessStakeholderRead,
    status_code=status.HTTP_201_CREATED,
)
def add_process_stakeholder(
    process_id: int,
    payload: ProcessStakeholderCreate,
    service: ProcessServiceDependency,
) -> ProcessStakeholderRead:
    return ProcessStakeholderRead(**service.add_stakeholder(process_id, payload))


@router.delete(
    "/{process_id}/stakeholders/{stakeholder_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_process_stakeholder(
    process_id: int,
    stakeholder_id: int,
    service: ProcessServiceDependency,
) -> None:
    service.remove_stakeholder(process_id, stakeholder_id)
