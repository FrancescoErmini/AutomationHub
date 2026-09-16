from fastapi import APIRouter

from app.api.v1 import (
    ams_years,
    apqc,
    executive,
    ideas,
    me,
    metadata,
    operations,
    people,
    process_catalog,
    process_economics,
    processes,
    service_performance,
    simple_ops,
    tco_costs,
    tickets,
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
router.include_router(tickets.router)
router.include_router(ams_years.router)
router.include_router(processes.router)
router.include_router(tco_costs.router)
router.include_router(people.router)


@router.get("/status")
def get_status() -> dict[str, str]:
    return {"status": "operational", "version": "v1"}
