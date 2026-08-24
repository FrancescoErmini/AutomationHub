from fastapi import APIRouter

from app.dependencies import ApqcServiceDependency
from app.schemas.apqc import ApqcCategoryRead, ApqcProcessGroupRead, ApqcProcessRead

router = APIRouter(prefix="/apqc", tags=["apqc"])


@router.get("/categories", response_model=list[ApqcCategoryRead])
def list_categories(service: ApqcServiceDependency) -> list[ApqcCategoryRead]:
    return [ApqcCategoryRead.model_validate(row) for row in service.list_categories()]


@router.get("/process-groups", response_model=list[ApqcProcessGroupRead])
def list_process_groups(
    category_id: int, service: ApqcServiceDependency
) -> list[ApqcProcessGroupRead]:
    return [
        ApqcProcessGroupRead.model_validate(row) for row in service.list_process_groups(category_id)
    ]


@router.get("/processes", response_model=list[ApqcProcessRead])
def list_processes(process_group_id: int, service: ApqcServiceDependency) -> list[ApqcProcessRead]:
    return [ApqcProcessRead.model_validate(row) for row in service.list_processes(process_group_id)]
