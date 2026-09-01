from pydantic import BaseModel


class RunningCostTrendPoint(BaseModel):
    year: int
    license_eur: float
    infrastructure_eur: float
    ams_1l_eur: float
    ticket_2l_eur: float
    change_request_eur: float
    total_eur: float


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


class SlaCommitmentRow(BaseModel):
    ticket_type: str
    provider_priority: str
    einstein_label: str
    reaction_hours: int
    repair_hours: int


class SlaResolvedTarget(BaseModel):
    ticket_type: str
    band: str
    reaction_hours: int
    repair_hours: int
    target_days: int


class SlaAttainmentGroup(BaseModel):
    key: str
    closed: int
    within_target: int
    breached: int
    attainment_pct: float | None


class SlaAttainmentMonth(BaseModel):
    period: str
    closed: int
    within_target: int
    attainment_pct: float | None


class SlaAttainmentOpenTicket(BaseModel):
    ticket_id: str
    ticket_type: str
    band: str
    process: str | None
    age_days: int
    target_days: int


class SlaAttainment(BaseModel):
    headline_pct: float | None
    status: str
    closed: int
    within_target: int
    breached: int
    open_over_target_count: int
    observed_priorities: list[str]
    observed_bands: list[str]
    targets: list[SlaResolvedTarget]
    by_type: list[SlaAttainmentGroup]
    by_band: list[SlaAttainmentGroup]
    by_month: list[SlaAttainmentMonth]
    open_over_target: list[SlaAttainmentOpenTicket]
    caveat: str


class ProcessCostRow(BaseModel):
    process: str
    license_eur: float
    infrastructure_eur: float
    ams_1l_eur: float
    l2_eur: float
    total_eur: float
