"""SLA / Service Performance / Data Quality KPIs.

SLA compliance reuses the same <=3-day proxy as operations (same underlying
formula, exposed under the SLA domain's own metric names for the dashboard).
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.repositories.analytics import AnalyticsRepository
from app.schemas.metrics import MetricValue, available_metric, unavailable_metric
from app.services.backlog import BACKLOG_BUCKETS, bucket_for_age

_PCT = Decimal("0.001")
_DAYS = Decimal("0.001")


def _round_pct(fraction: Decimal) -> float:
    return float((fraction * 100).quantize(_PCT, rounding=ROUND_HALF_UP))


class ServicePerformanceService:
    def __init__(self, repo: AnalyticsRepository) -> None:
        self._repo = repo

    def kpis(self, *, as_of: date | None = None) -> dict[str, MetricValue]:
        as_of = as_of or date.today()
        stats = self._repo.resolution_stats()
        metrics: dict[str, MetricValue] = {}

        if stats.closed_with_dates > 0:
            compliance = Decimal(stats.within_3_days) / stats.closed_with_dates
            metrics["sla_compliance_pct"] = available_metric(
                "sla_compliance_pct", _round_pct(compliance), "pct"
            )
            metrics["sla_breach_pct"] = available_metric(
                "sla_breach_pct", _round_pct(1 - compliance), "pct"
            )
            metrics["sla_breach_tickets"] = available_metric(
                "sla_breach_tickets", stats.closed_with_dates - stats.within_3_days, "count"
            )
        else:
            for name in ("sla_compliance_pct", "sla_breach_pct", "sla_breach_tickets"):
                unit = "count" if name == "sla_breach_tickets" else "pct"
                metrics[name] = unavailable_metric(
                    name, unit, reason="no closed tickets with valid dates"
                )

        metrics["sla_p90_resolution_days"] = (
            available_metric(
                "sla_p90_resolution_days",
                float(Decimal(str(stats.p90_days)).quantize(_DAYS, rounding=ROUND_HALF_UP)),
                "days",
            )
            if stats.p90_days is not None
            else unavailable_metric(
                "sla_p90_resolution_days", "days", reason="no closed tickets with valid dates"
            )
        )

        buckets = {name: 0 for name in BACKLOG_BUCKETS}
        for age_days in self._repo.open_ticket_ages_days(as_of=as_of):
            buckets[bucket_for_age(age_days)] += 1
        for name, count in buckets.items():
            metrics[name] = available_metric(name, count, "count")

        total, without_root_cause, without_process, without_company = self._repo.dq_counts()
        if total > 0:
            metrics["dq_root_cause_not_classified_pct"] = available_metric(
                "dq_root_cause_not_classified_pct",
                _round_pct(Decimal(without_root_cause) / total),
                "pct",
            )
            metrics["dq_tickets_without_process_mapping_pct"] = available_metric(
                "dq_tickets_without_process_mapping_pct",
                _round_pct(Decimal(without_process) / total),
                "pct",
            )
            metrics["dq_tickets_without_company_pct"] = available_metric(
                "dq_tickets_without_company_pct",
                _round_pct(Decimal(without_company) / total),
                "pct",
            )
        else:
            for name in (
                "dq_root_cause_not_classified_pct",
                "dq_tickets_without_process_mapping_pct",
                "dq_tickets_without_company_pct",
            ):
                metrics[name] = unavailable_metric(name, "pct", reason="no tickets")

        return metrics

    def sla_trend(self) -> list[dict[str, Any]]:
        return [
            {"period": period, "value": count} for period, count in self._repo.tickets_by_month()
        ]

    def avg_resolution_by_root_cause(self) -> list[dict[str, Any]]:
        return [
            {"label": name, "avg_days": float(avg)}
            for name, avg in self._repo.avg_resolution_by("root_cause")
        ]

    def avg_resolution_by_process(self) -> list[dict[str, Any]]:
        return [
            {"label": name, "avg_days": float(avg)}
            for name, avg in self._repo.avg_resolution_by("process")
        ]

    def avg_resolution_by_company(self) -> list[dict[str, Any]]:
        return [
            {"label": name, "avg_days": float(avg)}
            for name, avg in self._repo.avg_resolution_by("company")
        ]

    def data_quality_summary(self) -> list[MetricValue]:
        kpis = self.kpis()
        return [
            kpis["dq_root_cause_not_classified_pct"],
            kpis["dq_tickets_without_process_mapping_pct"],
            kpis["dq_tickets_without_company_pct"],
        ]
