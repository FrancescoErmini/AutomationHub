from datetime import date, datetime
from decimal import Decimal

from app.ingestion.normalization import (
    ams_year_ordinal,
    normalize_ams_year,
    normalize_bool,
    normalize_company,
    normalize_date_european,
    normalize_decimal,
    normalize_text_key,
    normalize_vm_id,
    process_matching_key,
)


def test_normalize_text_key_collapses_whitespace_without_changing_case() -> None:
    result = normalize_text_key("  RPA -   Test   Beta ")

    assert result.normalized == "RPA - Test Beta"
    assert result.method == "trim_whitespace"
    assert result.original == "  RPA -   Test   Beta "


def test_normalize_text_key_is_identity_for_already_clean_values() -> None:
    result = normalize_text_key("Clean Value")

    assert result.normalized == "Clean Value"
    assert result.method == "identity"


def test_process_matching_key_is_case_and_whitespace_insensitive() -> None:
    assert process_matching_key(" rpa - test gamma") == process_matching_key("RPA - Test Gamma ")
    assert process_matching_key("RPA - Test Gamma") == "rpa - test gamma"


def test_normalize_vm_id_strips_windows_and_linux_prefixes() -> None:
    assert normalize_vm_id("MCDWINRPAP21").normalized == "RPAP21"
    assert normalize_vm_id("MCDLNXRPAP21").normalized == "RPAP21"
    assert normalize_vm_id("MCDWINRPAP21").method == "prefix_strip"


def test_normalize_vm_id_is_identity_when_already_canonical() -> None:
    result = normalize_vm_id("RPAP21")

    assert result.normalized == "RPAP21"
    assert result.method == "identity"


def test_normalize_ams_year_maps_roman_numerals_and_ordinal_words() -> None:
    roman = normalize_ams_year("I")
    ordinal = normalize_ams_year("1st")

    assert roman is not None and roman.normalized == "1st" and roman.method == "lookup_table"
    assert ordinal is not None and ordinal.normalized == "1st" and ordinal.method == "identity"
    assert normalize_ams_year("II").normalized == "2nd"  # type: ignore[union-attr]
    assert normalize_ams_year("III").normalized == "3rd"  # type: ignore[union-attr]


def test_normalize_ams_year_returns_none_for_unknown_values() -> None:
    assert normalize_ams_year("IV") is None
    assert normalize_ams_year("") is None


def test_ams_year_ordinal_matches_expected_sort_order() -> None:
    assert ams_year_ordinal("1st") == 1
    assert ams_year_ordinal("2nd") == 2
    assert ams_year_ordinal("3rd") == 3


def test_normalize_company_uses_the_documented_alias_table() -> None:
    exact = normalize_company("Menarini")
    padded = normalize_company(" menarini ")

    assert exact is not None and exact.normalized == "Menarini" and exact.method == "identity"
    assert padded is not None and padded.normalized == "Menarini" and padded.method == "alias_table"


def test_normalize_company_returns_none_for_unmapped_legal_entities() -> None:
    assert normalize_company("A. Menarini Industrie Farmaceutiche Riunite S.r.l.") is None


def test_normalize_decimal_parses_thousands_comma_and_trailing_space() -> None:
    assert normalize_decimal("12,500.00 ") == Decimal("12500.00")


def test_normalize_decimal_treats_dash_and_blank_as_null() -> None:
    assert normalize_decimal("-") is None
    assert normalize_decimal("") is None
    assert normalize_decimal(None) is None


def test_normalize_decimal_passes_through_numeric_types() -> None:
    assert normalize_decimal(42) == Decimal("42")
    assert normalize_decimal(15.5) == Decimal("15.5")


def test_normalize_bool_parses_python_and_string_forms() -> None:
    assert normalize_bool("True") is True
    assert normalize_bool("false") is False
    assert normalize_bool(True) is True
    assert normalize_bool(None) is None
    assert normalize_bool("maybe") is None


def test_normalize_date_european_parses_dd_mm_yyyy() -> None:
    assert normalize_date_european("01/06/2024") == date(2024, 6, 1)


def test_normalize_date_european_accepts_dash_separators() -> None:
    # A real source row uses "20-05-2026" instead of the usual slash format;
    # silently failing to parse this would turn a closed ticket into an
    # apparently-open one (caught by the independent Excel oracle).
    assert normalize_date_european("20-05-2026") == date(2026, 5, 20)


def test_normalize_date_european_passes_through_native_datetimes() -> None:
    assert normalize_date_european(datetime(2024, 6, 1, 10, 30)) == date(2024, 6, 1)
    assert normalize_date_european(date(2024, 6, 1)) == date(2024, 6, 1)


def test_normalize_date_european_returns_none_for_blank() -> None:
    assert normalize_date_european(None) is None
    assert normalize_date_european("") is None
