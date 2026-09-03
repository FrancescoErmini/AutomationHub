"""SQLAdmin integration: a session-authenticated admin panel over every model.

One :class:`~sqladmin.ModelView` is generated per mapped model. Each view is
configured by introspecting the mapper so that:

* foreign-key columns are shown and edited as their related object (a readable
  label, via ``Base.__str__``) rather than a raw integer id;
* every foreign key gets a type-ahead search dropdown (``form_ajax_refs``);
* list/detail/form columns, labels, search and sort are sensible defaults;
* every view gets generic list filters (booleans, dates, whole-number columns,
  low-cardinality strings, and small foreign keys), with hand-tuned filters for
  the tables that are edited most (see ``_view_overrides``); foreign keys pointing
  at large tables (see ``_SEARCH_NOT_FILTER_TARGETS``) get a search box instead of
  an unusable dropdown;
* views are grouped in the sidebar by database schema.
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from sqladmin.filters import (
    AllUniqueStringValuesFilter,
    BooleanFilter,
    ForeignKeyFilter,
    OperationColumnFilter,
    StaticValuesFilter,
    get_column_obj,
)
from sqladmin.models import ModelViewMeta
from sqlalchemy import Boolean, Date, DateTime, Integer, String, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import InstrumentedAttribute, Mapper, class_mapper
from sqlalchemy.sql.expression import Select
from starlette.requests import Request

import app.models as models  # noqa: F401  ensures every model is registered on Base before scanning
from app.core.config import get_settings
from app.db.base import REPRESENTATIVE_COLUMN_NAMES, Base
from app.models import core

SESSION_KEY = "admin_authenticated"

# Tables whose columns are mostly computed or system-managed: restrict the edit
# form to the handful of fields a human actually sets.
_FORM_COLUMNS_OVERRIDE: dict[str, tuple[str, ...]] = {
    "Idea": ("status",),
    "AppUser": ("role",),
}

_SCHEMA_CATEGORY = {
    "core": "Core",
}

# Short, closed-vocabulary string columns worth a "pick a value" dropdown filter.
# Anything not listed here (names, notes, free text) is left to plain search.
_LOW_CARDINALITY_STRING_COLUMNS = frozenset(
    {
        "status",
        "ticket_type",
        "cost_type",
        "subtype",
        "time_slot",
        "final_classification",
        "technology_category",
        "feasibility_band",
        "primary_goal",
    }
)

# Foreign keys pointing at these models are too numerous to pick from a dropdown
# (dozens to hundreds of rows). Their views drop the filter and instead expose the
# related object's name in the list search box, so you type a few letters rather
# than scroll a giant <select>. Note: search across a relationship is an inner
# join, so while the search box is in use, rows whose (nullable) foreign key is
# empty are hidden.
_SEARCH_NOT_FILTER_TARGETS = frozenset(
    {
        "Process",
        "Ticket",
        "ApqcCategory",
        "ApqcProcessGroup",
        "ApqcProcess",
        "Application",
        "Department",
    }
)

# ProcessSchedule.time_slot vocabulary (see app.services.simple_ops._TIME_SLOT_COLUMNS).
_TIME_SLOT_CHOICES: list[tuple[str, str]] = [
    ("night", "Night (00-04)"),
    ("early_morning", "Early morning (04-08)"),
    ("morning", "Morning (08-12)"),
    ("afternoon", "Afternoon (12-16)"),
    ("evening", "Evening (16-20)"),
    ("late_evening", "Late evening (20-24)"),
]


class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username, password = form.get("username"), form.get("password")

        settings = get_settings()
        if username != settings.admin_username or password != settings.admin_password:
            return False

        request.session[SESSION_KEY] = True
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return bool(request.session.get(SESSION_KEY))


class DistinctValuesFilter(AllUniqueStringValuesFilter):
    """``AllUniqueStringValuesFilter`` that drops NULLs from the dropdown."""

    async def lookups(self, request: Request, model: Any, run_query: Any) -> list[tuple[str, str]]:
        column = get_column_obj(self.column, model)
        rows = await run_query(select(column).distinct())
        return [("", "All")] + [(row[0], row[0]) for row in rows if row[0] is not None]


class IsSetFilter:
    """All / has a value / is empty, for a nullable column (e.g. a ticket's end date)."""

    has_operator = False

    def __init__(
        self,
        column: InstrumentedAttribute,
        title: str,
        set_label: str = "Set",
        unset_label: str = "Not set",
        parameter_name: str | None = None,
    ) -> None:
        self.column = column
        self.title = title
        self.parameter_name = parameter_name or column.key
        self._set_label = set_label
        self._unset_label = unset_label

    async def lookups(self, request: Request, model: Any, run_query: Any) -> list[tuple[str, str]]:
        return [("", "All"), ("set", self._set_label), ("unset", self._unset_label)]

    async def get_filtered_query(self, query: Select, value: Any, model: Any) -> Select:
        if value == "set":
            return query.filter(self.column.isnot(None))
        if value == "unset":
            return query.filter(self.column.is_(None))
        return query


def _humanize(identifier: str) -> str:
    """``ams_year_id`` -> ``Ams Year``; ``AmsRfcCost`` -> ``Ams Rfc Cost``."""
    text = identifier[:-3] if identifier.endswith("_id") else identifier
    text = re.sub(r"(?<!^)(?=[A-Z])", " ", text.replace("_", " "))
    return " ".join(word.capitalize() for word in text.split())


def _pluralize(word: str) -> str:
    if word.endswith("y") and word[-2:-1].lower() not in "aeiou":
        return f"{word[:-1]}ies"
    if word.endswith(("s", "x", "z", "ch", "sh")):
        return f"{word}es"
    return f"{word}s"


def _humanize_plural(identifier: str) -> str:
    parts = _humanize(identifier).rsplit(" ", 1)
    parts[-1] = _pluralize(parts[-1])
    return " ".join(parts)


def _representative_column_names(model: type) -> list[str]:
    """String columns that best identify a row, for search and ajax dropdowns.

    Foreign-key columns are excluded: they are opaque integers, and a column like
    ``Ams2LCost.ticket_id`` would otherwise be mistaken for the ticket's label.
    """
    columns = class_mapper(model).columns
    column_keys = {column.key for column in columns if not column.foreign_keys}
    names: list[str] = []
    if "hierarchy_id" in column_keys:
        names.append("hierarchy_id")
    names.extend(name for name in REPRESENTATIVE_COLUMN_NAMES if name in column_keys)
    return names


def _generic_filters(model: type, mapper: Mapper[Any], many_to_one: list) -> list:
    """Filters every table gets for free, from column types and foreign keys."""
    pk_keys = {column.key for column in mapper.primary_key}
    filters: list = []

    for column in mapper.columns:
        if column.key in pk_keys or column.foreign_keys or column.key == "created_at":
            continue
        attribute = getattr(model, column.key)
        column_type = column.type
        title = _humanize(column.key)
        if isinstance(column_type, Boolean):
            filters.append(BooleanFilter(attribute, title=title))
        elif isinstance(column_type, Date | DateTime):
            filters.append(OperationColumnFilter(attribute, title=title))
        elif isinstance(column_type, Integer) and not column.key.endswith("_id"):
            # Whole-number facets (year, ordinal, counts) are useful; decimals
            # (money, rates) just clutter the sidebar, so Numeric is left out.
            filters.append(OperationColumnFilter(attribute, title=title))
        elif isinstance(column_type, String) and column.key in _LOW_CARDINALITY_STRING_COLUMNS:
            filters.append(DistinctValuesFilter(attribute, title=title))

    for relationship in many_to_one:
        target = relationship.mapper.class_
        target_fields = _representative_column_names(target)
        if not target_fields or len(relationship.local_columns) != 1:
            continue
        if target.__name__ in _SEARCH_NOT_FILTER_TARGETS:
            continue  # replaced by a search box, see _relationship_search_paths
        fk_column = next(iter(relationship.local_columns))
        filters.append(
            ForeignKeyFilter(
                getattr(model, fk_column.key),
                getattr(target, target_fields[0]),
                title=_humanize(relationship.key),
            )
        )

    return filters


def _relationship_search_paths(many_to_one: list) -> list[str]:
    """One dotted ``rel.label_column`` path per foreign key too big to filter.

    Exactly one field per relationship: sqladmin's search adds a join for every
    search field, so two fields on the same relationship would double-join it.
    """
    paths: list[str] = []
    for relationship in many_to_one:
        target = relationship.mapper.class_
        if target.__name__ not in _SEARCH_NOT_FILTER_TARGETS:
            continue
        fields = _representative_column_names(target)
        if fields:
            best = "name" if "name" in fields else fields[0]
            paths.append(f"{relationship.key}.{best}")
    return paths


def _default_sort(column_keys: list[str]) -> tuple[str, bool] | None:
    """Newest-first where there is a timeline column, else A-Z by the label column."""
    for key in ("created_at", "cost_date", "computed_at", "started_at"):
        if key in column_keys:
            return (key, True)
    for key in REPRESENTATIVE_COLUMN_NAMES:
        if key in column_keys:
            return (key, False)
    return None


def _view_overrides() -> dict[str, dict[str, Any]]:
    """Hand-tuned search / filter / ordering for the most-edited tables.

    Kept as a function (not a module constant) so the mapped classes are only
    touched after ``app.models`` has finished importing.
    """
    Ticket = core.Ticket
    Process = core.Process
    ProcessSchedule = core.ProcessSchedule
    ProcessEconomics = core.ProcessEconomics

    return {
        "Ticket": {
            "column_default_sort": ("start_date", True),
            "column_searchable_list": ["ticket_id", "process.canonical_name", "requestor"],
            "column_filters": [
                OperationColumnFilter(Ticket.start_date, title="Opened on"),
                IsSetFilter(
                    Ticket.end_date,
                    title="Closing date",
                    set_label="Closed",
                    unset_label="Open (no closing date)",
                ),
                DistinctValuesFilter(Ticket.ticket_type, title="Ticket type"),
                BooleanFilter(Ticket.is_1l, title="First level"),
                # Process (68+) is searched, not filtered -- see column_searchable_list.
                ForeignKeyFilter(Ticket.company_id, core.Company.name, title="Company"),
                ForeignKeyFilter(Ticket.priority_id, core.Priority.value, title="Priority"),
                ForeignKeyFilter(
                    Ticket.support_level_id, core.SupportLevel.code, title="Support level"
                ),
                ForeignKeyFilter(Ticket.root_cause_id, core.RootCause.name, title="Root cause"),
                ForeignKeyFilter(Ticket.ams_year_id, core.AmsYear.code, title="AMS year"),
            ],
        },
        "Process": {
            "column_default_sort": ("canonical_name", False),
            "column_searchable_list": [
                "canonical_name",
                "description",
                "department.name",
                "company.name",
            ],
            "column_filters": [
                DistinctValuesFilter(Process.status, title="Status"),
                OperationColumnFilter(Process.go_live_date, title="Go live date"),
                BooleanFilter(Process.in_pipeline, title="In pipeline"),
                # Department (19) is searched, not filtered -- see column_searchable_list.
                ForeignKeyFilter(Process.company_id, core.Company.name, title="Company"),
                ForeignKeyFilter(Process.ams_year_id, core.AmsYear.code, title="AMS year"),
            ],
        },
        "ProcessSchedule": {
            "column_searchable_list": [
                "process.canonical_name",
                "run_user",
                "scheduled_description",
            ],
            "column_filters": [
                StaticValuesFilter(
                    ProcessSchedule.time_slot, values=_TIME_SLOT_CHOICES, title="Time slot"
                ),
                # Process (68+) is searched, not filtered -- see column_searchable_list.
                ForeignKeyFilter(
                    ProcessSchedule.virtual_machine_id,
                    core.VirtualMachine.normalized_id,
                    title="Virtual machine",
                ),
                OperationColumnFilter(ProcessSchedule.avg_minutes, title="Avg minutes"),
                OperationColumnFilter(ProcessSchedule.rpa_hours_month, title="RPA hours / month"),
            ],
        },
        "ProcessEconomics": {
            "column_default_sort": ("capex_eur", True),
            "column_searchable_list": ["process.canonical_name", "note"],
            "column_filters": [
                # Process (68+) is searched, not filtered -- see column_searchable_list.
                OperationColumnFilter(ProcessEconomics.capex_eur, title="CAPEX (EUR)"),
                OperationColumnFilter(
                    ProcessEconomics.roi_expected_yr, title="ROI expected (years)"
                ),
                OperationColumnFilter(
                    ProcessEconomics.fte_hours_month_actual, title="FTE hours / month"
                ),
                OperationColumnFilter(
                    ProcessEconomics.extra_annual_saving_eur, title="Extra annual saving (EUR)"
                ),
            ],
        },
        "AppUser": {
            "column_list": [
                "sub",
                "email",
                "preferred_username",
                "name",
                "role",
                "created_at",
            ],
            "column_default_sort": ("created_at", True),
            "can_create": False,
            "can_delete": False,
            "form_choices": {"role": [("user", "user"), ("editor", "editor"), ("admin", "admin")]},
            "category": "Access",
        },
    }


def _build_view(model: type, overrides: dict[str, Any]) -> type[ModelView]:
    mapper: Mapper[Any] = class_mapper(model)
    pk_keys = {column.key for column in mapper.primary_key}
    column_keys = [column.key for column in mapper.columns]

    fk_column_to_relationship: dict[str, str] = {}
    many_to_one = []
    collections = []
    for relationship in mapper.relationships:
        if relationship.direction.name == "MANYTOONE":
            many_to_one.append(relationship)
            for local_column in relationship.local_columns:
                if local_column.key is not None:
                    fk_column_to_relationship[local_column.key] = relationship.key
        else:
            collections.append(relationship)

    # List view: scalar columns, each FK column replaced by its relationship.
    list_columns: list[str] = []
    for key in column_keys:
        replacement = fk_column_to_relationship.get(key, key)
        if replacement not in list_columns:
            list_columns.append(replacement)

    detail_columns = list(list_columns)
    detail_columns.extend(
        relationship.key for relationship in collections if relationship.key not in detail_columns
    )

    form_override = _FORM_COLUMNS_OVERRIDE.get(model.__name__)
    if form_override is not None:
        form_columns: list[str] = list(form_override)
        form_ajax_refs: dict[str, dict] = {}
    else:
        form_columns = [
            key
            for key in column_keys
            if key not in pk_keys and key != "created_at" and key not in fk_column_to_relationship
        ]
        form_ajax_refs = {}
        for relationship in many_to_one:
            if relationship.viewonly:
                continue
            form_columns.append(relationship.key)
            target_fields = _representative_column_names(relationship.mapper.class_)
            if target_fields:
                form_ajax_refs[relationship.key] = {
                    "fields": tuple(target_fields),
                    "order_by": target_fields[0],
                }

    sortable = [key for key in list_columns if key in column_keys]

    # This row's own label columns, plus a search path for each foreign key that
    # is too big to offer as a filter dropdown (see _SEARCH_NOT_FILTER_TARGETS).
    # Other relationship search is opted into per-view in ``_view_overrides``.
    searchable = _representative_column_names(model) + _relationship_search_paths(many_to_one)

    labels: dict[str, str] = {}
    for key in column_keys:
        display_key = fk_column_to_relationship.get(key, key)
        labels[display_key] = _humanize(display_key)

    category = _SCHEMA_CATEGORY.get(mapper.local_table.schema or "", "Other")

    attributes: dict[str, Any] = {
        "column_list": list_columns,
        "column_details_list": detail_columns,
        "form_columns": form_columns,
        "form_ajax_refs": form_ajax_refs,
        "column_searchable_list": searchable,
        "column_sortable_list": sortable,
        "column_filters": _generic_filters(model, mapper, many_to_one),
        "column_labels": labels,
        "name": _humanize(model.__name__),
        "name_plural": _humanize_plural(model.__name__),
        "category": category,
        "page_size": 50,
        "page_size_options": [25, 50, 100, 200],
    }
    default_sort = _default_sort(column_keys)
    if default_sort is not None:
        attributes["column_default_sort"] = default_sort

    attributes.update(overrides)
    return ModelViewMeta(f"{model.__name__}Admin", (ModelView,), attributes, model=model)


def _model_views() -> list[type[ModelView]]:
    overrides_by_model = _view_overrides()
    return [
        _build_view(model, overrides_by_model.get(model.__name__, {}))
        for model in Base.__subclasses__()
    ]


def setup_admin(app: FastAPI, engine: Engine) -> Admin:
    settings = get_settings()
    admin = Admin(
        app=app,
        engine=engine,
        authentication_backend=AdminAuth(secret_key=settings.admin_secret_key),
    )
    for view in _model_views():
        admin.add_view(view)
    return admin
