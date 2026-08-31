from fastapi import APIRouter

from app.api.v1 import (
    apqc,
    executive,
    ideas,
    me,
    metadata,
    operations,
    process_catalog,
    process_economics,
    service_performance,
    simple_ops,
)

router = APIRouter(prefix="/api/v1")
router.include_router(metadata.router)
router.include_router(executive.router)
router.include_router(operations.router)
router.include_router(service_performance.router)
router.include_router(process_catalog.router)
router.include_router(process_economics.router)
router.include_router(simple_ops.router)
router.include_router(apqc.router)
router.include_router(ideas.router)
router.include_router(me.router)


@router.get("/status")
def get_status() -> dict[str, str]:
    return {"status": "operational", "version": "v1"}
