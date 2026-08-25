from fastapi import APIRouter, Query

from app.dependencies import ExecutiveServiceDependency
from app.schemas.analytics import CompanySummaryRow, ExecutiveTrends, TcoTrendPoint, TrendPoint
from app.schemas.metrics import MetricValue

router = APIRouter(prefix="/executive", tags=["executive"])


@router.get("/kpis", response_model=dict[str, MetricValue])
def get_kpis(
    service: ExecutiveServiceDependency, company: str | None = Query(default=None)
) -> dict[str, MetricValue]:
    return service.kpis(company=company)


@router.get("/trends", response_model=ExecutiveTrends)
def get_trends(service: ExecutiveServiceDependency) -> ExecutiveTrends:
    trends = service.trends()
    return ExecutiveTrends(
        saving_by_month=[TrendPoint(**point) for point in trends["saving_by_month"]],
        tickets_by_month=[TrendPoint(**point) for point in trends["tickets_by_month"]],
    )


@router.get("/company-summary", response_model=list[CompanySummaryRow])
def get_company_summary(service: ExecutiveServiceDependency) -> list[CompanySummaryRow]:
    return [CompanySummaryRow(**row) for row in service.company_summary()]


@router.get("/cost-breakdown", response_model=list[MetricValue])
def get_cost_breakdown(service: ExecutiveServiceDependency) -> list[MetricValue]:
    return service.cost_breakdown()


@router.get("/tco-trend", response_model=list[TcoTrendPoint])
def get_tco_trend(service: ExecutiveServiceDependency) -> list[TcoTrendPoint]:
    return [TcoTrendPoint(**row) for row in service.tco_trend()]
