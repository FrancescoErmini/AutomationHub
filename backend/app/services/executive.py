"""CIO Executive Overview KPIs, trends, company summary, and cost breakdown.

Every scalar KPI is returned as a ``MetricValue`` envelope; unavailable
metrics carry ``value=None`` rather than a fabricated zero. AMS 1L and
license costs are portfolio-level with no documented per-process or
per-company allocation rule, so any metric derived from ``run_cost_3y_eur``
becomes unavailable the moment a ``company`` filter is applied -- attributing
the full portfolio run cost to one company would misrepresent it.
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.repositories.analytics import AnalyticsRepository
from app.schemas.metrics import MetricValue, available_metric, unavailable_metric
from app.services.simple_ops import SimpleOpsService

_MONEY = Decimal("0.01")
_PCT = Decimal("0.001")


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

        metrics: dict[str, MetricValue] = {
            "kpi_annual_saving_eur": available_metric(
                "kpi_annual_saving_eur", _round_money(annual_saving), "eur", filters=filters
            ),
            "kpi_total_tickets": available_metric(
                "kpi_total_tickets", ticket_counts.total, "count", filters=filters
            ),
        }

        if capex > 0:
            roi_1_5y = (annual_saving * Decimal("1.5") - capex) / capex
            metrics["kpi_roi_1_5y_ok_pct"] = available_metric(
                "kpi_roi_1_5y_ok_pct", _round_pct(roi_1_5y), "pct", filters=filters
            )
        else:
            metrics["kpi_roi_1_5y_ok_pct"] = unavailable_metric(
                "kpi_roi_1_5y_ok_pct", "pct", reason="capex_eur is zero", filters=filters
            )

        run_cost_names = (
            "kpi_run_cost_3y_eur",
            "kpi_tco_3y_eur",
            "kpi_net_benefit_3y_eur",
            "kpi_roi_3y_full_cost_pct",
        )
        if company is not None:
            reason = (
                "AMS 1L and license costs are portfolio-level with no documented "
                "per-company allocation rule"
            )
            for name in run_cost_names:
                unit = "pct" if name.endswith("pct") else "eur"
                metrics[name] = unavailable_metric(name, unit, reason=reason, filters=filters)
            return metrics

        ams_1l_cost, ams_1l_years = self._repo.ams_1l_cost_recent_years(3)
        ams_2l_cost = self._repo.ams_2l_cost_total()
        license_cost, license_years = self._repo.license_cost_recent_years(3)
        run_cost_3y = ams_1l_cost + ams_2l_cost + license_cost
        tco_3y = capex + run_cost_3y
        net_benefit_3y = annual_saving * 3 - tco_3y

        warnings: list[str] = []
        if ams_1l_years < 3:
            warnings.append(f"kpi_run_cost_3y_eur uses only {ams_1l_years} of 3 AMS 1L years")
        if license_years < 3:
            warnings.append(f"kpi_run_cost_3y_eur uses only {license_years} of 3 license years")

        metrics["kpi_run_cost_3y_eur"] = available_metric(
            "kpi_run_cost_3y_eur",
            _round_money(run_cost_3y),
            "eur",
            filters=filters,
            warnings=warnings,
        )
        metrics["kpi_tco_3y_eur"] = available_metric(
            "kpi_tco_3y_eur", _round_money(tco_3y), "eur", filters=filters, warnings=warnings
        )
        metrics["kpi_net_benefit_3y_eur"] = available_metric(
            "kpi_net_benefit_3y_eur",
            _round_money(net_benefit_3y),
            "eur",
            filters=filters,
            warnings=warnings,
        )
        if tco_3y > 0:
            metrics["kpi_roi_3y_full_cost_pct"] = available_metric(
                "kpi_roi_3y_full_cost_pct",
                _round_pct(net_benefit_3y / tco_3y),
                "pct",
                filters=filters,
                warnings=warnings,
            )
        else:
            metrics["kpi_roi_3y_full_cost_pct"] = unavailable_metric(
                "kpi_roi_3y_full_cost_pct", "pct", reason="tco_3y_eur is zero", filters=filters
            )
        return metrics

    def trends(self) -> dict[str, list[dict[str, Any]]]:
        contributions = self._repo.annual_saving_contribution_by_month()
        cumulative = Decimal("0")
        saving_by_month: list[dict[str, Any]] = []
        for period, amount in contributions:
            cumulative += amount
            saving_by_month.append({"period": period, "value": _round_money(cumulative)})

        tickets_by_month = [
            {"period": period, "value": count} for period, count in self._repo.tickets_by_month()
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
