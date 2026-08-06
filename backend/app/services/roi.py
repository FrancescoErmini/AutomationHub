"""ROI / Business Value KPIs, process/company summaries, quick wins, cost stack.

Process-level rows expose CAPEX-based payback/ROI (legitimate: CAPEX is
recorded per process in ECONOMICS) but mark ``process_tco_available: False``
-- AMS 1L and license costs are portfolio-level with no documented
per-process allocation rule, so a full 3-year TCO cannot be computed per
process without inventing one.
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.repositories.analytics import AnalyticsRepository
from app.schemas.metrics import MetricValue, available_metric, unavailable_metric

_MONEY = Decimal("0.01")
_PCT = Decimal("0.001")


def _round_money(value: Decimal) -> float:
    return float(value.quantize(_MONEY, rounding=ROUND_HALF_UP))


def _round_pct(fraction: Decimal) -> float:
    return float((fraction * 100).quantize(_PCT, rounding=ROUND_HALF_UP))


def _roi_pct(annual_saving: Decimal, multiplier: Decimal, investment: Decimal) -> float | None:
    if investment <= 0:
        return None
    return _round_pct((annual_saving * multiplier - investment) / investment)


def _payback_months(investment: Decimal, annual_saving: Decimal) -> float | None:
    if annual_saving <= 0:
        return None
    return float(
        (investment / (annual_saving / 12)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    )


class RoiService:
    def __init__(self, repo: AnalyticsRepository) -> None:
        self._repo = repo

    def kpis(self) -> dict[str, MetricValue]:
        annual_saving = self._repo.annual_saving_eur()
        capex = self._repo.capex_eur()
        ams_1l_cost, ams_1l_years = self._repo.ams_1l_cost_recent_years(3)
        ams_2l_cost = self._repo.ams_2l_cost_total()
        license_cost, license_years = self._repo.license_cost_recent_years(3)
        run_cost_3y = ams_1l_cost + ams_2l_cost + license_cost
        tco_3y = capex + run_cost_3y
        net_benefit_3y = annual_saving * 3 - tco_3y

        warnings: list[str] = []
        if ams_1l_years < 3:
            warnings.append(f"run cost uses only {ams_1l_years} of 3 AMS 1L years")
        if license_years < 3:
            warnings.append(f"run cost uses only {license_years} of 3 license years")

        metrics: dict[str, MetricValue] = {
            "roi_annual_saving_eur": available_metric(
                "roi_annual_saving_eur", _round_money(annual_saving), "eur"
            ),
            "roi_capex_eur": available_metric("roi_capex_eur", _round_money(capex), "eur"),
            "roi_run_cost_3y_eur": available_metric(
                "roi_run_cost_3y_eur", _round_money(run_cost_3y), "eur", warnings=warnings
            ),
            "roi_tco_3y_eur": available_metric(
                "roi_tco_3y_eur", _round_money(tco_3y), "eur", warnings=warnings
            ),
            "roi_net_benefit_3y_eur": available_metric(
                "roi_net_benefit_3y_eur", _round_money(net_benefit_3y), "eur", warnings=warnings
            ),
        }

        roi_1_5y = _roi_pct(annual_saving, Decimal("1.5"), capex)
        roi_5y = _roi_pct(annual_saving, Decimal("5"), capex)
        payback = _payback_months(capex, annual_saving)
        metrics["roi_1_5y_pct"] = (
            available_metric("roi_1_5y_pct", roi_1_5y, "pct")
            if roi_1_5y is not None
            else unavailable_metric("roi_1_5y_pct", "pct", reason="capex_eur is zero")
        )
        metrics["roi_5y_pct"] = (
            available_metric("roi_5y_pct", roi_5y, "pct")
            if roi_5y is not None
            else unavailable_metric("roi_5y_pct", "pct", reason="capex_eur is zero")
        )
        metrics["roi_payback_months"] = (
            available_metric("roi_payback_months", payback, "months")
            if payback is not None
            else unavailable_metric(
                "roi_payback_months", "months", reason="annual_saving_eur is zero"
            )
        )

        if tco_3y > 0:
            roi_3y_full_cost = _round_pct(net_benefit_3y / tco_3y)
            metrics["roi_3y_full_cost_pct"] = available_metric(
                "roi_3y_full_cost_pct", roi_3y_full_cost, "pct", warnings=warnings
            )
        else:
            roi_3y_full_cost = None
            metrics["roi_3y_full_cost_pct"] = unavailable_metric(
                "roi_3y_full_cost_pct", "pct", reason="tco_3y_eur is zero"
            )

        metrics["roi_status"] = available_metric(
            "roi_status", _roi_status(roi_3y_full_cost, roi_1_5y), "label"
        )
        return metrics

    def process_summary(self) -> list[dict[str, Any]]:
        rows = []
        for (
            process_name,
            company_name,
            capex,
            fte_hours_month,
        ) in self._repo.process_economics_rows():
            bc_saving = self._repo.reference_variable("cost_per_hour_FTE") or Decimal("0")
            annual_saving = bc_saving * fte_hours_month * 12
            rows.append(
                {
                    "process": process_name,
                    "company": company_name,
                    "capex_eur": _round_money(capex),
                    "annual_saving_eur": _round_money(annual_saving),
                    "payback_months": _payback_months(capex, annual_saving),
                    "roi_1_5y_pct": _roi_pct(annual_saving, Decimal("1.5"), capex),
                    # AMS 1L / license costs have no per-process allocation rule.
                    "process_tco_available": False,
                }
            )
        return rows

    def quick_wins(self, limit: int = 5) -> list[dict[str, Any]]:
        rows = [row for row in self.process_summary() if row["payback_months"] is not None]
        rows.sort(key=lambda row: row["payback_months"])
        return rows[:limit]

    def company_summary(self) -> list[dict[str, Any]]:
        rows = []
        for company in self._repo.companies():
            annual_saving = self._repo.annual_saving_eur(company=company)
            capex = self._repo.capex_eur(company=company)
            rows.append(
                {
                    "company": company,
                    "annual_saving_eur": _round_money(annual_saving),
                    "capex_eur": _round_money(capex),
                    "roi_1_5y_pct": _roi_pct(annual_saving, Decimal("1.5"), capex),
                    "payback_months": _payback_months(capex, annual_saving),
                }
            )
        return rows

    def cost_stack(self) -> list[MetricValue]:
        capex = self._repo.capex_eur()
        ams_1l_cost, ams_1l_years = self._repo.ams_1l_cost_recent_years(3)
        ams_2l_cost = self._repo.ams_2l_cost_total()
        license_cost, license_years = self._repo.license_cost_recent_years(3)
        return [
            available_metric("roi_cost_stack_capex_eur", _round_money(capex), "eur"),
            available_metric(
                "roi_cost_stack_ams_1l_cost_eur",
                _round_money(ams_1l_cost),
                "eur",
                warnings=[] if ams_1l_years >= 3 else [f"only {ams_1l_years} of 3 AMS 1L years"],
            ),
            available_metric("roi_cost_stack_ams_2l_cost_eur", _round_money(ams_2l_cost), "eur"),
            available_metric(
                "roi_cost_stack_license_cost_eur",
                _round_money(license_cost),
                "eur",
                warnings=[] if license_years >= 3 else [f"only {license_years} of 3 license years"],
            ),
        ]


def _roi_status(roi_3y_full_cost_pct: float | None, roi_1_5y_pct: float | None) -> str:
    if roi_3y_full_cost_pct is not None and roi_3y_full_cost_pct > 0:
        return "on_track"
    if roi_1_5y_pct is not None and roi_1_5y_pct > 0:
        return "improving"
    return "at_risk"
