from datetime import date

from fastapi import APIRouter, Query

from app.dependencies import OperationsServiceDependency
from app.schemas.analytics import BacklogAging, L1L2TrendPoint, RootCauseParetoRow, TopProcessRow
from app.schemas.metrics import MetricValue

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get("/kpis", response_model=dict[str, MetricValue])
def get_kpis(
    service: OperationsServiceDependency, company: str | None = Query(default=None)
) -> dict[str, MetricValue]:
    return service.kpis(company=company)


@router.get("/support-level-trend", response_model=list[L1L2TrendPoint])
def get_support_level_trend(service: OperationsServiceDependency) -> list[L1L2TrendPoint]:
    return [L1L2TrendPoint(**row) for row in service.l1_vs_l2_by_month()]


@router.get("/root-cause-pareto", response_model=list[RootCauseParetoRow])
def get_root_cause_pareto(service: OperationsServiceDependency) -> list[RootCauseParetoRow]:
    return [RootCauseParetoRow(**row) for row in service.root_cause_pareto()]


@router.get("/top-processes", response_model=list[TopProcessRow])
def get_top_processes(
    service: OperationsServiceDependency, limit: int = Query(default=10, ge=1, le=50)
) -> list[TopProcessRow]:
    return [TopProcessRow(**row) for row in service.top_processes(limit)]


@router.get("/backlog-aging", response_model=BacklogAging)
def get_backlog_aging(
    service: OperationsServiceDependency, as_of: date | None = Query(default=None)
) -> BacklogAging:
    return BacklogAging(**service.backlog_aging(as_of=as_of))
