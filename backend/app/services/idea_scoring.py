"""Idea submission scoring engine: ROI, Feasibility, Technology Category, and
Final Classification, computed server-side from the wizard's raw answers per
the formulas in .claude/specs/feature-01-idea-submission.md.

Pure functions only (no DB access) so they can be unit-tested directly and
ported 1:1 to the frontend's client-side preview mirror
(frontend/src/lib/ideaScoring.ts).
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

FREQUENCY_FACTORS: dict[str, int] = {
    "Daily": 250,
    "Weekly": 52,
    "Monthly": 12,
    "Quarterly": 4,
    "Yearly": 1,
}

_WORK_HOURS_PER_YEAR = Decimal(250 * 8)
_MONEY = Decimal("0.01")
_HOURS = Decimal("0.01")


def _round_money(value: Decimal) -> Decimal:
    return value.quantize(_MONEY, rounding=ROUND_HALF_UP)


def _round_hours(value: Decimal) -> Decimal:
    return value.quantize(_HOURS, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class RoiInput:
    task_frequency: str
    transaction_volume: Decimal
    avg_time_per_task_minutes: Decimal
    error_rate_pct: Decimal
    avg_rework_time_minutes: Decimal
    avg_loaded_fte_cost_eur: Decimal


@dataclass(frozen=True)
class RoiResult:
    annual_transactions: Decimal
    base_hours: Decimal
    rework_hours: Decimal
    total_hours_saved: Decimal
    gross_roi_eur: Decimal


def compute_roi(payload: RoiInput) -> RoiResult:
    frequency_factor = Decimal(FREQUENCY_FACTORS[payload.task_frequency])
    annual_transactions = payload.transaction_volume * frequency_factor
    base_hours = (annual_transactions * payload.avg_time_per_task_minutes) / 60
    # error_rate_pct is entered as a percentage (e.g. "5" for 5%), so divide by 100.
    rework_hours = (
        annual_transactions * (payload.error_rate_pct / 100) * payload.avg_rework_time_minutes
    ) / 60
    total_hours_saved = base_hours + rework_hours
    hourly_rate = payload.avg_loaded_fte_cost_eur / _WORK_HOURS_PER_YEAR
    gross_roi_eur = total_hours_saved * hourly_rate
    return RoiResult(
        annual_transactions=_round_hours(annual_transactions),
        base_hours=_round_hours(base_hours),
        rework_hours=_round_hours(rework_hours),
        total_hours_saved=_round_hours(total_hours_saved),
        gross_roi_eur=_round_money(gross_roi_eur),
    )


@dataclass(frozen=True)
class FeasibilityInput:
    process_stability: str
    system_stability: str
    decision_logic: str
    process_variations: str
    system_interface: str
    primary_input_format: str


@dataclass(frozen=True)
class FeasibilityResult:
    score: int
    band: str


_FEASIBILITY_PENALTIES: tuple[tuple[str, str, int], ...] = (
    ("process_stability", "Major Overhaul Planned", 30),
    ("system_stability", "Platform Migration Planned", 20),
    ("decision_logic", "Requires Subjective Judgment", 25),
    ("process_variations", "6+ Custom Paths", 20),
    ("system_interface", "Citrix/Virtual Desktop", 15),
    ("primary_input_format", "Physical Paper", 15),
)


def compute_feasibility(payload: FeasibilityInput) -> FeasibilityResult:
    score = 100
    for field, trigger_value, penalty in _FEASIBILITY_PENALTIES:
        if getattr(payload, field) == trigger_value:
            score -= penalty
    if score >= 80:
        band = "High"
    elif score >= 50:
        band = "Medium"
    else:
        band = "Low"
    return FeasibilityResult(score=score, band=band)


def compute_technology_category(unstructured_data: str, cognitive_reasoning: str) -> str:
    if (
        unstructured_data == "Yes - Free Text (Emails/Contracts)"
        or cognitive_reasoning == "Yes (Summarization/Sentiment/Extraction)"
    ):
        return "GenAI / Agentic (LLM + Automation)"
    if unstructured_data == "Yes - Standard Forms":
        return "RPA + AI Document Understanding"
    return "Traditional RPA"


def compute_final_classification(
    feasibility_band: str, gross_roi_eur: Decimal, roi_threshold_eur: Decimal
) -> str:
    if feasibility_band == "Low":
        return "Deprioritize / Avoid"
    is_high_roi = gross_roi_eur >= roi_threshold_eur
    if feasibility_band == "High":
        return "Quick Win" if is_high_roi else "Low-Hanging Fruit"
    # Medium feasibility
    return "Strategic Investment" if is_high_roi else "Deprioritize / Avoid"
