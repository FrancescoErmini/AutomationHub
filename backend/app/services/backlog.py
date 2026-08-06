"""Shared open-ticket backlog aging buckets, used by both the Operations and
Service Performance / SLA domains (same boundaries, same labels)."""

BACKLOG_BUCKETS = (
    "backlog_0_3_days",
    "backlog_4_7_days",
    "backlog_8_15_days",
    "backlog_over_15_days",
)


def bucket_for_age(age_days: int) -> str:
    if age_days <= 3:
        return "backlog_0_3_days"
    if age_days <= 7:
        return "backlog_4_7_days"
    if age_days <= 15:
        return "backlog_8_15_days"
    return "backlog_over_15_days"
