"""Simple Ops dashboard: running cost, infrastructure, AMS 1L/2L, SLA quality,
and per-process cost breakdown -- fuels the "Simple Ops" page, a data-driven
replica of the Claude Design "Dashboard Costi Running RPA" mockup.

Formulas here follow docs/dashboard_costi_running_rpa_data_assessment.md and
the user's ==> MY_REVIEW decisions in that file:
  total running cost(Y) = license_cost(Y) + ams_1l_cost(Y)
                           + (2L tickets opened in Y x EUR 500)
                           + Sigma ams_rfc_cost(Y)   ["Change Request"]
  per-process breakdown(Y) uses the *actual* AMS 2L cost, not the flat rate.
Scalar KPIs use the existing MetricValue envelope; chart/table payloads are
plain dicts, matching ExecutiveService/OperationsService conventions.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.repositories.analytics import AnalyticsRepository
from app.schemas.metrics import MetricValue, available_metric, unavailable_metric
from app.services.sla_config import (
    KPI_THRESHOLDS,
    SLA_ATTAINMENT_CAVEAT,
    SLA_COMMITMENTS,
    attainment_status,
    band_for_priority,
    normalise_ticket_type,
    parse_einstein_priority,
    repair_target_days,
    resolved_targets,
    status_for,
)

_MONEY = Decimal("0.01")
_PCT = Decimal("0.001")
_FLAT_2L_RATE_EUR = Decimal("500")

# Time-slot -> heatmap column. No source column exists for the ordering, so
# this is a presentational choice: the 6 categories from the assessment
# mapped onto the mockup's 6 fixed 4-hour columns.
_TIME_SLOT_COLUMNS = [
    ("night", "00-04"),
    ("early_morning", "04-08"),
    ("morning", "08-12"),
    ("afternoon", "12-16"),
    ("evening", "16-20"),
    ("late_evening", "20-24"),
]


def _round_money(value: Decimal) -> float:
    return float(value.quantize(_MONEY, rounding=ROUND_HALF_UP))


def _round_pct(fraction: Decimal) -> float:
    return float((fraction * 100).quantize(_PCT, rounding=ROUND_HALF_UP))


def _sla_card(
    key: str, label: str, value: float | None, unit: str, target_label: str, status: str
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "value": value,
        "unit": unit,
        "target_label": target_label,
        "status": status,
        "available": value is not None,
    }


class SimpleOpsService:
    def __init__(self, repo: AnalyticsRepository) -> None:
        self._repo = repo

    def _year_components(self, year: int) -> dict[str, Any]:
        license_eur = self._repo.license_cost_by_year([year]).get(year, Decimal("0"))
        licensed_vm_count = self._repo.licensed_vm_count_by_year([year]).get(year, 0)
        infra_eur = self._repo.vm_cost_by_year([year]).get(year, Decimal("0"))
        ams_1l_by_year = {y: (fee, n) for y, fee, n in self._repo.ams_1l_by_year()}
        ams_1l_eur, ams_1l_processes = ams_1l_by_year.get(year, (Decimal("0"), None))
        ticket_2l_count = self._repo.ams_2l_ticket_count_by_year([year]).get(year, 0)
        ticket_2l_eur = Decimal(ticket_2l_count) * _FLAT_2L_RATE_EUR
        rfc_eur = self._repo.ams_rfc_cost_by_year([year]).get(year, Decimal("0"))
        rfc_count = self._repo.ams_rfc_count_by_year([year]).get(year, 0)
        total_eur = license_eur + infra_eur + ams_1l_eur + ticket_2l_eur + rfc_eur
        return {
            "license_eur": license_eur,
            "licensed_vm_count": licensed_vm_count,
            "infra_eur": infra_eur,
            "ams_1l_eur": ams_1l_eur,
            "ams_1l_processes": ams_1l_processes,
            "ticket_2l_count": ticket_2l_count,
            "ticket_2l_eur": ticket_2l_eur,
            "rfc_eur": rfc_eur,
            "rfc_count": rfc_count,
            "total_eur": total_eur,
        }

    def header_kpis(self, year: int) -> dict[str, MetricValue]:
        current = self._year_components(year)
        prior = self._year_components(year - 1)
        process_count = self._repo.process_count()

        def delta_pct(curr: Decimal, prev: Decimal) -> float | None:
            if prev == 0:
                return None
            return _round_pct((curr - prev) / prev)

        metrics: dict[str, MetricValue] = {
            "kpi_total_running_cost_eur": available_metric(
                "kpi_total_running_cost_eur", _round_money(current["total_eur"]), "eur"
            ),
            "kpi_process_count": available_metric("kpi_process_count", process_count, "count"),
            "kpi_license_cost_eur": available_metric(
                "kpi_license_cost_eur", _round_money(current["license_eur"]), "eur"
            ),
            "kpi_licensed_vm_count": available_metric(
                "kpi_licensed_vm_count", current["licensed_vm_count"], "count"
            ),
            "kpi_infrastructure_cost_eur": available_metric(
                "kpi_infrastructure_cost_eur", _round_money(current["infra_eur"]), "eur"
            ),
            "kpi_ams_1l_cost_eur": available_metric(
                "kpi_ams_1l_cost_eur", _round_money(current["ams_1l_eur"]), "eur"
            ),
            "kpi_ticket_2l_cost_eur": available_metric(
                "kpi_ticket_2l_cost_eur", _round_money(current["ticket_2l_eur"]), "eur"
            ),
            "kpi_ticket_2l_count": available_metric(
                "kpi_ticket_2l_count", current["ticket_2l_count"], "count"
            ),
            "kpi_change_request_cost_eur": available_metric(
                "kpi_change_request_cost_eur", _round_money(current["rfc_eur"]), "eur"
            ),
            "kpi_change_request_count": available_metric(
                "kpi_change_request_count", current["rfc_count"], "count"
            ),
        }

        if process_count > 0:
            metrics["kpi_avg_cost_per_process_eur"] = available_metric(
                "kpi_avg_cost_per_process_eur",
                _round_money(current["total_eur"] / process_count),
                "eur",
            )
        else:
            metrics["kpi_avg_cost_per_process_eur"] = unavailable_metric(
                "kpi_avg_cost_per_process_eur", "eur", reason="no processes"
            )

        for metric_key, component_key in (
            ("kpi_total_running_cost_delta_pct", "total_eur"),
            ("kpi_license_cost_delta_pct", "license_eur"),
            ("kpi_infrastructure_cost_delta_pct", "infra_eur"),
            ("kpi_ams_1l_cost_delta_pct", "ams_1l_eur"),
            ("kpi_ticket_2l_cost_delta_pct", "ticket_2l_eur"),
            ("kpi_change_request_cost_delta_pct", "rfc_eur"),
        ):
            delta = delta_pct(current[component_key], prior[component_key])
            metrics[metric_key] = (
                available_metric(metric_key, delta, "pct")
                if delta is not None
                else unavailable_metric(metric_key, "pct", reason=f"no {year - 1} data")
            )

        return metrics

    def running_cost_trend(self) -> list[dict[str, Any]]:
        """Per-year breakdown (license + infrastructure + AMS 1L + 2L tickets
        flat rate + change requests) for every year that has data for *any*
        component (see AnalyticsRepository.cost_years). Only real data -- no
        forward-looking estimate."""
        years = self._repo.cost_years()
        if not years:
            return []

        points = []
        for year in years:
            c = self._year_components(year)
            points.append(
                {
                    "year": year,
                    "license_eur": _round_money(c["license_eur"]),
                    "infrastructure_eur": _round_money(c["infra_eur"]),
                    "ams_1l_eur": _round_money(c["ams_1l_eur"]),
                    "ticket_2l_eur": _round_money(c["ticket_2l_eur"]),
                    "change_request_eur": _round_money(c["rfc_eur"]),
                    "total_eur": _round_money(c["total_eur"]),
                }
            )
        return points

    def license_cost_trend(self) -> list[dict[str, Any]]:
        years = self._repo.cost_years()
        by_year = self._repo.license_cost_by_year(years)
        return [
            {"year": year, "cost_eur": _round_money(by_year.get(year, Decimal("0")))}
            for year in years
        ]

    def infrastructure(self) -> dict[str, Any]:
        years = self._repo.cost_years()
        by_year = self._repo.vm_cost_by_year(years)
        trend = [
            {"year": year, "cost_eur": _round_money(by_year.get(year, Decimal("0")))}
            for year in years
        ]
        return {
            "trend": trend,
            "tbd": all(point["cost_eur"] == 0 for point in trend),
            "vm_count": self._repo.virtual_machine_count(),
            "db_count": self._repo.process_count(),
        }

    def occupancy_heatmap(self) -> list[dict[str, Any]]:
        raw = self._repo.occupancy_heatmap()
        vms = sorted({vm for vm, _, _ in raw})
        counts = {(vm, slot): count for vm, slot, count in raw}
        max_count = max((count for _, _, count in raw), default=0)
        rows = []
        for vm in vms:
            cells = []
            for slot_key, slot_label in _TIME_SLOT_COLUMNS:
                count = counts.get((vm, slot_key), 0)
                intensity = round((count / max_count) * 100) if max_count else 0
                cells.append(
                    {
                        "slot": slot_key,
                        "label": slot_label,
                        "count": count,
                        "intensity": intensity,
                    }
                )
            rows.append({"vm": vm, "cells": cells})
        return rows

    def ams_trend(self) -> dict[str, Any]:
        years = self._repo.cost_years()
        ams_1l = {y: (fee, n) for y, fee, n in self._repo.ams_1l_by_year()}
        ams_2l = self._repo.ams_2l_actual_cost_by_year(years)
        return {
            "l1": [
                {
                    "year": year,
                    "cost_eur": _round_money(ams_1l[year][0]),
                    "process_count": ams_1l[year][1],
                }
                for year in years
                if year in ams_1l
            ],
            "l2": [
                {
                    "year": year,
                    "cost_eur": _round_money(ams_2l.get(year, (Decimal("0"), 0))[0]),
                    "ticket_count": ams_2l.get(year, (Decimal("0"), 0))[1],
                }
                for year in years
            ],
        }

    def sla_kpis(self, year: int, *, as_of: date | None = None) -> list[dict[str, Any]]:
        as_of = as_of or date.today()

        def card(key: str, label: str, value: float | None, unit: str) -> dict[str, Any]:
            thr = KPI_THRESHOLDS[key]
            status = (
                status_for(value, thr.op, thr.value, thr.amber_band)
                if value is not None
                else "unavailable"
            )
            return _sla_card(key, label, value, unit, thr.label, status)

        rpa_num, rpa_den = self._repo.rpa_internal_root_cause_pct_inputs(year)
        backlog_num, backlog_den = self._repo.backlog_aging_14d_inputs(year, as_of)
        l1, total = self._repo.l1_ratio_inputs_by_year(year)
        median_days = self._repo.median_resolution_days_by_year(year)

        return [
            card(
                "rpa_internal_root_cause_pct",
                "RPA Internal Root Causes",
                _round_pct(Decimal(rpa_num) / rpa_den) if rpa_den > 0 else None,
                "pct",
            ),
            card(
                "backlog_aging_pct",
                "Open Backlog Aging",
                _round_pct(Decimal(backlog_num) / backlog_den) if backlog_den > 0 else None,
                "pct",
            ),
            card(
                "l1_ratio_pct",
                "L1 / L2 Ratio",
                _round_pct(Decimal(l1) / total) if total > 0 else None,
                "pct",
            ),
            card(
                "median_resolution_days",
                "Median Resolution Time (MTTR)",
                round(float(median_days), 2) if median_days is not None else None,
                "days",
            ),
        ]

    def sla_commitments(self) -> list[dict[str, Any]]:
        """The AMS 1L service contract as reference data for the dashboard."""
        return [dict(commitment) for commitment in SLA_COMMITMENTS]

    def sla_attainment(self, year: int, *, as_of: date | None = None) -> dict[str, Any]:
        """Repair-time SLA attainment for `year`: share of closed tickets resolved
        within their Einstein-priority repair target, at calendar-day granularity.
        Target derivation lives in app.services.sla_config; see its caveat."""
        as_of = as_of or date.today()

        # group key -> [closed, within_target]
        by_type: dict[str, list[int]] = {}
        by_band: dict[str, list[int]] = {}
        by_month: dict[str, list[int]] = {}
        observed_priorities: set[str] = set()
        observed_bands: set[str] = set()
        total_closed = 0
        total_within = 0

        for ticket_type, priority_value, month, resolution_days in (
            self._repo.closed_tickets_for_sla(year)
        ):
            priority = parse_einstein_priority(priority_value)
            if priority_value is not None:
                observed_priorities.add(str(priority_value).strip())
            band = band_for_priority(priority)
            observed_bands.add(band)
            within = 1 if resolution_days <= repair_target_days(ticket_type, priority) else 0
            total_closed += 1
            total_within += within
            for bucket, key in (
                (by_type, normalise_ticket_type(ticket_type)),
                (by_band, band),
                (by_month, month),
            ):
                row = bucket.setdefault(key, [0, 0])
                row[0] += 1
                row[1] += within

        headline_pct = _round_pct(Decimal(total_within) / total_closed) if total_closed else None

        open_over_target: list[dict[str, Any]] = []
        for ticket_id, ticket_type, priority_value, process, age_days in (
            self._repo.open_tickets_for_sla(as_of)
        ):
            priority = parse_einstein_priority(priority_value)
            target = repair_target_days(ticket_type, priority)
            if age_days > target:
                open_over_target.append(
                    {
                        "ticket_id": ticket_id,
                        "ticket_type": normalise_ticket_type(ticket_type),
                        "band": band_for_priority(priority),
                        "process": process,
                        "age_days": age_days,
                        "target_days": target,
                    }
                )
        open_over_target.sort(key=lambda row: row["age_days"], reverse=True)

        def _group(
            bucket: dict[str, list[int]], order: list[str] | None = None
        ) -> list[dict[str, Any]]:
            keys = order if order is not None else sorted(bucket)
            return [
                {
                    "key": key,
                    "closed": bucket[key][0],
                    "within_target": bucket[key][1],
                    "breached": bucket[key][0] - bucket[key][1],
                    "attainment_pct": (
                        _round_pct(Decimal(bucket[key][1]) / bucket[key][0])
                        if bucket[key][0]
                        else None
                    ),
                }
                for key in keys
                if key in bucket
            ]

        status = attainment_status(headline_pct) if headline_pct is not None else "unavailable"
        return {
            "headline_pct": headline_pct,
            "status": status,
            "closed": total_closed,
            "within_target": total_within,
            "breached": total_closed - total_within,
            "open_over_target_count": len(open_over_target),
            "observed_priorities": sorted(observed_priorities, key=lambda s: (len(s), s)),
            "observed_bands": [b for b in ("High", "Medium", "Low") if b in observed_bands],
            "targets": resolved_targets(),
            "by_type": _group(by_type),
            "by_band": _group(by_band, ["High", "Medium", "Low"]),
            "by_month": [
                {
                    "period": period,
                    "closed": counts[0],
                    "within_target": counts[1],
                    "attainment_pct": (
                        _round_pct(Decimal(counts[1]) / counts[0]) if counts[0] else None
                    ),
                }
                for period, counts in sorted(by_month.items())
            ],
            "open_over_target": open_over_target[:100],
            "caveat": SLA_ATTAINMENT_CAVEAT,
        }

    def quality_breakdown(self, year: int) -> dict[str, Any]:
        def donut(is_1l: bool) -> dict[str, Any]:
            root_causes, sr_count, incident_count = self._repo.root_cause_and_type_breakdown(
                is_1l=is_1l, year=year
            )
            total = sum(count for _, count in root_causes)
            sorted_causes = sorted(root_causes, key=lambda row: row[1], reverse=True)
            top, rest = sorted_causes[:4], sorted_causes[4:]
            rest_total = sum(count for _, count in rest)
            buckets = list(top)
            if rest_total:
                buckets.append(("Other", rest_total))

            root_cause_pct = [
                {
                    "label": name,
                    "count": count,
                    "pct": _round_pct(Decimal(count) / total) if total else 0.0,
                }
                for name, count in buckets
            ]
            ticket_type_total = sr_count + incident_count
            return {
                "root_causes": root_cause_pct,
                "total_tickets": total,
                "service_request_pct": (
                    _round_pct(Decimal(sr_count) / ticket_type_total) if ticket_type_total else 0.0
                ),
                "incident_pct": (
                    _round_pct(Decimal(incident_count) / ticket_type_total)
                    if ticket_type_total
                    else 0.0
                ),
            }

        return {"l1": donut(True), "l2": donut(False)}

    def cost_breakdown_by_process(self, year: int) -> list[dict[str, Any]]:
        process_count = self._repo.process_count()
        ams_1l_by_year = {y: fee for y, fee, _ in self._repo.ams_1l_by_year()}
        ams_1l_share = (
            ams_1l_by_year.get(year, Decimal("0")) / process_count
            if process_count
            else Decimal("0")
        )

        rows: list[dict[str, Any]] = []
        for name, license_eur, infra_eur, l2_eur in self._repo.cost_breakdown_by_process(year):
            total = license_eur + infra_eur + ams_1l_share + l2_eur
            rows.append(
                {
                    "process": name,
                    "license_eur": _round_money(license_eur),
                    "infrastructure_eur": _round_money(infra_eur),
                    "ams_1l_eur": _round_money(ams_1l_share),
                    "l2_eur": _round_money(l2_eur),
                    "total_eur": _round_money(total),
                }
            )
        rows.sort(key=lambda row: float(row["total_eur"]), reverse=True)
        return rows
