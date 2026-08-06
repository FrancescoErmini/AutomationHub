from datetime import date

from fastapi import APIRouter, Query

from app.dependencies import ServicePerformanceServiceDependency
from app.schemas.analytics import AvgResolutionRow, ResolutionBreakdown, TrendPoint
from app.schemas.metrics import MetricValue

router = APIRouter(prefix="/service-performance", tags=["service-performance"])


@router.get("/kpis", response_model=dict[str, MetricValue])
def get_kpis(
    service: ServicePerformanceServiceDependency, as_of: date | None = Query(default=None)
) -> dict[str, MetricValue]:
    return service.kpis(as_of=as_of)


@router.get("/sla-trend", response_model=list[TrendPoint])
def get_sla_trend(service: ServicePerformanceServiceDependency) -> list[TrendPoint]:
    return [TrendPoint(**row) for row in service.sla_trend()]


@router.get("/resolution", response_model=ResolutionBreakdown)
def get_resolution(service: ServicePerformanceServiceDependency) -> ResolutionBreakdown:
    return ResolutionBreakdown(
        by_root_cause=[AvgResolutionRow(**row) for row in service.avg_resolution_by_root_cause()],
        by_process=[AvgResolutionRow(**row) for row in service.avg_resolution_by_process()],
        by_company=[AvgResolutionRow(**row) for row in service.avg_resolution_by_company()],
    )


@router.get("/data-quality", response_model=list[MetricValue])
def get_data_quality(service: ServicePerformanceServiceDependency) -> list[MetricValue]:
    return service.data_quality_summary()
