from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion.apqc_loader import load_apqc_taxonomy_from_workbook
from app.models.core import ApqcProcess

WORKBOOK = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "raw"
    / "K07122_Life_Sciences_v722_vsLife_Sciences_v721_2025.xlsx"
)

_VALID_PAYLOAD = {
    "title": "Automate invoice matching",
    "submitter_name": "Test User",
    "primary_goal": "Cost Reduction",
    "process_stability": "No Change",
    "system_stability": "No Change",
    "task_frequency": "Daily",
    "transaction_volume": 100,
    "headcount_fte": 2,
    "avg_time_per_task_minutes": 10,
    "error_rate_pct": 5,
    "avg_rework_time_minutes": 15,
    "audit_rate_pct": 2,
    "avg_loaded_fte_cost_eur": 40000,
    "number_of_steps": "6-15",
    "decision_logic": "100% Rule-Based",
    "process_variations": "1 Standard Path",
    "primary_input_format": "Structured Digital (Excel/DB/API)",
    "number_of_systems": "1",
    "system_interface": "API Available",
    "unstructured_data": "No (Tabular/Structured)",
    "cognitive_reasoning": "No (Strict If/Then)",
    "computer_vision": "No",
    "ai_output_risk": "Strict 0% Tolerance",
}


def _seed_taxonomy_and_pick_a_process_id(db_session: Session) -> int:
    load_apqc_taxonomy_from_workbook(db_session, WORKBOOK)
    process_id = db_session.scalar(select(ApqcProcess.id).limit(1))
    assert process_id is not None
    return process_id


def test_create_idea_computes_the_documented_scoring_engine_outputs(
    db_session: Session, client: TestClient
) -> None:
    process_id = _seed_taxonomy_and_pick_a_process_id(db_session)

    response = client.post("/api/v1/ideas", json={**_VALID_PAYLOAD, "apqc_process_id": process_id})

    assert response.status_code == 201
    body = response.json()
    # 100 * 250 (Daily) = 25,000 annual transactions
    assert body["annual_transactions"] == "25000.00"
    # (25000 * 10) / 60 = 4166.67 base hours
    assert body["base_hours"] == "4166.67"
    # (25000 * 0.05 * 15) / 60 = 312.50 rework hours
    assert body["rework_hours"] == "312.50"
    assert body["total_hours_saved"] == "4479.17"
    # hourly rate = 40000 / 2000 = 20; gross ROI = 4479.1667 * 20
    assert body["gross_roi_eur"] == "89583.33"
    assert body["feasibility_score"] == 100
    assert body["feasibility_band"] == "High"
    assert body["technology_category"] == "Traditional RPA"
    assert body["final_classification"] == "Quick Win"
    assert body["status"] == "Submitted"
    assert body["l1_name"] and body["l2_name"] and body["l3_name"]


def test_feasibility_penalties_and_low_roi_deprioritize_classification(
    db_session: Session, client: TestClient
) -> None:
    process_id = _seed_taxonomy_and_pick_a_process_id(db_session)
    payload = {
        **_VALID_PAYLOAD,
        "apqc_process_id": process_id,
        "transaction_volume": 1,
        "task_frequency": "Yearly",
        "process_stability": "Major Overhaul Planned",  # -30
        "system_stability": "Platform Migration Planned",  # -20
        "decision_logic": "Requires Subjective Judgment",  # -25
        "process_variations": "6+ Custom Paths",  # -20
        "system_interface": "Citrix/Virtual Desktop",  # -15
        "primary_input_format": "Physical Paper",  # -15
    }

    response = client.post("/api/v1/ideas", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["feasibility_score"] == -25
    assert body["feasibility_band"] == "Low"
    assert body["final_classification"] == "Deprioritize / Avoid"


def test_list_ideas_returns_created_idea_with_taxonomy_path(
    db_session: Session, client: TestClient
) -> None:
    process_id = _seed_taxonomy_and_pick_a_process_id(db_session)
    created = client.post(
        "/api/v1/ideas", json={**_VALID_PAYLOAD, "apqc_process_id": process_id}
    ).json()

    listed = client.get("/api/v1/ideas")

    assert listed.status_code == 200
    assert [idea["id"] for idea in listed.json()] == [created["id"]]


def test_get_unknown_idea_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/ideas/999999")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_create_idea_with_unknown_apqc_process_returns_404(client: TestClient) -> None:
    response = client.post("/api/v1/ideas", json={**_VALID_PAYLOAD, "apqc_process_id": 999999})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
