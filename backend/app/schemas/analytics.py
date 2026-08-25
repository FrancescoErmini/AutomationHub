from pydantic import BaseModel


class TrendPoint(BaseModel):
    period: str
    value: float


class L1L2TrendPoint(BaseModel):
    period: str
    l1: int
    l2: int


class CompanySummaryRow(BaseModel):
    company: str
    annual_saving_eur: float
    capex_eur: float
    total_tickets: int
    roi_1_5y_pct: float | None


class RootCauseParetoRow(BaseModel):
    root_cause: str
    count: int


class TopProcessRow(BaseModel):
    process: str
    ticket_count: int


class BacklogAging(BaseModel):
    backlog_0_3_days: int
    backlog_4_7_days: int
    backlog_8_15_days: int
    backlog_over_15_days: int


class RoiProcessRow(BaseModel):
    process: str
    company: str | None
    capex_eur: float
    annual_saving_eur: float
    payback_months: float | None
    roi_1_5y_pct: float | None
    process_tco_available: bool


class RoiCompanyRow(BaseModel):
    company: str
    annual_saving_eur: float
    capex_eur: float
    roi_1_5y_pct: float | None
    payback_months: float | None


class AvgResolutionRow(BaseModel):
    label: str
    avg_days: float


class ResolutionBreakdown(BaseModel):
    by_root_cause: list[AvgResolutionRow]
    by_process: list[AvgResolutionRow]
    by_company: list[AvgResolutionRow]


class ExecutiveTrends(BaseModel):
    saving_by_month: list[TrendPoint]
    tickets_by_month: list[TrendPoint]


class TcoTrendPoint(BaseModel):
    year: int
    capex_eur: float
    license_eur: float
    infrastructure_eur: float
    ams_eur: float
    total_eur: float


class SavingsPaybackPoint(BaseModel):
    year: int
    cumulative_spend_eur: float
    cumulative_saving_eur: float


class FilterOptions(BaseModel):
    companies: list[str]
