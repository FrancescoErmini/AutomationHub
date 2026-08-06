from fastapi import APIRouter, Query

from app.dependencies import RoiServiceDependency
from app.schemas.analytics import RoiCompanyRow, RoiProcessRow
from app.schemas.metrics import MetricValue

router = APIRouter(prefix="/roi", tags=["roi"])


@router.get("/kpis", response_model=dict[str, MetricValue])
def get_kpis(service: RoiServiceDependency) -> dict[str, MetricValue]:
    return service.kpis()


@router.get("/processes", response_model=list[RoiProcessRow])
def get_processes(service: RoiServiceDependency) -> list[RoiProcessRow]:
    return [RoiProcessRow(**row) for row in service.process_summary()]


@router.get("/companies", response_model=list[RoiCompanyRow])
def get_companies(service: RoiServiceDependency) -> list[RoiCompanyRow]:
    return [RoiCompanyRow(**row) for row in service.company_summary()]


@router.get("/quick-wins", response_model=list[RoiProcessRow])
def get_quick_wins(
    service: RoiServiceDependency, limit: int = Query(default=5, ge=1, le=50)
) -> list[RoiProcessRow]:
    return [RoiProcessRow(**row) for row in service.quick_wins(limit)]


@router.get("/cost-stack", response_model=list[MetricValue])
def get_cost_stack(service: RoiServiceDependency) -> list[MetricValue]:
    return service.cost_stack()
