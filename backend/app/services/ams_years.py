from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, DuplicateItemError, NotFoundError
from app.models.core import AmsYear
from app.schemas.ams_year import AmsYearCreate, AmsYearUpdate


class AmsYearService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_years(self) -> list[dict[str, Any]]:
        stmt = select(AmsYear).order_by(AmsYear.ordinal)
        return [self._serialize(row) for row in self._session.scalars(stmt).all()]

    def create(self, payload: AmsYearCreate) -> dict[str, Any]:
        year = AmsYear(**payload.model_dump())
        self._session.add(year)
        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise DuplicateItemError(f"AMS year '{payload.code}' already exists") from None

        self._session.refresh(year)
        return self._serialize(year)

    def update(self, year_id: int, payload: AmsYearUpdate) -> dict[str, Any]:
        year = self._session.get(AmsYear, year_id)
        if year is None:
            raise NotFoundError(f"AMS year {year_id} not found")

        for field, value in payload.model_dump().items():
            setattr(year, field, value)

        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise DuplicateItemError(f"AMS year '{payload.code}' already exists") from None

        self._session.refresh(year)
        return self._serialize(year)

    def delete(self, year_id: int) -> None:
        year = self._session.get(AmsYear, year_id)
        if year is None:
            raise NotFoundError(f"AMS year {year_id} not found")

        self._session.delete(year)
        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise AppError(
                "Cannot delete: other records (tickets, processes, costs...) still reference this year"
            ) from None

    @staticmethod
    def _serialize(y: AmsYear) -> dict[str, Any]:
        return {"id": y.id, "code": y.code, "ordinal": y.ordinal, "year": y.year}
