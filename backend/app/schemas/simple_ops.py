from pydantic import BaseModel


class RunningCostTrendPoint(BaseModel):
    year: int
    total_eur: float
    estimate: bool


class LicenseCostTrendPoint(BaseModel):
    year: int
    cost_eur: float


class InfrastructureTrendPoint(BaseModel):
    year: int
    cost_eur: float


class Infrastructure(BaseModel):
    trend: list[InfrastructureTrendPoint]
    tbd: bool
    vm_count: int
    db_count: int


class HeatmapCell(BaseModel):
    slot: str
    label: str
    count: int
    intensity: int


class HeatmapRow(BaseModel):
    vm: str
    cells: list[HeatmapCell]


class Ams1LTrendPoint(BaseModel):
    year: int
    cost_eur: float
    process_count: int


class Ams2LTrendPoint(BaseModel):
    year: int
    cost_eur: float
    ticket_count: int


class AmsTrend(BaseModel):
    l1: list[Ams1LTrendPoint]
    l2: list[Ams2LTrendPoint]


class SlaCard(BaseModel):
    key: str
    label: str
    value: float | None
    unit: str
    target_label: str
    status: str
    available: bool


class RootCauseShare(BaseModel):
    label: str
    count: int
    pct: float


class QualityDonut(BaseModel):
    root_causes: list[RootCauseShare]
    total_tickets: int
    service_request_pct: float
    incident_pct: float


class QualityBreakdown(BaseModel):
    l1: QualityDonut
    l2: QualityDonut


class ProcessCostRow(BaseModel):
    process: str
    license_eur: float
    ams_1l_eur: float
    l2_eur: float
    total_eur: float
