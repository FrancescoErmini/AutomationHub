from datetime import date, timedelta
from typing import Any

from sqlalchemy import distinct, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import InstrumentedAttribute, Session, selectinload

from app.core.exceptions import DuplicateItemError, NotFoundError
from app.models.core import (
    AmsYear,
    Company,
    Priority,
    Process,
    RootCause,
    SupportLevel,
    Ticket,
)
from app.schemas.ticket import TicketUpdate

_DEFAULT_WINDOW_DAYS = 14
_MAX_LIMIT = 5000

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

    def list_tickets(self, *, scope: str, q: str | None, limit: int) -> list[dict[str, Any]]:
        stmt = select(Ticket).options(
            selectinload(Ticket.priority),
            selectinload(Ticket.process),
            selectinload(Ticket.root_cause),
            selectinload(Ticket.support_level),
            selectinload(Ticket.company),
            selectinload(Ticket.ams_year),
        )

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
        elif scope == "default":
            cutoff = date.today() - timedelta(days=_DEFAULT_WINDOW_DAYS)
            stmt = stmt.where(
                or_(
                    Ticket.end_date.is_(None),
                    Ticket.start_date >= cutoff,
                    Ticket.end_date >= cutoff,
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

    def update(self, ticket_pk: int, payload: TicketUpdate) -> dict[str, Any]:
        ticket = self._session.get(Ticket, ticket_pk)
        if ticket is None:
            raise NotFoundError(f"Ticket {ticket_pk} not found")

        data = payload.model_dump()
        for field, model in _FK_MODELS.items():
            fk = data[field]
            if fk is not None and self._session.get(model, fk) is None:
                raise NotFoundError(f"{model.__name__} {fk} not found")

        for field, value in data.items():
            setattr(ticket, field, value)

        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise DuplicateItemError(f"Ticket id '{payload.ticket_id}' already exists") from None

        self._session.refresh(ticket)
        return self._serialize(ticket)

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
            "created_at": t.created_at,
            "is_open": t.end_date is None,
        }
