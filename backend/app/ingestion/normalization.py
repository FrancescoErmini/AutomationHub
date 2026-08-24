"""Deterministic, traceable normalization rules for RPA workbook values.

Every function here is a pure, table/regex-driven transformation -- no fuzzy
matching. Where a value is matched against a reference set (process name, VM
id, AMS year, company), the result records original value, normalized value,
method, and confidence so the transformation is auditable.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

_WHITESPACE_RE = re.compile(r"\s+")
_VM_PREFIX_RE = re.compile(r"^MCD(WIN|LNX)", re.IGNORECASE)
# PIPELINE's SYSTEM cell is often multi-valued, delimited by a newline
# ("SAP\nAS400") or a comma ("Gmail, Excel") -- both are split on.
_APPLICATION_SPLIT_RE = re.compile(r"[\n,]+")

AMS_YEAR_LOOKUP: dict[str, tuple[str, int]] = {
    "i": ("1st", 1),
    "ii": ("2nd", 2),
    "iii": ("3rd", 3),
    "1st": ("1st", 1),
    "2nd": ("2nd", 2),
    "3rd": ("3rd", 3),
}

# The AMS contract's ordinal year (1st/2nd/3rd) isn't itself a calendar year
# anywhere in the workbook -- this fixes it to the program's actual contract
# start (AMS year 1 = 2024), matching the values previously seeded by hand in
# migration 20260806_0008. Keyed by the stable normalized code, not a row id,
# so it survives a full ingestion rebuild (which reissues AmsYear row ids).
AMS_YEAR_CALENDAR_YEAR: dict[str, int] = {"1st": 2024, "2nd": 2025, "3rd": 2026}

# Enumerable alias table for the two group-level companies that actually
# appear in the core-bound sheets (TICKETS, PIPELINE, AMS 2L). Finer legal
# entity names (TCO, TICKETS_OUT) are staged/audited only -- see the plan.
COMPANY_ALIASES: dict[str, str] = {
    "menarini": "Menarini",
    "codifi": "Codifi",
}


@dataclass(frozen=True)
class NormalizedValue:
    original: str
    normalized: str
    method: str
    confidence: Decimal


def normalize_text_key(raw: str) -> NormalizedValue:
    """Trim + collapse internal whitespace; case is preserved."""
    cleaned = _WHITESPACE_RE.sub(" ", raw).strip()
    method = "identity" if cleaned == raw else "trim_whitespace"
    return NormalizedValue(
        original=raw, normalized=cleaned, method=method, confidence=Decimal("1.0")
    )


def process_matching_key(name: str) -> str:
    """Case/whitespace-insensitive key used to match process names across sheets."""
    return _WHITESPACE_RE.sub(" ", name).strip().casefold()


def normalize_vm_id(raw: str) -> NormalizedValue:
    cleaned = raw.strip()
    normalized = _VM_PREFIX_RE.sub("", cleaned).upper()
    method = "identity" if normalized == raw else "prefix_strip"
    return NormalizedValue(
        original=raw, normalized=normalized, method=method, confidence=Decimal("1.0")
    )


def split_applications(raw: str) -> list[NormalizedValue]:
    """Split a SYSTEM cell into its individual application names, trimming
    and collapsing whitespace on each piece and dropping case-insensitive
    duplicates within the cell (first spelling wins)."""
    seen: set[str] = set()
    results: list[NormalizedValue] = []
    for piece in _APPLICATION_SPLIT_RE.split(raw):
        cleaned = _WHITESPACE_RE.sub(" ", piece).strip()
        if not cleaned:
            continue
        key = cleaned.casefold()
        if key in seen:
            continue
        seen.add(key)
        method = "identity" if cleaned == raw else "split_multi_value"
        results.append(
            NormalizedValue(original=raw, normalized=cleaned, method=method, confidence=Decimal("1.0"))
        )
    return results


def normalize_ams_year(raw: str) -> NormalizedValue | None:
    match = AMS_YEAR_LOOKUP.get(raw.strip().casefold())
    if match is None:
        return None
    code, _ordinal = match
    method = "identity" if code == raw else "lookup_table"
    return NormalizedValue(original=raw, normalized=code, method=method, confidence=Decimal("1.0"))


def ams_year_ordinal(code: str) -> int:
    return {"1st": 1, "2nd": 2, "3rd": 3}[code]


def normalize_company(raw: str) -> NormalizedValue | None:
    canonical = COMPANY_ALIASES.get(raw.strip().casefold())
    if canonical is None:
        return None
    method = "identity" if canonical == raw else "alias_table"
    return NormalizedValue(
        original=raw, normalized=canonical, method=method, confidence=Decimal("1.0")
    )


def normalize_decimal(raw: object) -> Decimal | None:
    if raw is None:
        return None
    if isinstance(raw, Decimal):
        return raw
    if isinstance(raw, int | float):
        return Decimal(str(raw))
    text = str(raw).strip()
    if text in {"", "-"}:
        return None
    text = text.replace(",", "").replace("€", "").strip()
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def normalize_bool(raw: object) -> bool | None:
    if isinstance(raw, bool):
        return raw
    if raw is None:
        return None
    text = str(raw).strip().casefold()
    if text in {"true", "1", "yes"}:
        return True
    if text in {"false", "0", "no"}:
        return False
    return None


# The source is predominantly "DD/MM/YYYY", but at least one row uses
# dashes ("20-05-2026") -- both are accepted so a stray separator doesn't
# silently turn a valid date into a missing one.
_EUROPEAN_DATE_FORMATS = (
    "%d/%m/%Y",
    "%d/%m/%Y %H:%M:%S",
    "%d-%m-%Y",
    "%d-%m-%Y %H:%M:%S",
)


def normalize_date_european(raw: object) -> date | None:
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    for date_format in _EUROPEAN_DATE_FORMATS:
        try:
            return datetime.strptime(text, date_format).date()
        except ValueError:
            continue
    return None
