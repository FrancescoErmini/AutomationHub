from datetime import date

from fastapi import APIRouter, Query

from app.dependencies import SimpleOpsServiceDependency
from app.schemas.metrics import MetricValue
from app.schemas.simple_ops import (
    AmsTrend,
    HeatmapRow,
    Infrastructure,
    LicenseCostTrendPoint,
    ProcessCostRow,
    QualityBreakdown,
    RunningCostTrendPoint,
    SlaAttainment,
    SlaCard,
    SlaCommitmentRow,
)

router = APIRouter(prefix="/simple-ops", tags=["simple-ops"])


def _resolve_year(year: int | None) -> int:
    return year if year is not None else date.today().year


@router.get("/kpis", response_model=dict[str, MetricValue])
def get_kpis(
    service: SimpleOpsServiceDependency,
    year: int | None = Query(default=None),
    as_of: date | None = Query(default=None),
) -> dict[str, MetricValue]:
    return service.header_kpis(_resolve_year(year), as_of=as_of)


@router.get("/running-cost-trend", response_model=list[RunningCostTrendPoint])
def get_running_cost_trend(service: SimpleOpsServiceDependency) -> list[RunningCostTrendPoint]:
    return [RunningCostTrendPoint(**row) for row in service.running_cost_trend()]


@router.get("/license-cost-trend", response_model=list[LicenseCostTrendPoint])
def get_license_cost_trend(service: SimpleOpsServiceDependency) -> list[LicenseCostTrendPoint]:
    return [LicenseCostTrendPoint(**row) for row in service.license_cost_trend()]


@router.get("/infrastructure", response_model=Infrastructure)
def get_infrastructure(service: SimpleOpsServiceDependency) -> Infrastructure:
    return Infrastructure(**service.infrastructure())


@router.get("/occupancy-heatmap", response_model=list[HeatmapRow])
def get_occupancy_heatmap(service: SimpleOpsServiceDependency) -> list[HeatmapRow]:
    return [HeatmapRow(**row) for row in service.occupancy_heatmap()]


@router.get("/ams-trend", response_model=AmsTrend)
def get_ams_trend(service: SimpleOpsServiceDependency) -> AmsTrend:
    return AmsTrend(**service.ams_trend())


@router.get("/sla-kpis", response_model=list[SlaCard])
def get_sla_kpis(
    service: SimpleOpsServiceDependency,
    year: int | None = Query(default=None),
    as_of: date | None = Query(default=None),
) -> list[SlaCard]:
    return [SlaCard(**card) for card in service.sla_kpis(_resolve_year(year), as_of=as_of)]


@router.get("/sla-commitments", response_model=list[SlaCommitmentRow])
def get_sla_commitments(service: SimpleOpsServiceDependency) -> list[SlaCommitmentRow]:
    return [SlaCommitmentRow(**row) for row in service.sla_commitments()]


@router.get("/sla-attainment", response_model=SlaAttainment)
def get_sla_attainment(
    service: SimpleOpsServiceDependency,
    year: int | None = Query(default=None),
    as_of: date | None = Query(default=None),
) -> SlaAttainment:
    return SlaAttainment(**service.sla_attainment(_resolve_year(year), as_of=as_of))


@router.get("/quality-breakdown", response_model=QualityBreakdown)
def get_quality_breakdown(
    service: SimpleOpsServiceDependency, year: int | None = Query(default=None)
) -> QualityBreakdown:
    return QualityBreakdown(**service.quality_breakdown(_resolve_year(year)))


@router.get("/cost-breakdown-by-process", response_model=list[ProcessCostRow])
def get_cost_breakdown_by_process(
    service: SimpleOpsServiceDependency, year: int | None = Query(default=None)
) -> list[ProcessCostRow]:
    return [
        ProcessCostRow(**row) for row in service.cost_breakdown_by_process(_resolve_year(year))
    ]
