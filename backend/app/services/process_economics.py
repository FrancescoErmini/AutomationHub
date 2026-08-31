"""CRUD for the per-process economics rows edited on the frontend
Process Economics page (mirrors the SQLAdmin ``process_economics`` view)."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import DuplicateItemError, NotFoundError
from app.models.core import Process, ProcessEconomics
from app.schemas.process_economics import ProcessEconomicsCreate, ProcessEconomicsUpdate


class ProcessEconomicsService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_rows(self) -> list[dict[str, Any]]:
        stmt = (
            select(ProcessEconomics, Process.canonical_name)
            .join(Process, Process.id == ProcessEconomics.process_id)
            .order_by(Process.canonical_name)
        )
        return [self._serialize(econ, name) for econ, name in self._session.execute(stmt).all()]

    def process_options(self) -> list[dict[str, Any]]:
        taken = set(self._session.scalars(select(ProcessEconomics.process_id)).all())
        rows = self._session.execute(
            select(Process.id, Process.canonical_name).order_by(Process.canonical_name)
        ).all()
        return [
            {"id": pid, "canonical_name": name, "has_economics": pid in taken}
            for pid, name in rows
        ]

    def create(self, payload: ProcessEconomicsCreate) -> dict[str, Any]:
        process = self._session.get(Process, payload.process_id)
        if process is None:
            raise NotFoundError(f"Process {payload.process_id} not found")
        existing = self._session.scalar(
            select(ProcessEconomics).where(ProcessEconomics.process_id == payload.process_id)
        )
        if existing is not None:
            raise DuplicateItemError(
                f"Process economics already exist for '{process.canonical_name}'"
            )
        econ = ProcessEconomics(
            process_id=payload.process_id,
            capex_eur=payload.capex_eur,
            roi_expected_yr=payload.roi_expected_yr,
            fte_hours_month_actual=payload.fte_hours_month_actual,
            extra_annual_saving_eur=payload.extra_annual_saving_eur,
            note=payload.note,
        )
        self._session.add(econ)
        self._session.commit()
        self._session.refresh(econ)
        return self._serialize(econ, process.canonical_name)

    def update(self, econ_id: int, payload: ProcessEconomicsUpdate) -> dict[str, Any]:
        econ = self._session.get(ProcessEconomics, econ_id)
        if econ is None:
            raise NotFoundError(f"Process economics {econ_id} not found")
        econ.capex_eur = payload.capex_eur
        econ.roi_expected_yr = payload.roi_expected_yr
        econ.fte_hours_month_actual = payload.fte_hours_month_actual
        econ.extra_annual_saving_eur = payload.extra_annual_saving_eur
        econ.note = payload.note
        self._session.commit()
        self._session.refresh(econ)
        return self._serialize(econ, econ.process.canonical_name)

    def delete(self, econ_id: int) -> None:
        econ = self._session.get(ProcessEconomics, econ_id)
        if econ is None:
            raise NotFoundError(f"Process economics {econ_id} not found")
        self._session.delete(econ)
        self._session.commit()

    @staticmethod
    def _serialize(econ: ProcessEconomics, process_name: str) -> dict[str, Any]:
        return {
            "id": econ.id,
            "process_id": econ.process_id,
            "process_name": process_name,
            "capex_eur": econ.capex_eur,
            "roi_expected_yr": econ.roi_expected_yr,
            "fte_hours_month_actual": econ.fte_hours_month_actual,
            "extra_annual_saving_eur": econ.extra_annual_saving_eur,
            "note": econ.note,
        }
