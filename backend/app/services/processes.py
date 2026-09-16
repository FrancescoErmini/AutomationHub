from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import InstrumentedAttribute, Session, selectinload

from app.core.exceptions import AppError, DuplicateItemError, NotFoundError
from app.models.core import (
    AmsYear,
    Company,
    Department,
    Person,
    Process,
    ProcessStakeholder,
    ProcessType,
)
from app.schemas.process import ProcessCreate, ProcessUpdate
from app.schemas.process_stakeholder import STAKEHOLDER_ROLES, ProcessStakeholderCreate
from app.services.people import PersonService

# Editable FK fields -> the model each points at, for existence checks.
_FK_MODELS: dict[str, type[Any]] = {
    "department_id": Department,
    "company_id": Company,
    "ams_year_id": AmsYear,
    "process_type_id": ProcessType,
}


def _normalize_key(name: str) -> str:
    """Lower, trim, collapse inner whitespace, drop a trailing ' prd'.
    Mirrors the ticket importer's process-name normalization so keys stay
    consistent regardless of how a process was created."""
    key = " ".join(name.lower().split())
    if key.endswith(" prd"):
        key = key[:-4].rstrip()
    return key


class ProcessService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._people = PersonService(session)

    def list_processes(self) -> list[dict[str, Any]]:
        stmt = (
            select(Process)
            .options(
                selectinload(Process.department),
                selectinload(Process.company),
                selectinload(Process.ams_year),
                selectinload(Process.process_type),
                selectinload(Process.stakeholders).selectinload(ProcessStakeholder.person),
            )
            .order_by(Process.canonical_name)
        )
        return [self._serialize(row) for row in self._session.scalars(stmt).unique().all()]

    def get_options(self) -> dict[str, Any]:
        return {
            "companies": self._ref(Company, Company.name),
            "departments": self._ref(Department, Department.name),
            "ams_years": self._ref(AmsYear, AmsYear.code),
            "process_types": self._ref(ProcessType, ProcessType.name),
            "roles": list(STAKEHOLDER_ROLES),
        }

    def add_stakeholder(
        self, process_id: int, payload: ProcessStakeholderCreate
    ) -> dict[str, Any]:
        process = self._session.get(Process, process_id)
        if process is None:
            raise NotFoundError(f"Process {process_id} not found")

        person = self._people.get_or_create(payload.email, payload.name)

        stakeholder = ProcessStakeholder(process_id=process_id, role=payload.role, person_id=person.id)
        self._session.add(stakeholder)
        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise DuplicateItemError(
                f"{person.email} already has the role '{payload.role}' on this process"
            ) from None

        self._session.refresh(stakeholder)
        return self._serialize_stakeholder(stakeholder, person)

    def remove_stakeholder(self, process_id: int, stakeholder_id: int) -> None:
        stakeholder = self._session.get(ProcessStakeholder, stakeholder_id)
        if stakeholder is None or stakeholder.process_id != process_id:
            raise NotFoundError(f"Stakeholder {stakeholder_id} not found on process {process_id}")

        self._session.delete(stakeholder)
        self._session.commit()

    def create(self, payload: ProcessCreate) -> dict[str, Any]:
        data = payload.model_dump()
        self._check_fk_targets(data)

        process = Process(normalized_key=_normalize_key(data["canonical_name"]), **data)
        self._session.add(process)
        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise DuplicateItemError(
                f"Process '{payload.canonical_name}' already exists"
            ) from None

        self._session.refresh(process)
        return self._serialize(process)

    def update(self, process_id: int, payload: ProcessUpdate) -> dict[str, Any]:
        process = self._session.get(Process, process_id)
        if process is None:
            raise NotFoundError(f"Process {process_id} not found")

        data = payload.model_dump()
        self._check_fk_targets(data)

        for field, value in data.items():
            setattr(process, field, value)
        process.normalized_key = _normalize_key(process.canonical_name)

        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise DuplicateItemError(
                f"Process '{payload.canonical_name}' already exists"
            ) from None

        self._session.refresh(process)
        return self._serialize(process)

    def delete(self, process_id: int) -> None:
        process = self._session.get(Process, process_id)
        if process is None:
            raise NotFoundError(f"Process {process_id} not found")

        self._session.delete(process)
        try:
            self._session.commit()
        except IntegrityError:
            self._session.rollback()
            raise AppError(
                "Cannot delete: other records (tickets, costs...) still reference this process"
            ) from None

    def _check_fk_targets(self, data: dict[str, Any]) -> None:
        for field, model in _FK_MODELS.items():
            fk = data[field]
            if fk is not None and self._session.get(model, fk) is None:
                raise NotFoundError(f"{model.__name__} {fk} not found")

    def _ref(self, model: type[Any], label_col: InstrumentedAttribute[str]) -> list[dict[str, Any]]:
        rows = self._session.execute(select(model.id, label_col).order_by(label_col)).all()
        return [{"id": row_id, "label": label} for row_id, label in rows]

    @staticmethod
    def _serialize(p: Process) -> dict[str, Any]:
        return {
            "id": p.id,
            "canonical_name": p.canonical_name,
            "description": p.description,
            "documentation_url": p.documentation_url,
            "department_id": p.department_id,
            "department_name": p.department.name if p.department else None,
            "company_id": p.company_id,
            "company_name": p.company.name if p.company else None,
            "ams_year_id": p.ams_year_id,
            "ams_year_code": p.ams_year.code if p.ams_year else None,
            "process_type_id": p.process_type_id,
            "process_type_name": p.process_type.name if p.process_type else None,
            "status": p.status,
            "go_live_date": p.go_live_date,
            "in_pipeline": p.in_pipeline,
            "stakeholders": [
                ProcessService._serialize_stakeholder(s, s.person) for s in p.stakeholders
            ],
        }

    @staticmethod
    def _serialize_stakeholder(s: ProcessStakeholder, person: Person) -> dict[str, Any]:
        return {
            "id": s.id,
            "role": s.role,
            "person_id": person.id,
            "person_email": person.email,
            "person_name": person.name,
        }
