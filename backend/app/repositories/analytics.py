"""Read-only aggregate queries over the core RPA model.

Pure data access: every method returns plain Decimal/int/float/row values,
never a Metric envelope and never a formula-level business decision (e.g.
which components make up "run cost") -- those live in ``app/services``.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Integer, cast, func, literal, select, union
from sqlalchemy.orm import Session, selectinload

from app.models.core import (
    Ams1LCost,
    Ams2LCost,
    AmsRfcCost,
    AmsYear,
    Company,
    Department,
    LicenseCost,
    Process,
    ProcessEconomics,
    ProcessSchedule,
    ReferenceVariable,
    RootCause,
    TcoCost,
    Ticket,
    VirtualMachine,
    VmCost,
)


@dataclass(frozen=True)
class TicketCounts:
    total: int
    closed: int
    open: int
    l1: int
    l2: int


@dataclass(frozen=True)
class ResolutionStats:
    closed_with_dates: int
    within_3_days: int
    avg_days: Decimal | None
    median_days: Decimal | None
    p90_days: Decimal | None


class AnalyticsRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _company_id(self, company: str | None) -> int | None:
        if company is None:
            return None
        return self._session.scalar(select(Company.id).where(Company.name == company))

    def reference_variable(self, name: str) -> Decimal | None:
        return self._session.scalar(
            select(ReferenceVariable.value).where(ReferenceVariable.name == name)
        )

    def total_fte_hours_month(self, *, company: str | None = None) -> Decimal:
        stmt = select(
            func.coalesce(func.sum(ProcessEconomics.fte_hours_month_actual), 0)
        ).select_from(ProcessEconomics)
        if company is not None:
            stmt = (
                stmt.join(Process, Process.id == ProcessEconomics.process_id)
                .join(Company, Company.id == Process.company_id)
                .where(Company.name == company)
            )
        return Decimal(self._session.scalar(stmt) or 0)

    def annual_saving_eur(self, *, company: str | None = None) -> Decimal:
        bc_saving = self.reference_variable("cost_per_hour_FTE")
        if bc_saving is None:
            return Decimal("0")
        return bc_saving * self.total_fte_hours_month(company=company) * 12

    def extra_annual_saving_eur(self, *, company: str | None = None) -> Decimal:
        stmt = select(func.coalesce(func.sum(ProcessEconomics.extra_annual_saving_eur), 0))
        if company is not None:
            stmt = (
                stmt.join(Process, Process.id == ProcessEconomics.process_id)
                .join(Company, Company.id == Process.company_id)
                .where(Company.name == company)
            )
        return Decimal(self._session.scalar(stmt) or 0)

    def capex_eur(self, *, company: str | None = None) -> Decimal:
        stmt = select(func.coalesce(func.sum(ProcessEconomics.capex_eur), 0))
        if company is not None:
            stmt = (
                stmt.join(Process, Process.id == ProcessEconomics.process_id)
                .join(Company, Company.id == Process.company_id)
                .where(Company.name == company)
            )
        return Decimal(self._session.scalar(stmt) or 0)

    def capex_by_year(self, *, company: str | None = None) -> dict[int, Decimal]:
        year = func.extract("year", Process.go_live_date)
        stmt = (
            select(year, func.coalesce(func.sum(ProcessEconomics.capex_eur), 0))
            .select_from(ProcessEconomics)
            .join(Process, Process.id == ProcessEconomics.process_id)
            .where(Process.go_live_date.is_not(None))
            .group_by(year)
        )
        if company is not None:
            stmt = stmt.join(Company, Company.id == Process.company_id).where(
                Company.name == company
            )
        rows = self._session.execute(stmt).tuples().all()
        return {int(yr): Decimal(total) for yr, total in rows}

    def tco_cost_by_year(self) -> dict[int, dict[str, Decimal]]:
        """Portfolio CAPEX/OPEX totals by year, from the data/raw/TCO.csv
        ledger (core.tco_cost) -- source for the TCO & ROI chart."""
        year = func.extract("year", TcoCost.cost_date)
        stmt = (
            select(year, TcoCost.cost_type, func.sum(TcoCost.cost_eur))
            .group_by(year, TcoCost.cost_type)
            .order_by(year)
        )
        rows = self._session.execute(stmt).tuples().all()
        by_year: dict[int, dict[str, Decimal]] = {}
        for yr, cost_type, total in rows:
            by_year.setdefault(int(yr), {"capex": Decimal("0"), "opex": Decimal("0")})
            by_year[int(yr)][cost_type.lower()] = Decimal(total)
        return by_year

    def opex_subtype_by_year(self) -> dict[int, dict[str, Decimal]]:
        """OPEX broken down by subtype (AMS, CR, LICENSES, INFRA, ...) per
        year, from core.tco_cost -- detail rows under the TCO & ROI table."""
        year = func.extract("year", TcoCost.cost_date)
        subtype = func.coalesce(TcoCost.subtype, "OTHER")
        stmt = (
            select(year, subtype, func.sum(TcoCost.cost_eur))
            .where(TcoCost.cost_type == "OPEX")
            .group_by(year, subtype)
            .order_by(year)
        )
        rows = self._session.execute(stmt).tuples().all()
        by_year: dict[int, dict[str, Decimal]] = {}
        for yr, sub, total in rows:
            by_year.setdefault(int(yr), {})[str(sub)] = Decimal(total)
        return by_year

    def ams_1l_cost_recent_years(self, years: int = 3) -> tuple[Decimal, int]:
        rows = (
            self._session.execute(
                select(Ams1LCost.annual_fee_eur)
                .join(AmsYear)
                .order_by(AmsYear.ordinal.desc())
                .limit(years)
            )
            .scalars()
            .all()
        )
        return sum((Decimal(row) for row in rows), Decimal("0")), len(rows)

    def ams_2l_cost_total(self, *, company: str | None = None) -> Decimal:
        stmt = select(func.coalesce(func.sum(Ams2LCost.cost_per_ticket_eur), 0))
        if company is not None:
            company_id = self._company_id(company)
            stmt = stmt.where(Ams2LCost.company_id == company_id)
        return Decimal(self._session.scalar(stmt) or 0)

    def ams_2l_ticket_count(self) -> int:
        """Distinct tickets that actually incurred an AMS 2L cost -- the
        correct denominator for a per-ticket 2L cost rate (a ticket's
        IS_1L flag and its presence in the AMS 2L cost sheet are recorded
        independently in the source)."""
        return self._session.scalar(select(func.count(func.distinct(Ams2LCost.ticket_id)))) or 0

    def license_cost_recent_years(self, years: int = 3) -> tuple[Decimal, int]:
        distinct_years = (
            self._session.execute(
                select(LicenseCost.year).distinct().order_by(LicenseCost.year.desc()).limit(years)
            )
            .scalars()
            .all()
        )
        if not distinct_years:
            return Decimal("0"), 0
        total = self._session.scalar(
            select(func.coalesce(func.sum(LicenseCost.cost_year_eur), 0)).where(
                LicenseCost.year.in_(distinct_years)
            )
        )
        return Decimal(total or 0), len(distinct_years)

    def ticket_counts(self, *, company: str | None = None) -> TicketCounts:
        stmt = select(
            func.count(Ticket.id),
            func.count(Ticket.end_date),
            func.count(Ticket.id).filter(Ticket.is_1l.is_(True)),
            func.count(Ticket.id).filter(Ticket.is_1l.is_(False)),
        )
        if company is not None:
            stmt = stmt.join(Company, Company.id == Ticket.company_id).where(
                Company.name == company
            )
        total, closed, l1, l2 = self._session.execute(stmt).one()
        return TicketCounts(total=total, closed=closed, open=total - closed, l1=l1, l2=l2)

    def resolution_stats(self, *, company: str | None = None) -> ResolutionStats:
        # PostgreSQL `date - date` already yields an integer day count.
        days = Ticket.end_date - Ticket.start_date
        base = select(days.label("days")).where(
            Ticket.start_date.is_not(None), Ticket.end_date.is_not(None)
        )
        if company is not None:
            base = base.join(Company, Company.id == Ticket.company_id).where(
                Company.name == company
            )
        subquery = base.subquery()

        stats = self._session.execute(
            select(
                func.count(subquery.c.days),
                func.count(subquery.c.days).filter(subquery.c.days <= 3),
                func.avg(subquery.c.days),
                func.percentile_cont(0.5).within_group(subquery.c.days),
                func.percentile_cont(0.9).within_group(subquery.c.days),
            )
        ).one()
        closed_with_dates, within_3_days, avg_days, median_days, p90_days = stats
        return ResolutionStats(
            closed_with_dates=closed_with_dates,
            within_3_days=within_3_days,
            avg_days=Decimal(str(avg_days)) if avg_days is not None else None,
            median_days=Decimal(str(median_days)) if median_days is not None else None,
            p90_days=Decimal(str(p90_days)) if p90_days is not None else None,
        )

    def annual_saving_contribution_by_month(
        self, *, company: str | None = None
    ) -> list[tuple[str, Decimal]]:
        """Per-process annual saving (bc_saving * fte_hours_month_actual * 12)
        bucketed by the process's go-live month, for a saving ramp-up trend."""
        bc_saving = self.reference_variable("cost_per_hour_FTE")
        if bc_saving is None:
            return []
        month = func.to_char(cast(Process.go_live_date, Date), "YYYY-MM")
        stmt = (
            select(month.label("month"), func.sum(ProcessEconomics.fte_hours_month_actual))
            .join(ProcessEconomics, ProcessEconomics.process_id == Process.id)
            .where(Process.go_live_date.is_not(None))
            .group_by(month)
            .order_by(month)
        )
        if company is not None:
            stmt = stmt.join(Company, Company.id == Process.company_id).where(
                Company.name == company
            )
        rows = self._session.execute(stmt).tuples().all()
        return [(month, bc_saving * Decimal(fte) * 12) for month, fte in rows]

    def tickets_by_month(self, *, company: str | None = None) -> list[tuple[str, int]]:
        month = func.to_char(cast(Ticket.start_date, Date), "YYYY-MM")
        stmt = (
            select(month.label("month"), func.count(Ticket.id))
            .where(Ticket.start_date.is_not(None))
            .group_by(month)
            .order_by(month)
        )
        if company is not None:
            stmt = stmt.join(Company, Company.id == Ticket.company_id).where(
                Company.name == company
            )
        return list(self._session.execute(stmt).tuples().all())

    def l1_vs_l2_by_month(self) -> list[tuple[str, int, int]]:
        month = func.to_char(cast(Ticket.start_date, Date), "YYYY-MM")
        stmt = (
            select(
                month.label("month"),
                func.count(Ticket.id).filter(Ticket.is_1l.is_(True)),
                func.count(Ticket.id).filter(Ticket.is_1l.is_(False)),
            )
            .where(Ticket.start_date.is_not(None))
            .group_by(month)
            .order_by(month)
        )
        return list(self._session.execute(stmt).tuples().all())

    def ticket_volume_by_company(self) -> list[tuple[str, int]]:
        stmt = (
            select(Company.name, func.count(Ticket.id))
            .join(Ticket, Ticket.company_id == Company.id)
            .group_by(Company.name)
            .order_by(Company.name)
        )
        return list(self._session.execute(stmt).tuples().all())

    def root_cause_pareto(self) -> list[tuple[str, int]]:
        stmt = (
            select(RootCause.name, func.count(Ticket.id))
            .join(Ticket, Ticket.root_cause_id == RootCause.id)
            .group_by(RootCause.name)
            .order_by(func.count(Ticket.id).desc())
        )
        return list(self._session.execute(stmt).tuples().all())

    def top_processes_by_ticket_volume(self, limit: int = 10) -> list[tuple[str, int]]:
        stmt = (
            select(Process.canonical_name, func.count(Ticket.id))
            .join(Ticket, Ticket.process_id == Process.id)
            .group_by(Process.canonical_name)
            .order_by(func.count(Ticket.id).desc())
            .limit(limit)
        )
        return list(self._session.execute(stmt).tuples().all())

    def open_ticket_ages_days(self, *, as_of: date) -> list[int]:
        age_days = cast(literal(as_of) - Ticket.start_date, Integer)
        stmt = select(age_days).where(Ticket.end_date.is_(None), Ticket.start_date.is_not(None))
        return list(self._session.scalars(stmt).all())

    def dq_counts(self) -> tuple[int, int, int, int]:
        total = self._session.scalar(select(func.count(Ticket.id))) or 0
        without_root_cause = (
            self._session.scalar(
                select(func.count(Ticket.id)).where(Ticket.root_cause_id.is_(None))
            )
            or 0
        )
        without_process = (
            self._session.scalar(select(func.count(Ticket.id)).where(Ticket.process_id.is_(None)))
            or 0
        )
        without_company = (
            self._session.scalar(select(func.count(Ticket.id)).where(Ticket.company_id.is_(None)))
            or 0
        )
        return total, without_root_cause, without_process, without_company

    def avg_resolution_by(self, group_column: str) -> list[tuple[str, Decimal]]:
        days = Ticket.end_date - Ticket.start_date
        if group_column == "root_cause":
            label_col = RootCause.name
            stmt = (
                select(label_col, func.avg(days))
                .join(RootCause, RootCause.id == Ticket.root_cause_id)
                .where(Ticket.start_date.is_not(None), Ticket.end_date.is_not(None))
                .group_by(label_col)
                .order_by(label_col)
            )
        elif group_column == "process":
            label_col = Process.canonical_name
            stmt = (
                select(label_col, func.avg(days))
                .join(Process, Process.id == Ticket.process_id)
                .where(Ticket.start_date.is_not(None), Ticket.end_date.is_not(None))
                .group_by(label_col)
                .order_by(label_col)
            )
        else:
            label_col = Company.name
            stmt = (
                select(label_col, func.avg(days))
                .join(Company, Company.id == Ticket.company_id)
                .where(Ticket.start_date.is_not(None), Ticket.end_date.is_not(None))
                .group_by(label_col)
                .order_by(label_col)
            )
        return [(name, Decimal(str(avg))) for name, avg in self._session.execute(stmt).all()]

    def process_roi_rows(
        self,
    ) -> list[tuple[str, str | None, Decimal, Decimal, date | None, int | None]]:
        """(process_name, company_name, capex_eur, fte_hours_month_actual,
        go_live_date, roi_expected_yr) per process with an ECONOMICS row."""
        stmt = (
            select(
                Process.canonical_name,
                Company.name,
                ProcessEconomics.capex_eur,
                ProcessEconomics.fte_hours_month_actual,
                Process.go_live_date,
                ProcessEconomics.roi_expected_yr,
            )
            .join(Process, Process.id == ProcessEconomics.process_id)
            .outerjoin(Company, Company.id == Process.company_id)
            .order_by(Process.canonical_name)
        )
        return list(self._session.execute(stmt).tuples().all())

    def pipeline_processes(
        self,
    ) -> list[tuple[str, str | None, str | None, str | None, str | None, date | None, list[str]]]:
        """(canonical_name, department_name, description, status, company_name,
        go_live_date, application_names) for every pipeline process."""
        stmt = (
            select(Process)
            .outerjoin(Department, Department.id == Process.department_id)
            .options(
                selectinload(Process.department),
                selectinload(Process.company),
                selectinload(Process.applications),
            )
            .where(Process.in_pipeline.is_(True))
            .order_by(Department.name, Process.canonical_name)
        )
        processes = self._session.scalars(stmt).unique().all()
        return [
            (
                process.canonical_name,
                process.department.name if process.department else None,
                process.description,
                process.status,
                process.company.name if process.company else None,
                process.go_live_date,
                [application.name for application in process.applications],
            )
            for process in processes
        ]

    def companies(self) -> list[str]:
        return list(self._session.scalars(select(Company.name).order_by(Company.name)).all())

    def virtual_machine_count(self) -> int:
        return self._session.scalar(select(func.count(VirtualMachine.id))) or 0

    def process_count(self) -> int:
        return self._session.scalar(select(func.count(Process.id))) or 0

    def cost_years(self) -> list[int]:
        """Every calendar year for which *any* running-cost component has data:
        licences, infrastructure (VM cost), AMS 1L, AMS 2L tickets, or change
        requests. Drives the Simple Ops trends so a year present in the DB is
        never hidden just because one component (typically AMS 1L) has no row
        for it. Sorted ascending."""
        ticket_year = cast(func.extract("year", Ticket.start_date), Integer)
        parts = union(
            select(LicenseCost.year.label("year")),
            select(VmCost.year.label("year")),
            select(AmsRfcCost.year.label("year")),
            select(AmsYear.year.label("year"))
            .join(Ams1LCost, Ams1LCost.ams_year_id == AmsYear.id)
            .where(AmsYear.year.is_not(None)),
            select(ticket_year.label("year")).where(
                Ticket.is_1l.is_(False), Ticket.start_date.is_not(None)
            ),
        ).subquery()
        stmt = select(parts.c.year).where(parts.c.year.is_not(None)).order_by(parts.c.year)
        return [int(year) for year in self._session.scalars(stmt).all()]

    def license_cost_by_year(self, years: list[int]) -> dict[int, Decimal]:
        stmt = (
            select(LicenseCost.year, func.coalesce(func.sum(LicenseCost.cost_year_eur), 0))
            .where(LicenseCost.year.in_(years))
            .group_by(LicenseCost.year)
        )
        return {year: Decimal(total) for year, total in self._session.execute(stmt).tuples().all()}

    def licensed_vm_count_by_year(self, years: list[int]) -> dict[int, int]:
        stmt = (
            select(LicenseCost.year, func.count(func.distinct(LicenseCost.virtual_machine_id)))
            .where(LicenseCost.year.in_(years))
            .group_by(LicenseCost.year)
        )
        return dict(self._session.execute(stmt).tuples().all())

    def vm_cost_by_year(self, years: list[int]) -> dict[int, Decimal]:
        stmt = (
            select(VmCost.year, func.coalesce(func.sum(VmCost.cost_eur), 0))
            .where(VmCost.year.in_(years))
            .group_by(VmCost.year)
        )
        return {year: Decimal(total) for year, total in self._session.execute(stmt).tuples().all()}

    def ams_1l_by_year(self) -> list[tuple[int, Decimal, int]]:
        stmt = (
            select(AmsYear.year, Ams1LCost.annual_fee_eur, Ams1LCost.n_processes_baseline)
            .join(AmsYear, AmsYear.id == Ams1LCost.ams_year_id)
            .where(AmsYear.year.is_not(None))
            .order_by(AmsYear.year)
        )
        rows = self._session.execute(stmt).tuples().all()
        return [
            (year, Decimal(fee), n_processes) for year, fee, n_processes in rows if year is not None
        ]

    def ams_2l_ticket_count_by_year(self, years: list[int]) -> dict[int, int]:
        """2L tickets *opened* in each year, for the flat-rate (x €500) header KPI."""
        yr = cast(func.extract("year", Ticket.start_date), Integer)
        stmt = (
            select(yr.label("yr"), func.count(Ticket.id))
            .where(Ticket.is_1l.is_(False), Ticket.start_date.is_not(None), yr.in_(years))
            .group_by(yr)
        )
        return dict(self._session.execute(stmt).tuples().all())

    def ams_2l_actual_cost_by_year(self, years: list[int]) -> dict[int, tuple[Decimal, int]]:
        """Actual AMS 2L cost (sum + distinct ticket count), keyed by the *ticket's*
        start_date year -- for the AMS 2L trend and per-process breakdown, distinct
        from the flat-rate header KPI."""
        yr = cast(func.extract("year", Ticket.start_date), Integer)
        stmt = (
            select(
                yr.label("yr"),
                func.coalesce(func.sum(Ams2LCost.cost_per_ticket_eur), 0),
                func.count(func.distinct(Ams2LCost.ticket_id)),
            )
            .join(Ticket, Ticket.id == Ams2LCost.ticket_id)
            .where(Ticket.start_date.is_not(None), yr.in_(years))
            .group_by(yr)
        )
        return {
            year: (Decimal(total), count)
            for year, total, count in self._session.execute(stmt).tuples().all()
        }

    def ams_rfc_cost_by_year(self, years: list[int]) -> dict[int, Decimal]:
        stmt = (
            select(AmsRfcCost.year, func.coalesce(func.sum(AmsRfcCost.cost_eur), 0))
            .where(AmsRfcCost.year.in_(years))
            .group_by(AmsRfcCost.year)
        )
        return {year: Decimal(total) for year, total in self._session.execute(stmt).tuples().all()}

    def ams_rfc_count_by_year(self, years: list[int]) -> dict[int, int]:
        stmt = (
            select(AmsRfcCost.year, func.count(AmsRfcCost.id))
            .where(AmsRfcCost.year.in_(years))
            .group_by(AmsRfcCost.year)
        )
        return dict(self._session.execute(stmt).tuples().all())

    def occupancy_heatmap(self) -> list[tuple[str, str, int]]:
        """(VM normalized_id, time_slot, count of scheduled processes) -- inner join
        drops schedule rows with no VM, which is fine here (nothing to plot)."""
        stmt = (
            select(
                VirtualMachine.normalized_id,
                ProcessSchedule.time_slot,
                func.count(ProcessSchedule.id),
            )
            .join(VirtualMachine, VirtualMachine.id == ProcessSchedule.virtual_machine_id)
            .group_by(VirtualMachine.normalized_id, ProcessSchedule.time_slot)
            .order_by(VirtualMachine.normalized_id)
        )
        return list(self._session.execute(stmt).tuples().all())

    def root_cause_and_type_breakdown(
        self, *, is_1l: bool, year: int
    ) -> tuple[list[tuple[str, int]], int, int]:
        """Root-cause counts (NULL -> 'unclassified') plus Service Request vs
        Incident counts, scoped to support level and the ticket's start_date year."""
        yr = cast(func.extract("year", Ticket.start_date), Integer)
        base_filters = (Ticket.is_1l.is_(is_1l), Ticket.start_date.is_not(None), yr == year)

        label = func.coalesce(RootCause.name, literal("unclassified"))
        root_cause_stmt = (
            select(label, func.count(Ticket.id))
            .outerjoin(RootCause, RootCause.id == Ticket.root_cause_id)
            .where(*base_filters)
            .group_by(label)
            .order_by(func.count(Ticket.id).desc())
        )
        root_causes = list(self._session.execute(root_cause_stmt).tuples().all())

        type_stmt = select(
            func.count(Ticket.id).filter(Ticket.ticket_type == "Service Request"),
            func.count(Ticket.id).filter(Ticket.ticket_type != "Service Request"),
        ).where(*base_filters)
        sr_count, incident_count = self._session.execute(type_stmt).one()
        return root_causes, sr_count, incident_count

    def rpa_internal_root_cause_pct_inputs(self, year: int) -> tuple[int, int]:
        """(tickets with root cause 'Problema Funzionale RPA', total non-Service-Request
        tickets), both scoped to start_date year -- the RPA Internal Root Causes % KPI."""
        yr = cast(func.extract("year", Ticket.start_date), Integer)
        base_filters = (
            Ticket.start_date.is_not(None),
            yr == year,
            Ticket.ticket_type != "Service Request",
        )
        stmt = (
            select(
                func.count(Ticket.id).filter(RootCause.name == "Problema Funzionale RPA"),
                func.count(Ticket.id),
            )
            .outerjoin(RootCause, RootCause.id == Ticket.root_cause_id)
            .where(*base_filters)
        )
        numerator, denominator = self._session.execute(stmt).one()
        return numerator, denominator

    def backlog_aging_14d_inputs(self, year: int, as_of: date) -> tuple[int, int]:
        """(open tickets opened in `year` and older than 14 days as of `as_of`,
        total tickets opened in `year`) -- the Backlog Aging % KPI."""
        yr = cast(func.extract("year", Ticket.start_date), Integer)
        age_days = cast(literal(as_of) - Ticket.start_date, Integer)
        base_filters = (Ticket.start_date.is_not(None), yr == year)
        stmt = select(
            func.count(Ticket.id).filter(Ticket.end_date.is_(None), age_days > 14),
            func.count(Ticket.id),
        ).where(*base_filters)
        numerator, denominator = self._session.execute(stmt).one()
        return numerator, denominator

    def l1_ratio_inputs_by_year(self, year: int) -> tuple[int, int]:
        """(L1 ticket count, total ticket count), scoped to start_date year."""
        yr = cast(func.extract("year", Ticket.start_date), Integer)
        stmt = select(
            func.count(Ticket.id).filter(Ticket.is_1l.is_(True)),
            func.count(Ticket.id),
        ).where(Ticket.start_date.is_not(None), yr == year)
        l1, total = self._session.execute(stmt).one()
        return l1, total

    def median_resolution_days_by_year(self, year: int) -> Decimal | None:
        """Median resolution days (MTTR) for tickets opened in `year` and closed
        with a valid end_date."""
        yr = cast(func.extract("year", Ticket.start_date), Integer)
        days = Ticket.end_date - Ticket.start_date
        stmt = select(func.percentile_cont(0.5).within_group(days)).where(
            Ticket.start_date.is_not(None), Ticket.end_date.is_not(None), yr == year
        )
        median_days = self._session.scalar(stmt)
        return Decimal(str(median_days)) if median_days is not None else None

    def cost_breakdown_by_process(self, year: int) -> list[tuple[str, Decimal, Decimal, Decimal]]:
        """(process_name, license_share_eur, infra_share_eur, actual_2l_cost_eur) per
        process, for `year`.

        License/infra share = license_cost/vm_cost(that process's VM, year) / count of
        processes assigned to that VM. A process is "assigned" to the VM in its first
        process_schedule row (ordered by id) -- a process with no schedule row, or
        whose first row has no VM, gets a €0 share. AMS-1L's share is identical for
        every process (annual fee / total process count) and is added by the caller,
        not computed per-row here.
        """
        row_number = func.row_number().over(
            partition_by=ProcessSchedule.process_id, order_by=ProcessSchedule.id
        )
        first_schedule = (
            select(
                ProcessSchedule.process_id.label("process_id"),
                ProcessSchedule.virtual_machine_id.label("virtual_machine_id"),
                row_number.label("rn"),
            )
        ).subquery()
        first_schedule = (
            select(first_schedule.c.process_id, first_schedule.c.virtual_machine_id)
            .where(first_schedule.c.rn == 1)
            .subquery()
        )

        vm_process_counts = (
            select(
                first_schedule.c.virtual_machine_id,
                func.count().label("cnt"),
            )
            .where(first_schedule.c.virtual_machine_id.is_not(None))
            .group_by(first_schedule.c.virtual_machine_id)
            .subquery()
        )

        yr = cast(func.extract("year", Ticket.start_date), Integer)
        l2_by_process = (
            select(
                Ticket.process_id.label("process_id"),
                func.coalesce(func.sum(Ams2LCost.cost_per_ticket_eur), 0).label("l2_eur"),
            )
            .join(Ams2LCost, Ams2LCost.ticket_id == Ticket.id)
            .where(Ticket.start_date.is_not(None), yr == year)
            .group_by(Ticket.process_id)
            .subquery()
        )

        stmt = (
            select(
                Process.canonical_name,
                func.coalesce(
                    LicenseCost.cost_year_eur / vm_process_counts.c.cnt, Decimal("0")
                ).label("license_eur"),
                func.coalesce(VmCost.cost_eur / vm_process_counts.c.cnt, Decimal("0")).label(
                    "infra_eur"
                ),
                func.coalesce(l2_by_process.c.l2_eur, 0).label("l2_eur"),
            )
            .select_from(Process)
            .outerjoin(first_schedule, first_schedule.c.process_id == Process.id)
            .outerjoin(
                vm_process_counts,
                vm_process_counts.c.virtual_machine_id == first_schedule.c.virtual_machine_id,
            )
            .outerjoin(
                LicenseCost,
                (LicenseCost.virtual_machine_id == first_schedule.c.virtual_machine_id)
                & (LicenseCost.year == year),
            )
            .outerjoin(
                VmCost,
                (VmCost.virtual_machine_id == first_schedule.c.virtual_machine_id)
                & (VmCost.year == year),
            )
            .outerjoin(l2_by_process, l2_by_process.c.process_id == Process.id)
            .order_by(Process.canonical_name)
        )
        return [
            (name, Decimal(license_eur), Decimal(infra_eur), Decimal(l2_eur))
            for name, license_eur, infra_eur, l2_eur in self._session.execute(stmt).tuples().all()
        ]
