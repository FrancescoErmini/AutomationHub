"""SQLAdmin panel: readable labels, no staging tables, filters, every view renders."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.admin import _model_views
from app.models.core import (
    AmsYear,
    Company,
    Priority,
    Process,
    ProcessApplication,
    ProcessSchedule,
    Ticket,
)

_VIEW_IDENTITIES = sorted(view.identity for view in _model_views())


def _login(client: TestClient) -> None:
    response = client.post("/admin/login", data={"username": "admin", "password": "admin"})
    assert response.status_code in (200, 302)


def test_str_renders_representative_column() -> None:
    assert str(Company(name="Acme")) == "Acme"
    assert str(Ticket(ticket_id="INC-42")) == "INC-42"


def test_str_falls_back_to_class_and_id_for_label_less_rows() -> None:
    link = ProcessApplication()
    link.id = 7
    assert str(link) == "ProcessApplication #7"


def test_staging_tables_are_not_exposed() -> None:
    assert not any("staging" in identity for identity in _VIEW_IDENTITIES)
    assert "process" in _VIEW_IDENTITIES  # sanity: core tables still there


def test_admin_index_requires_auth_then_renders(client: TestClient) -> None:
    assert client.get("/admin/", follow_redirects=False).status_code in (302, 307)
    _login(client)
    assert client.get("/admin/").status_code == 200


@pytest.mark.parametrize("identity", _VIEW_IDENTITIES)
def test_every_view_list_page_renders(client: TestClient, identity: str) -> None:
    _login(client)
    assert client.get(f"/admin/{identity}/list").status_code == 200


@pytest.mark.parametrize("identity", ["process", "ticket", "process-application"])
def test_create_form_renders(client: TestClient, identity: str) -> None:
    _login(client)
    assert client.get(f"/admin/{identity}/create").status_code == 200


def test_foreign_keys_use_ajax_search_dropdowns(client: TestClient) -> None:
    _login(client)
    body = client.get("/admin/ticket/create").text
    # One select2-ajax widget per editable many-to-one relationship on Ticket.
    assert body.count('data-role="select2-ajax"') == 6


def test_views_expose_filter_search_and_ordering_controls() -> None:
    views = {view.identity: view for view in _model_views()}

    ticket = views["ticket"]
    assert ticket.column_default_sort == ("start_date", True)
    ticket_filters = {f.parameter_name for f in ticket.column_filters}
    assert {"start_date", "end_date", "ticket_type", "company_id"} <= ticket_filters
    # Process is too big to filter: searched, not dropdown'd.
    assert "process_id" not in ticket_filters
    assert "process.canonical_name" in ticket.column_searchable_list
    assert "requestor" in ticket.column_searchable_list

    process_filters = {f.parameter_name for f in views["process"].column_filters}
    assert {"status", "go_live_date", "in_pipeline", "company_id"} <= process_filters
    assert "department_id" not in process_filters
    assert "department.name" in views["process"].column_searchable_list

    assert "time_slot" in {f.parameter_name for f in views["process-schedule"].column_filters}

    economics_filters = {f.parameter_name for f in views["process-economics"].column_filters}
    assert "capex_eur" in economics_filters
    assert "process_id" not in economics_filters
    assert "process.canonical_name" in views["process-economics"].column_searchable_list

    # Tables without hand-tuning still get generic filters from column types + FKs.
    assert views["ams-rfc-cost"].column_filters
    assert views["vm-cost"].column_filters


@pytest.fixture
def seeded(db_session: Session) -> None:
    year = AmsYear(code="Y1", ordinal=1, year=2026)
    priority = Priority(value="3")
    process = Process(canonical_name="RPA Invoice Bot", normalized_key="rpa invoice bot")
    db_session.add_all([year, priority, process])
    db_session.flush()
    db_session.add_all(
        [
            Ticket(
                ticket_id="OLD-1",
                ticket_type="Incident",
                is_1l=False,
                start_date=date(2025, 1, 5),
                end_date=date(2025, 2, 1),
            ),
            Ticket(
                ticket_id="NEW-1",
                ticket_type="Incident",
                is_1l=False,
                start_date=date(2026, 6, 20),
                end_date=None,
                process_id=process.id,
            ),
            Ticket(
                ticket_id="NEW-2",
                ticket_type="Service Request",
                is_1l=True,
                start_date=date(2026, 6, 25),
                end_date=None,
            ),
            ProcessSchedule(process_id=process.id, time_slot="afternoon", run_user="svc_rpa"),
            ProcessSchedule(process_id=process.id, time_slot="morning", run_user="svc_batch"),
        ]
    )
    db_session.commit()


def test_ticket_list_orders_newest_opening_first(client: TestClient, seeded: None) -> None:
    _login(client)
    body = client.get("/admin/ticket/list").text
    assert body.index("NEW-2") < body.index("NEW-1") < body.index("OLD-1")


def test_open_tickets_filter_excludes_closed(client: TestClient, seeded: None) -> None:
    _login(client)
    body = client.get("/admin/ticket/list?end_date=unset").text
    assert "NEW-1" in body
    assert "NEW-2" in body
    assert "OLD-1" not in body


def test_ticket_search_matches_related_process_name(client: TestClient, seeded: None) -> None:
    _login(client)
    body = client.get("/admin/ticket/list?search=Invoice").text
    assert "NEW-1" in body
    assert "NEW-2" not in body
    assert "OLD-1" not in body


def test_process_schedule_time_slot_filter(client: TestClient, seeded: None) -> None:
    _login(client)
    body = client.get("/admin/process-schedule/list?time_slot=afternoon").text
    assert "svc_rpa" in body
    assert "svc_batch" not in body
