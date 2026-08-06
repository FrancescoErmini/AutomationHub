"""Read-only aggregate queries over the core RPA model.

Pure data access: every method returns plain Decimal/int/float/row values,
never a Metric envelope and never a formula-level business decision (e.g.
which components make up "run cost") -- those live in ``app/services``.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Integer, cast, func, literal, select
from sqlalchemy.orm import Session

from app.models.core import (
    Ams1LCost,
    Ams2LCost,
    AmsYear,
    Company,
    Department,
    LicenseCost,
    Process,
    ProcessEconomics,
    ReferenceVariable,
    RootCause,
    Ticket,
    VirtualMachine,
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

    def annual_saving_eur(self, *, company: str | None = None) -> Decimal:
        bc_saving = self.reference_variable("cost_per_hour_FTE")
        if bc_saving is None:
            return Decimal("0")
        stmt = select(
            func.coalesce(func.sum(ProcessEconomics.fte_hours_month_actual), 0)
        ).select_from(ProcessEconomics)
        if company is not None:
            stmt = (
                stmt.join(Process, Process.id == ProcessEconomics.process_id)
                .join(Company, Company.id == Process.company_id)
                .where(Company.name == company)
            )
        total_fte_hours_month = self._session.scalar(stmt) or Decimal("0")
        return bc_saving * Decimal(total_fte_hours_month) * 12

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

    def annual_saving_contribution_by_month(self) -> list[tuple[str, Decimal]]:
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

    def process_economics_rows(self) -> list[tuple[str, str | None, Decimal, Decimal]]:
        """(process_name, company_name, capex_eur, fte_hours_month_actual) per process."""
        stmt = (
            select(
                Process.canonical_name,
                Company.name,
                ProcessEconomics.capex_eur,
                ProcessEconomics.fte_hours_month_actual,
            )
            .join(Process, Process.id == ProcessEconomics.process_id)
            .outerjoin(Company, Company.id == Process.company_id)
            .order_by(Process.canonical_name)
        )
        return list(self._session.execute(stmt).tuples().all())

    def pipeline_processes(self) -> list[tuple[str, str | None, str | None, str | None]]:
        """(canonical_name, department_name, description, status) for every pipeline process."""
        stmt = (
            select(Process.canonical_name, Department.name, Process.description, Process.status)
            .outerjoin(Department, Department.id == Process.department_id)
            .where(Process.in_pipeline.is_(True))
            .order_by(Department.name, Process.canonical_name)
        )
        return list(self._session.execute(stmt).tuples().all())

    def companies(self) -> list[str]:
        return list(self._session.scalars(select(Company.name).order_by(Company.name)).all())

    def virtual_machine_count(self) -> int:
        return self._session.scalar(select(func.count(VirtualMachine.id))) or 0
