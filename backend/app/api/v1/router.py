from fastapi import APIRouter, status

from app.api.v1 import (
    admin,
    apqc,
    executive,
    ideas,
    me,
    metadata,
    operations,
    process_catalog,
    service_performance,
    simple_ops,
)
from app.dependencies import ItemServiceDependency
from app.schemas.item import ItemCreate, ItemRead

router = APIRouter(prefix="/api/v1")
router.include_router(metadata.router)
router.include_router(executive.router)
router.include_router(operations.router)
router.include_router(service_performance.router)
router.include_router(process_catalog.router)
router.include_router(simple_ops.router)
router.include_router(apqc.router)
router.include_router(ideas.router)
router.include_router(me.router)
router.include_router(admin.router)


@router.get("/status")
def get_status() -> dict[str, str]:
    return {"status": "operational", "version": "v1"}


@router.get("/items", response_model=list[ItemRead])
def list_items(service: ItemServiceDependency) -> list[ItemRead]:
    return [ItemRead.model_validate(item) for item in service.list_items()]


@router.post("/items", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate, service: ItemServiceDependency) -> ItemRead:
    return ItemRead.model_validate(service.create_item(payload))
