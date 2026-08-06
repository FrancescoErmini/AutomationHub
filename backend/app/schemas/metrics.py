from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


class MetricValue(BaseModel):
    metric_name: str
    value: float | int | str | None
    unit: str
    available: bool
    status: str
    period: str | None = None
    filters: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    calculated_at: datetime


def available_metric(
    name: str,
    value: float | int | str | None,
    unit: str,
    *,
    period: str | None = None,
    filters: dict[str, Any] | None = None,
    warnings: list[str] | None = None,
) -> MetricValue:
    return MetricValue(
        metric_name=name,
        value=value,
        unit=unit,
        available=True,
        status="ok",
        period=period,
        filters=filters or {},
        warnings=warnings or [],
        calculated_at=datetime.now(UTC),
    )


def unavailable_metric(
    name: str,
    unit: str,
    *,
    reason: str,
    period: str | None = None,
    filters: dict[str, Any] | None = None,
) -> MetricValue:
    return MetricValue(
        metric_name=name,
        value=None,
        unit=unit,
        available=False,
        status="unavailable",
        period=period,
        filters=filters or {},
        warnings=[reason],
        calculated_at=datetime.now(UTC),
    )
