from datetime import date, timedelta
from typing import Any

from sqlalchemy import distinct, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import InstrumentedAttribute, Session, selectinload

from app.core.exceptions import AppError, DuplicateItemError, NotFoundError
from app.models.core import (
    Ams2LCost,
    AmsYear,
    Company,
    Priority,
    Process,
    RootCause,
    SupportLevel,
    Ticket,
)
from app.schemas.ticket import TicketCreate, TicketUpdate

_MAX_LIMIT = 5000

# Rolling-day windows for the ``period`` filter; the calendar-based options
# (month / year / last_year) are handled separately in ``_period_bounds``.
_PERIOD_DAYS: dict[str, int] = {"7d": 7, "14d": 14, "30d": 30, "90d": 90}


def _period_bounds(period: str) -> tuple[date | None, date | None]:
    """(from, to) inclusive bounds on ``start_date`` for a ``period`` value.
    ``None`` on either side means unbounded; ``all`` -> (None, None)."""
    today = date.today()
    if period in _PERIOD_DAYS:
        return today - timedelta(days=_PERIOD_DAYS[period]), None
    if period == "month":
        return today.replace(day=1), None
    if period == "year":
        return date(today.year, 1, 1), None
    if period == "last_year":
        return date(today.year - 1, 1, 1), date(today.year - 1, 12, 31)
    return None, None


# Editable FK fields -> the model each points at, for existence checks on update.
_FK_MODELS: dict[str, type[Any]] = {
    "priority_id": Priority,
    "process_id": Process,
    "root_cause_id": RootCause,
    "support_level_id": SupportLevel,
    "company_id": Company,
    "ams_year_id": AmsYear,
}


class TicketService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_tickets(
        self,
        *,
        status: str = "all",
        period: str = "14d",
        level: str = "all",
        root_cause_id: int | None = None,
        ticket_type: str | None = None,
        q: str | None = None,
        limit: int,
    ) -> list[dict[str, Any]]:
        stmt = select(Ticket).options(
            selectinload(Ticket.priority),
            selectinload(Ticket.process),
            selectinload(Ticket.root_cause),
            selectinload(Ticket.support_level),
            selectinload(Ticket.company),
            selectinload(Ticket.ams_year),
        )

        if status == "open":
            stmt = stmt.where(Ticket.end_date.is_(None))
        elif status == "closed":
            stmt = stmt.where(Ticket.end_date.is_not(None))

        start_from, start_to = _period_bounds(period)
        if start_from is not None:
            stmt = stmt.where(Ticket.start_date.is_not(None), Ticket.start_date >= start_from)
        if start_to is not None:
            stmt = stmt.where(Ticket.start_date <= start_to)

        if level == "1l":
            stmt = stmt.where(Ticket.is_1l.is_(True))
        elif level == "2l":
            stmt = stmt.where(Ticket.is_1l.is_(False))

        if root_cause_id is not None:
            stmt = stmt.where(Ticket.root_cause_id == root_cause_id)

        if ticket_type:
            stmt = stmt.where(Ticket.ticket_type == ticket_type)

        term = (q or "").strip()
        if term:
            pattern = f"%{term}%"
            stmt = stmt.outerjoin(Ticket.process).where(
                or_(
                    Ticket.ticket_id.ilike(pattern),
                    Ticket.requestor.ilike(pattern),
                    Process.canonical_name.ilike(pattern),
                    Ticket.note.ilike(pattern),
                )
            )

        stmt = stmt.order_by(
            Ticket.end_date.is_not(None),
            Ticket.start_date.desc().nullslast(),
            Ticket.id.desc(),
        ).limit(max(1, min(limit, _MAX_LIMIT)))

        return [self._serialize(row) for row in self._session.scalars(stmt).unique().all()]

    def get_options(self) -> dict[str, Any]:
        return {
            "priorities": self._ref(Priority, Priority.value),
            "processes": self._ref(Process, Process.canonical_name),
            "root_causes": self._ref(RootCause, RootCause.name),
            "support_levels": self._ref(SupportLevel, SupportLevel.code),
            "companies": self._ref(Company, Company.name),
            "ams_years": self._ref(AmsYear, AmsYear.code),
            "ticket_types": list(
                self._session.scalars(
                    select(distinct(Ticket.ticket_type)).order_by(Ticket.ticket_type)
                ).all()
            ),
        }

    def create(self, payload: TicketCreate) -> dict[str, Any]:
        data = payload.model_dump()
        self._check_fk_targets(data)

        ticket = Ticket(**data)
        self._session.add(ticket)
        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise DuplicateItemError(f"Ticket id '{payload.ticket_id}' already exists") from None

        self._session.refresh(ticket)
        return self._serialize(ticket)

    def update(self, ticket_pk: int, payload: TicketUpdate) -> dict[str, Any]:
        ticket = self._session.get(Ticket, ticket_pk)
        if ticket is None:
            raise NotFoundError(f"Ticket {ticket_pk} not found")

        data = payload.model_dump()
        self._check_fk_targets(data)

        for field, value in data.items():
            setattr(ticket, field, value)

        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise DuplicateItemError(f"Ticket id '{payload.ticket_id}' already exists") from None

        self._session.refresh(ticket)
        return self._serialize(ticket)

    def _check_fk_targets(self, data: dict[str, Any]) -> None:
        for field, model in _FK_MODELS.items():
            fk = data[field]
            if fk is not None and self._session.get(model, fk) is None:
                raise NotFoundError(f"{model.__name__} {fk} not found")

    def delete(self, ticket_pk: int) -> None:
        ticket = self._session.get(Ticket, ticket_pk)
        if ticket is None:
            raise NotFoundError(f"Ticket {ticket_pk} not found")

        cost_rows = self._session.scalar(
            select(func.count(Ams2LCost.id)).where(Ams2LCost.ticket_id == ticket_pk)
        )
        if cost_rows:
            raise AppError(
                f"Cannot delete: {cost_rows} AMS 2L cost record(s) reference this ticket"
            )

        self._session.delete(ticket)
        self._session.commit()

    def _ref(self, model: type[Any], label_col: InstrumentedAttribute[str]) -> list[dict[str, Any]]:
        rows = self._session.execute(select(model.id, label_col).order_by(label_col)).all()
        return [{"id": row_id, "label": label} for row_id, label in rows]

    @staticmethod
    def _serialize(t: Ticket) -> dict[str, Any]:
        return {
            "id": t.id,
            "ticket_id": t.ticket_id,
            "ticket_type": t.ticket_type,
            "priority_id": t.priority_id,
            "priority_value": t.priority.value if t.priority else None,
            "process_id": t.process_id,
            "process_name": t.process.canonical_name if t.process else None,
            "requestor": t.requestor,
            "start_date": t.start_date,
            "end_date": t.end_date,
            "root_cause_id": t.root_cause_id,
            "root_cause_name": t.root_cause.name if t.root_cause else None,
            "is_1l": t.is_1l,
            "support_level_id": t.support_level_id,
            "support_level_code": t.support_level.code if t.support_level else None,
            "company_id": t.company_id,
            "company_name": t.company.name if t.company else None,
            "ams_year_id": t.ams_year_id,
            "ams_year_code": t.ams_year.code if t.ams_year else None,
            "note": t.note,
            "ticket_color": t.ticket_color,
            "created_at": t.created_at,
            "is_open": t.end_date is None,
        }
