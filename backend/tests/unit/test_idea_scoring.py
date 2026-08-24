from decimal import Decimal

from app.services.idea_scoring import (
    FeasibilityInput,
    RoiInput,
    compute_feasibility,
    compute_final_classification,
    compute_roi,
    compute_technology_category,
)

_BASE_ROI_INPUT = RoiInput(
    task_frequency="Daily",
    transaction_volume=Decimal(100),
    avg_time_per_task_minutes=Decimal(10),
    error_rate_pct=Decimal(5),
    avg_rework_time_minutes=Decimal(15),
    avg_loaded_fte_cost_eur=Decimal(40000),
)

_BASE_FEASIBILITY_INPUT = FeasibilityInput(
    process_stability="No Change",
    system_stability="No Change",
    decision_logic="100% Rule-Based",
    process_variations="1 Standard Path",
    system_interface="API Available",
    primary_input_format="Structured Digital (Excel/DB/API)",
)


def test_compute_roi_matches_the_documented_formulas() -> None:
    result = compute_roi(_BASE_ROI_INPUT)

    assert result.annual_transactions == Decimal("25000.00")
    assert result.base_hours == Decimal("4166.67")
    assert result.rework_hours == Decimal("312.50")
    assert result.total_hours_saved == Decimal("4479.17")
    assert result.gross_roi_eur == Decimal("89583.33")


def test_compute_roi_frequency_factors() -> None:
    for frequency, factor in (
        ("Daily", 250),
        ("Weekly", 52),
        ("Monthly", 12),
        ("Quarterly", 4),
        ("Yearly", 1),
    ):
        result = compute_roi(
            RoiInput(
                task_frequency=frequency,
                transaction_volume=Decimal(10),
                avg_time_per_task_minutes=Decimal(60),
                error_rate_pct=Decimal(0),
                avg_rework_time_minutes=Decimal(0),
                avg_loaded_fte_cost_eur=Decimal(2000),
            )
        )
        assert result.annual_transactions == Decimal(10 * factor)


def test_compute_feasibility_with_no_penalties_is_high() -> None:
    result = compute_feasibility(_BASE_FEASIBILITY_INPUT)

    assert result.score == 100
    assert result.band == "High"


def test_compute_feasibility_applies_every_documented_penalty() -> None:
    result = compute_feasibility(
        FeasibilityInput(
            process_stability="Major Overhaul Planned",
            system_stability="Platform Migration Planned",
            decision_logic="Requires Subjective Judgment",
            process_variations="6+ Custom Paths",
            system_interface="Citrix/Virtual Desktop",
            primary_input_format="Physical Paper",
        )
    )

    assert result.score == 100 - 30 - 20 - 25 - 20 - 15 - 15
    assert result.band == "Low"


def test_compute_feasibility_medium_band() -> None:
    result = compute_feasibility(
        FeasibilityInput(
            process_stability="Major Overhaul Planned",  # -30
            system_stability="No Change",
            decision_logic="100% Rule-Based",
            process_variations="1 Standard Path",
            system_interface="API Available",
            primary_input_format="Structured Digital (Excel/DB/API)",
        )
    )

    assert result.score == 70
    assert result.band == "Medium"


def test_compute_technology_category() -> None:
    assert (
        compute_technology_category("No (Tabular/Structured)", "No (Strict If/Then)")
        == "Traditional RPA"
    )
    assert (
        compute_technology_category("Yes - Standard Forms", "No (Strict If/Then)")
        == "RPA + AI Document Understanding"
    )
    assert (
        compute_technology_category("Yes - Free Text (Emails/Contracts)", "No (Strict If/Then)")
        == "GenAI / Agentic (LLM + Automation)"
    )
    assert (
        compute_technology_category(
            "No (Tabular/Structured)", "Yes (Summarization/Sentiment/Extraction)"
        )
        == "GenAI / Agentic (LLM + Automation)"
    )


def test_compute_final_classification() -> None:
    threshold = Decimal(50000)
    assert compute_final_classification("High", Decimal(60000), threshold) == "Quick Win"
    assert (
        compute_final_classification("Medium", Decimal(60000), threshold) == "Strategic Investment"
    )
    assert compute_final_classification("High", Decimal(10000), threshold) == "Low-Hanging Fruit"
    assert compute_final_classification("Low", Decimal(999999), threshold) == "Deprioritize / Avoid"
    # Not explicit in the spec's table -- resolved to fold into Deprioritize / Avoid.
    assert (
        compute_final_classification("Medium", Decimal(10000), threshold) == "Deprioritize / Avoid"
    )
