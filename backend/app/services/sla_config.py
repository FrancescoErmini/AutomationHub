"""Contractual SLA definitions and the G/A/R threshold config for the SLA / KPI
dashboard.

The AMS 1L contract keys reaction/repair targets on the **Einstein priority**
(0..5) carried by each ticket, which maps onto a provider band (High/Medium/Low):

    Einstein 0-1 -> High,  2-3 -> Medium,  4-5 -> Low

``automation_hub.ticket`` links to ``automation_hub.priority`` whose ``value`` holds that number as a
string. Every ticket in the warehouse currently carries priority ``3`` (Medium);
``DEFAULT_EINSTEIN_PRIORITY`` is used for any ticket with a missing/unparseable
value.

Measurability caveat
--------------------
``automation_hub.ticket`` stores ``start_date`` / ``end_date`` as *dates* (no time of day)
and there is no first-response timestamp. So:

* Reaction-time SLAs cannot be measured -- shown for reference only.
* Repair-time SLAs are measured on the resolution date at calendar-day
  granularity: a ticket counts as "within target" when
  ``end_date - start_date <= repair_target_days(type, priority)``. This is
  approximate -- a ticket opened late in the day can fall either side of a
  same-day target.
"""

from __future__ import annotations

from typing import Literal

TicketType = Literal["Incident", "Service Request"]
Band = Literal["High", "Medium", "Low"]

# Einstein priority (0..5) -> provider band.
EINSTEIN_PRIORITY_BANDS: dict[int, Band] = {
    0: "High",
    1: "High",
    2: "Medium",
    3: "Medium",
    4: "Low",
    5: "Low",
}

# Fallback when a ticket has no / an unparseable priority value. Matches the
# single value currently present in the warehouse.
DEFAULT_EINSTEIN_PRIORITY = 3

# (ticket_type, band) -> (reaction_hours, repair_hours) -- the AMS 1L contract.
SLA_TARGETS: dict[tuple[TicketType, Band], tuple[int, int]] = {
    ("Incident", "High"): (1, 4),
    ("Incident", "Medium"): (2, 8),
    ("Incident", "Low"): (8, 16),
    ("Service Request", "High"): (8, 8),
    ("Service Request", "Medium"): (16, 16),
    ("Service Request", "Low"): (24, 32),
}

_EINSTEIN_LABELS: dict[Band, str] = {"High": "0-1", "Medium": "2-3", "Low": "4-5"}


def normalise_ticket_type(value: str | None) -> TicketType:
    return "Service Request" if value == "Service Request" else "Incident"


def parse_einstein_priority(value: str | int | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None


def band_for_priority(einstein_priority: int | None) -> Band:
    priority = einstein_priority if einstein_priority is not None else DEFAULT_EINSTEIN_PRIORITY
    return EINSTEIN_PRIORITY_BANDS.get(priority, "Medium")


def _hours_to_days(hours: int) -> int:
    """Contract hours -> calendar-day target for the day-granular proxy. Assumes an
    ~8 working-hour day and rounds up: <=8h -> 1d, <=16h -> 2d, <=24h -> 3d,
    <=32h -> 4d."""
    return max(1, -(-hours // 8))


def sla_target_hours(ticket_type: str, einstein_priority: int | None) -> tuple[int, int]:
    """(reaction_hours, repair_hours) for a ticket."""
    key = (normalise_ticket_type(ticket_type), band_for_priority(einstein_priority))
    return SLA_TARGETS[key]


def repair_target_days(ticket_type: str, einstein_priority: int | None) -> int:
    return _hours_to_days(sla_target_hours(ticket_type, einstein_priority)[1])


def resolved_targets() -> list[dict[str, object]]:
    """The full (type, band) -> targets table, with the day-level repair target,
    for the dashboard reference panel."""
    return [
        {
            "ticket_type": ticket_type,
            "band": band,
            "reaction_hours": reaction_hours,
            "repair_hours": repair_hours,
            "target_days": _hours_to_days(repair_hours),
        }
        for (ticket_type, band), (reaction_hours, repair_hours) in SLA_TARGETS.items()
    ]


# The signed contract as reference data (identical Einstein pairs collapsed to a
# single row per band).
SLA_COMMITMENTS: list[dict[str, object]] = [
    {
        "ticket_type": ticket_type,
        "provider_priority": band,
        "einstein_label": _EINSTEIN_LABELS[band],
        "reaction_hours": reaction_hours,
        "repair_hours": repair_hours,
    }
    for (ticket_type, band), (reaction_hours, repair_hours) in SLA_TARGETS.items()
]

SLA_ATTAINMENT_CAVEAT = (
    "Reaction-time SLAs are not tracked — source tickets carry no response "
    "timestamp. Repair-time attainment is measured on the resolution date at "
    "calendar-day granularity against each ticket's Einstein-priority target, so "
    "it is approximate: a ticket opened late in the day can fall either side of a "
    "same-day target."
)


# --- KPI tile thresholds -----------------------------------------------------


class KpiThreshold:
    __slots__ = ("op", "value", "label", "amber_band")

    def __init__(self, op: str, value: float, label: str, amber_band: float = 0.2) -> None:
        self.op = op
        self.value = value
        self.label = label
        self.amber_band = amber_band


KPI_THRESHOLDS: dict[str, KpiThreshold] = {
    "rpa_internal_root_cause_pct": KpiThreshold("<", 25.0, "Target < 25%"),
    "backlog_aging_pct": KpiThreshold("<", 5.0, "Target < 5%"),
    "l1_ratio_pct": KpiThreshold(">=", 80.0, "Target ≥ 80% L1"),
    "median_resolution_days": KpiThreshold("<", 1.0, "Target < 1 day"),
}

# Standard SLA attainment banding for the headline resolution-attainment number.
SLA_ATTAINMENT_BANDS = {"green_at_least": 95.0, "amber_at_least": 90.0}


def status_for(value: float, op: str, threshold: float, amber_band: float = 0.2) -> str:
    """green / amber / red for a value against a target."""
    ok = value < threshold if op == "<" else value >= threshold
    if ok:
        return "green"
    distance = abs(value - threshold) / threshold if threshold else 1.0
    return "amber" if distance <= amber_band else "red"


def attainment_status(pct: float) -> str:
    if pct >= SLA_ATTAINMENT_BANDS["green_at_least"]:
        return "green"
    if pct >= SLA_ATTAINMENT_BANDS["amber_at_least"]:
        return "amber"
    return "red"
