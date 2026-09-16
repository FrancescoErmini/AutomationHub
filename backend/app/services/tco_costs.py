from typing import Any

from sqlalchemy import distinct, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, NotFoundError
from app.models.core import TcoCost
from app.schemas.tco_cost import TcoCostCreate, TcoCostUpdate


class TcoCostService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_costs(self) -> list[dict[str, Any]]:
        stmt = select(TcoCost).order_by(TcoCost.cost_date.desc(), TcoCost.id.desc())
        return [self._serialize(row) for row in self._session.scalars(stmt).all()]

    def get_options(self) -> dict[str, Any]:
        subtypes = list(
            self._session.scalars(
                select(distinct(TcoCost.subtype))
                .where(TcoCost.subtype.is_not(None))
                .order_by(TcoCost.subtype)
            ).all()
        )
        return {"subtypes": subtypes}

    def create(self, payload: TcoCostCreate) -> dict[str, Any]:
        cost = TcoCost(**payload.model_dump())
        self._session.add(cost)
        self._session.commit()
        self._session.refresh(cost)
        return self._serialize(cost)

    def update(self, cost_id: int, payload: TcoCostUpdate) -> dict[str, Any]:
        cost = self._session.get(TcoCost, cost_id)
        if cost is None:
            raise NotFoundError(f"TCO cost {cost_id} not found")

        for field, value in payload.model_dump().items():
            setattr(cost, field, value)

        self._session.commit()
        self._session.refresh(cost)
        return self._serialize(cost)

    def delete(self, cost_id: int) -> None:
        cost = self._session.get(TcoCost, cost_id)
        if cost is None:
            raise NotFoundError(f"TCO cost {cost_id} not found")

        self._session.delete(cost)
        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise AppError("Cannot delete this cost record") from None

    @staticmethod
    def _serialize(c: TcoCost) -> dict[str, Any]:
        return {
            "id": c.id,
            "cost_date": c.cost_date,
            "cost_eur": c.cost_eur,
            "cost_type": c.cost_type,
            "subtype": c.subtype,
            "description": c.description,
            "created_at": c.created_at,
        }
