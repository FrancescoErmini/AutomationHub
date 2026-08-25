"""CIO Executive Overview KPIs, trends, company summary, and cost breakdown.

Every scalar KPI is returned as a ``MetricValue`` envelope; unavailable
metrics carry ``value=None`` rather than a fabricated zero. AMS 1L and
license costs are portfolio-level with no documented per-process or
per-company allocation rule, so any metric derived from ``run_cost_3y_eur``
becomes unavailable the moment a ``company`` filter is applied -- attributing
the full portfolio run cost to one company would misrepresent it.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.repositories.analytics import AnalyticsRepository
from app.schemas.metrics import MetricValue, available_metric, unavailable_metric
from app.services.simple_ops import SimpleOpsService

_MONEY = Decimal("0.01")
_PCT = Decimal("0.001")


def _payback_months(investment: Decimal, annual_saving: Decimal) -> float | None:
    if annual_saving <= 0:
        return None
    return float(
        (investment / (annual_saving / 12)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    )


def _roi_pct(annual_saving: Decimal, multiplier: Decimal, investment: Decimal) -> float | None:
    if investment <= 0:
        return None
    return _round_pct((annual_saving * multiplier - investment) / investment)


def _months_elapsed(start: date, as_of: date) -> int:
    if as_of < start:
        return 0
    months = (as_of.year - start.year) * 12 + (as_of.month - start.month)
    if as_of.day < start.day:
        months -= 1
    return max(months, 0)


def _round_money(value: Decimal) -> float:
    return float(value.quantize(_MONEY, rounding=ROUND_HALF_UP))


def _round_pct(fraction: Decimal) -> float:
    return float((fraction * 100).quantize(_PCT, rounding=ROUND_HALF_UP))


class ExecutiveService:
    def __init__(self, repo: AnalyticsRepository, simple_ops: SimpleOpsService) -> None:
        self._repo = repo
        self._simple_ops = simple_ops

    def kpis(self, *, company: str | None = None) -> dict[str, MetricValue]:
        filters: dict[str, Any] = {"company": company} if company else {}

        annual_saving = self._repo.annual_saving_eur(company=company)
        capex = self._repo.capex_eur(company=company)
        ticket_counts = self._repo.ticket_counts(company=company)
        saving_by_month = self.trends(company=company)["saving_by_month"]
        total_saved_to_date = (
            Decimal(str(saving_by_month[-1]["value"])) if saving_by_month else Decimal("0")
        )

        metrics: dict[str, MetricValue] = {
            "kpi_annual_saving_eur": available_metric(
                "kpi_annual_saving_eur", _round_money(annual_saving), "eur", filters=filters
            ),
            "kpi_total_capex_eur": available_metric(
                "kpi_total_capex_eur", _round_money(capex), "eur", filters=filters
            ),
            "kpi_total_saved_to_date_eur": available_metric(
                "kpi_total_saved_to_date_eur",
                _round_money(total_saved_to_date),
                "eur",
                filters=filters,
            ),
            "kpi_total_tickets": available_metric(
                "kpi_total_tickets", ticket_counts.total, "count", filters=filters
            ),
        }

        if company is not None:
            reason = (
                "AMS 1L and license costs are portfolio-level with no documented "
                "per-company allocation rule"
            )
            metrics["kpi_total_spend_to_date_eur"] = unavailable_metric(
                "kpi_total_spend_to_date_eur", "eur", reason=reason, filters=filters
            )
            metrics["kpi_net_position_eur"] = unavailable_metric(
                "kpi_net_position_eur", "eur", reason=reason, filters=filters
            )
            return metrics

        total_spend_to_date = sum(
            (Decimal(str(row["total_eur"])) for row in self.tco_trend()), Decimal("0")
        )
        net_position = total_saved_to_date - total_spend_to_date
        metrics["kpi_total_spend_to_date_eur"] = available_metric(
            "kpi_total_spend_to_date_eur", _round_money(total_spend_to_date), "eur", filters=filters
        )
        metrics["kpi_net_position_eur"] = available_metric(
            "kpi_net_position_eur", _round_money(net_position), "eur", filters=filters
        )
        return metrics

    def trends(self, *, company: str | None = None) -> dict[str, list[dict[str, Any]]]:
        contributions = self._repo.annual_saving_contribution_by_month(company=company)
        cumulative = Decimal("0")
        saving_by_month: list[dict[str, Any]] = []
        for period, amount in contributions:
            cumulative += amount
            saving_by_month.append({"period": period, "value": _round_money(cumulative)})

        tickets_by_month = [
            {"period": period, "value": count}
            for period, count in self._repo.tickets_by_month(company=company)
        ]
        return {"saving_by_month": saving_by_month, "tickets_by_month": tickets_by_month}

    def company_summary(self) -> list[dict[str, Any]]:
        rows = []
        for company in self._repo.companies():
            annual_saving = self._repo.annual_saving_eur(company=company)
            capex = self._repo.capex_eur(company=company)
            ticket_counts = self._repo.ticket_counts(company=company)
            roi_1_5y = None
            if capex > 0:
                roi_1_5y = _round_pct((annual_saving * Decimal("1.5") - capex) / capex)
            rows.append(
                {
                    "company": company,
                    "annual_saving_eur": _round_money(annual_saving),
                    "capex_eur": _round_money(capex),
                    "total_tickets": ticket_counts.total,
                    "roi_1_5y_pct": roi_1_5y,
                }
            )
        return rows

    def cost_breakdown(self) -> list[MetricValue]:
        capex = self._repo.capex_eur()
        ams_1l_cost, ams_1l_years = self._repo.ams_1l_cost_recent_years(3)
        ams_2l_cost = self._repo.ams_2l_cost_total()
        license_cost, license_years = self._repo.license_cost_recent_years(3)

        return [
            available_metric("cost_breakdown_capex_eur", _round_money(capex), "eur"),
            available_metric(
                "cost_breakdown_ams_1l_cost_eur",
                _round_money(ams_1l_cost),
                "eur",
                warnings=[] if ams_1l_years >= 3 else [f"only {ams_1l_years} of 3 AMS 1L years"],
            ),
            available_metric("cost_breakdown_ams_2l_cost_eur", _round_money(ams_2l_cost), "eur"),
            available_metric(
                "cost_breakdown_license_cost_eur",
                _round_money(license_cost),
                "eur",
                warnings=[] if license_years >= 3 else [f"only {license_years} of 3 license years"],
            ),
        ]

    def tco_trend(self) -> list[dict[str, Any]]:
        """Per-year TCO decomposition: CAPEX (own query, by go-live year) plus
        license/infrastructure/AMS running cost, sourced from SimpleOpsService
        rather than re-derived -- those formulas already live there."""
        capex_by_year = self._repo.capex_by_year()
        license_by_year = {p["year"]: p["cost_eur"] for p in self._simple_ops.license_cost_trend()}
        infra_by_year = {
            p["year"]: p["cost_eur"] for p in self._simple_ops.infrastructure()["trend"]
        }
        ams = self._simple_ops.ams_trend()
        ams_1l_by_year = {p["year"]: p["cost_eur"] for p in ams["l1"]}
        ams_2l_by_year = {p["year"]: p["cost_eur"] for p in ams["l2"]}

        years = sorted(
            set(capex_by_year)
            | set(license_by_year)
            | set(infra_by_year)
            | set(ams_1l_by_year)
            | set(ams_2l_by_year)
        )
        rows = []
        for year in years:
            capex = float(capex_by_year.get(year, Decimal("0")))
            license_eur = license_by_year.get(year, 0.0)
            infra_eur = infra_by_year.get(year, 0.0)
            ams_eur = ams_1l_by_year.get(year, 0.0) + ams_2l_by_year.get(year, 0.0)
            rows.append(
                {
                    "year": year,
                    "capex_eur": round(capex, 2),
                    "license_eur": round(license_eur, 2),
                    "infrastructure_eur": round(infra_eur, 2),
                    "ams_eur": round(ams_eur, 2),
                    "total_eur": round(capex + license_eur + infra_eur + ams_eur, 2),
                }
            )
        return rows

    def savings_payback_trend(self) -> list[dict[str, Any]]:
        """Cumulative spend (running CAPEX + running-cost total, from
        tco_trend) vs. cumulative realized saving (from the existing
        go-live-month saving ramp), one point per real year -- the portfolio
        payback curve."""
        tco_rows = self.tco_trend()
        cumulative_by_month = self.trends()["saving_by_month"]

        rows = []
        running_spend = Decimal("0")
        for tco_row in tco_rows:
            year = tco_row["year"]
            running_spend += Decimal(str(tco_row["total_eur"]))
            cumulative_saving = Decimal("0")
            for point in cumulative_by_month:
                point_year = int(point["period"][:4])
                if point_year <= year:
                    cumulative_saving = Decimal(str(point["value"]))
                else:
                    break
            rows.append(
                {
                    "year": year,
                    "cumulative_spend_eur": _round_money(running_spend),
                    "cumulative_saving_eur": _round_money(cumulative_saving),
                }
            )
        return rows

    def process_roi_table(
        self, *, company: str | None = None, as_of: date | None = None
    ) -> list[dict[str, Any]]:
        as_of = as_of or date.today()
        bc_saving = self._repo.reference_variable("cost_per_hour_FTE") or Decimal("0")

        rows: list[dict[str, Any]] = []
        for (
            process_name,
            company_name,
            capex,
            fte_hours_month,
            go_live_date,
            roi_expected_yr,
        ) in self._repo.process_roi_rows():
            if company is not None and company_name != company:
                continue
            annual_saving = bc_saving * fte_hours_month * 12
            months_live = _months_elapsed(go_live_date, as_of) if go_live_date else 0
            cumulative_saving = (annual_saving / 12) * months_live

            expected_roi_pct = (
                _roi_pct(annual_saving, Decimal(roi_expected_yr), capex)
                if roi_expected_yr is not None
                else None
            )
            actual_roi_pct = _roi_pct(cumulative_saving, Decimal("1"), capex)

            rows.append(
                {
                    "process": process_name,
                    "company": company_name,
                    "go_live_date": go_live_date,
                    "capex_eur": _round_money(capex),
                    "annual_saving_eur": _round_money(annual_saving),
                    "payback_months": _payback_months(capex, annual_saving),
                    "cumulative_saving_since_go_live_eur": _round_money(cumulative_saving),
                    "expected_roi_pct": expected_roi_pct,
                    "actual_roi_pct": actual_roi_pct,
                }
            )

        rows.sort(
            key=lambda row: (row["actual_roi_pct"] is None, -(row["actual_roi_pct"] or 0))
        )
        return rows
