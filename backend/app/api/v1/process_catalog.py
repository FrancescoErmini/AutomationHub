from fastapi import APIRouter

from app.dependencies import ProcessCatalogServiceDependency
from app.schemas.process_catalog import ProcessCatalogItem

router = APIRouter(prefix="/process-catalog", tags=["process-catalog"])


@router.get("", response_model=list[ProcessCatalogItem])
def list_process_catalog(service: ProcessCatalogServiceDependency) -> list[ProcessCatalogItem]:
    return [ProcessCatalogItem(**row) for row in service.list_items()]
