"""RPA AMS Operations KPIs: ticket volume, resolution, cost per ticket,
root-cause pareto, top processes, backlog aging.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.repositories.analytics import AnalyticsRepository
from app.schemas.metrics import MetricValue, available_metric, unavailable_metric
from app.services.backlog import BACKLOG_BUCKETS, bucket_for_age

_MONEY = Decimal("0.01")
_PCT = Decimal("0.001")
_RATIO = Decimal("0.0001")


def _round_money(value: Decimal) -> float:
    return float(value.quantize(_MONEY, rounding=ROUND_HALF_UP))


def _round_pct(fraction: Decimal) -> float:
    return float((fraction * 100).quantize(_PCT, rounding=ROUND_HALF_UP))


def _round_ratio(fraction: Decimal) -> float:
    return float(fraction.quantize(_RATIO, rounding=ROUND_HALF_UP))


class OperationsService:
    def __init__(self, repo: AnalyticsRepository) -> None:
        self._repo = repo

    def kpis(self, *, company: str | None = None) -> dict[str, MetricValue]:
        filters: dict[str, Any] = {"company": company} if company else {}
        counts = self._repo.ticket_counts(company=company)
        stats = self._repo.resolution_stats(company=company)

        metrics: dict[str, MetricValue] = {
            "ops_total_tickets": available_metric(
                "ops_total_tickets", counts.total, "count", filters=filters
            ),
            "ops_closed_tickets": available_metric(
                "ops_closed_tickets", counts.closed, "count", filters=filters
            ),
            "ops_open_backlog": available_metric(
                "ops_open_backlog", counts.open, "count", filters=filters
            ),
            "ops_l1_tickets": available_metric(
                "ops_l1_tickets", counts.l1, "count", filters=filters
            ),
            "ops_l2_tickets": available_metric(
                "ops_l2_tickets", counts.l2, "count", filters=filters
            ),
        }

        if counts.total > 0:
            metrics["ops_l1_ratio"] = available_metric(
                "ops_l1_ratio",
                _round_ratio(Decimal(counts.l1) / counts.total),
                "ratio",
                filters=filters,
            )
            metrics["ops_l2_ratio"] = available_metric(
                "ops_l2_ratio",
                _round_ratio(Decimal(counts.l2) / counts.total),
                "ratio",
                filters=filters,
            )
        else:
            metrics["ops_l1_ratio"] = unavailable_metric(
                "ops_l1_ratio", "ratio", reason="no tickets", filters=filters
            )
            metrics["ops_l2_ratio"] = unavailable_metric(
                "ops_l2_ratio", "ratio", reason="no tickets", filters=filters
            )

        metrics["ops_avg_resolution_days"] = (
            available_metric(
                "ops_avg_resolution_days", float(stats.avg_days), "days", filters=filters
            )
            if stats.avg_days is not None
            else unavailable_metric(
                "ops_avg_resolution_days",
                "days",
                reason="no closed tickets with valid dates",
                filters=filters,
            )
        )
        metrics["ops_median_resolution_days"] = (
            available_metric(
                "ops_median_resolution_days", float(stats.median_days), "days", filters=filters
            )
            if stats.median_days is not None
            else unavailable_metric(
                "ops_median_resolution_days",
                "days",
                reason="no closed tickets with valid dates",
                filters=filters,
            )
        )
        metrics["ops_p90_resolution_days"] = (
            available_metric(
                "ops_p90_resolution_days", float(stats.p90_days), "days", filters=filters
            )
            if stats.p90_days is not None
            else unavailable_metric(
                "ops_p90_resolution_days",
                "days",
                reason="no closed tickets with valid dates",
                filters=filters,
            )
        )

        if stats.closed_with_dates > 0:
            sla_pct = Decimal(stats.within_3_days) / stats.closed_with_dates
            metrics["ops_sla_proxy_le_3d_pct"] = available_metric(
                "ops_sla_proxy_le_3d_pct", _round_pct(sla_pct), "pct", filters=filters
            )
            metrics["ops_sla_breach_pct"] = available_metric(
                "ops_sla_breach_pct", _round_pct(1 - sla_pct), "pct", filters=filters
            )
        else:
            metrics["ops_sla_proxy_le_3d_pct"] = unavailable_metric(
                "ops_sla_proxy_le_3d_pct",
                "pct",
                reason="no closed tickets with valid dates",
                filters=filters,
            )
            metrics["ops_sla_breach_pct"] = unavailable_metric(
                "ops_sla_breach_pct",
                "pct",
                reason="no closed tickets with valid dates",
                filters=filters,
            )

        ams_1l_cost, _ = self._repo.ams_1l_cost_recent_years(3)
        ams_2l_cost = self._repo.ams_2l_cost_total(company=company)
        license_cost, _ = self._repo.license_cost_recent_years(3)
        if counts.total > 0:
            run_cost = ams_1l_cost + ams_2l_cost + license_cost
            metrics["ops_cost_per_ticket"] = available_metric(
                "ops_cost_per_ticket", _round_money(run_cost / counts.total), "eur", filters=filters
            )
        else:
            metrics["ops_cost_per_ticket"] = unavailable_metric(
                "ops_cost_per_ticket", "eur", reason="no tickets", filters=filters
            )

        ams_2l_ticket_count = self._repo.ams_2l_ticket_count()
        if ams_2l_ticket_count > 0:
            metrics["ops_l2_cost_per_ticket"] = available_metric(
                "ops_l2_cost_per_ticket",
                _round_money(ams_2l_cost / ams_2l_ticket_count),
                "eur",
                filters=filters,
            )
        else:
            metrics["ops_l2_cost_per_ticket"] = unavailable_metric(
                "ops_l2_cost_per_ticket", "eur", reason="no AMS 2L costed tickets", filters=filters
            )

        return metrics

    def tickets_by_month(self) -> list[dict[str, Any]]:
        return [
            {"period": period, "value": count} for period, count in self._repo.tickets_by_month()
        ]

    def l1_vs_l2_by_month(self) -> list[dict[str, Any]]:
        return [
            {"period": period, "l1": l1, "l2": l2}
            for period, l1, l2 in self._repo.l1_vs_l2_by_month()
        ]

    def root_cause_pareto(self) -> list[dict[str, Any]]:
        return [
            {"root_cause": name, "count": count} for name, count in self._repo.root_cause_pareto()
        ]

    def top_processes(self, limit: int = 10) -> list[dict[str, Any]]:
        return [
            {"process": name, "ticket_count": count}
            for name, count in self._repo.top_processes_by_ticket_volume(limit)
        ]

    def backlog_aging(self, *, as_of: date | None = None) -> dict[str, int]:
        as_of = as_of or date.today()
        buckets = {name: 0 for name in BACKLOG_BUCKETS}
        for age_days in self._repo.open_ticket_ages_days(as_of=as_of):
            buckets[bucket_for_age(age_days)] += 1
        return buckets
