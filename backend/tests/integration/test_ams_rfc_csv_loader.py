from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ingestion.ams_rfc_csv_loader import load_ams_rfc_costs_from_csv
from app.models.core import AmsRfcCost, Process

pytestmark = pytest.mark.integration

_CSV_BODY = (
    "PID;Ticket_Ref;Year;DESC;Man_Day;ROOT CAUSE;NOTE;COST\n"
    "RPA - Test Alpha;Demand;2024;cambio gestione stato fattura;2;Richiesta evolutiva;;1300\n"
    "RPA - Test Alpha;I240912_000191;2025;seconda richiesta;1;45553;nota;650\n"
    "RPA - Unknown Process;S240402_000024;2024;processo non esistente;1;45385;;650\n"
)


def _write_csv(tmp_path: Path) -> Path:
    path = tmp_path / "rfc.csv"
    path.write_text(_CSV_BODY, encoding="utf-8-sig")
    return path


def _count(session: Session, model: type) -> int:
    result = session.scalar(select(func.count()).select_from(model))
    assert result is not None
    return result


def test_load_ams_rfc_costs_matches_process_by_canonical_name(
    db_session: Session, tmp_path: Path
) -> None:
    db_session.add(Process(canonical_name="RPA - Test Alpha", normalized_key="rpa - test alpha"))
    db_session.commit()

    count = load_ams_rfc_costs_from_csv(db_session, _write_csv(tmp_path))
    db_session.commit()

    assert count == 3
    assert _count(db_session, AmsRfcCost) == 3

    matched = db_session.execute(
        select(AmsRfcCost.rfc_ref, AmsRfcCost.process_id).order_by(AmsRfcCost.id)
    ).all()
    assert matched[0].process_id is not None
    assert matched[1].process_id is not None
    assert matched[2].rfc_ref == "S240402_000024"
    assert matched[2].process_id is None  # "RPA - Unknown Process" matches no process


def test_load_ams_rfc_costs_keeps_raw_root_cause_and_parses_cost(
    db_session: Session, tmp_path: Path
) -> None:
    load_ams_rfc_costs_from_csv(db_session, _write_csv(tmp_path))
    db_session.commit()

    row = db_session.scalar(select(AmsRfcCost).where(AmsRfcCost.rfc_ref == "I240912_000191"))
    assert row is not None
    assert row.year == 2025
    assert row.cost_eur == 650
    assert row.root_cause_raw == "45553"  # kept raw, not interpreted as a date


def test_load_ams_rfc_costs_is_full_replace_on_rerun(db_session: Session, tmp_path: Path) -> None:
    csv_path = _write_csv(tmp_path)
    load_ams_rfc_costs_from_csv(db_session, csv_path)
    db_session.commit()

    count = load_ams_rfc_costs_from_csv(db_session, csv_path)
    db_session.commit()

    assert count == 3
    assert _count(db_session, AmsRfcCost) == 3
