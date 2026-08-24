from decimal import Decimal
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.core import ApqcCategory, ApqcProcess, ApqcProcessGroup, Idea, ReferenceVariable


def _hierarchy_sort_key(hierarchy_id: str) -> tuple[int, ...]:
    """Numeric sort key so '2.0' sorts before '10.0' (string order would put
    '10.0' first)."""
    return tuple(int(part) for part in hierarchy_id.split("."))


class IdeaRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    # -- APQC taxonomy lookups, for the wizard's cascading dropdowns --

    def list_categories(self) -> list[ApqcCategory]:
        rows = self._session.scalars(select(ApqcCategory))
        return sorted(rows, key=lambda row: _hierarchy_sort_key(row.hierarchy_id))

    def list_process_groups(self, category_id: int) -> list[ApqcProcessGroup]:
        rows = self._session.scalars(
            select(ApqcProcessGroup).where(ApqcProcessGroup.category_id == category_id)
        )
        return sorted(rows, key=lambda row: _hierarchy_sort_key(row.hierarchy_id))

    def list_processes(self, process_group_id: int) -> list[ApqcProcess]:
        rows = self._session.scalars(
            select(ApqcProcess).where(ApqcProcess.process_group_id == process_group_id)
        )
        return sorted(rows, key=lambda row: _hierarchy_sort_key(row.hierarchy_id))

    def get_process(self, process_id: int) -> ApqcProcess | None:
        return self._session.get(ApqcProcess, process_id)

    # -- config --

    def reference_variable(self, name: str) -> Decimal | None:
        value = self._session.scalar(
            select(ReferenceVariable.value).where(ReferenceVariable.name == name)
        )
        return Decimal(value) if value is not None else None

    # -- ideas --

    def add(self, idea: Idea) -> Idea:
        self._session.add(idea)
        self._session.commit()
        self._session.refresh(idea)
        return idea

    def _joined_select(self) -> Select[tuple[Idea, str, str, str]]:
        return (
            select(
                Idea,
                ApqcCategory.name.label("l1_name"),
                ApqcProcessGroup.name.label("l2_name"),
                ApqcProcess.name.label("l3_name"),
            )
            .join(ApqcProcess, Idea.apqc_process_id == ApqcProcess.id)
            .join(ApqcProcessGroup, ApqcProcess.process_group_id == ApqcProcessGroup.id)
            .join(ApqcCategory, ApqcProcessGroup.category_id == ApqcCategory.id)
        )

    def list(self) -> list[dict[str, Any]]:
        rows = self._session.execute(self._joined_select().order_by(Idea.created_at.desc()))
        return [_row_to_dict(row) for row in rows]

    def get(self, idea_id: int) -> dict[str, Any] | None:
        row = self._session.execute(self._joined_select().where(Idea.id == idea_id)).first()
        return _row_to_dict(row) if row is not None else None


def _row_to_dict(row: Any) -> dict[str, Any]:
    idea = row.Idea
    data: dict[str, Any] = {
        column.name: getattr(idea, column.name) for column in Idea.__table__.columns
    }
    data["l1_name"] = row.l1_name
    data["l2_name"] = row.l2_name
    data["l3_name"] = row.l3_name
    return data
