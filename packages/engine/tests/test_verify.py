"""Spec for the parts of verify.py that read test output. The full run is covered by
test_galaxium.py (integration) and test_mcp.py (a verify round on the fixture repo)."""

from __future__ import annotations

from cleave.verify import excerpt, parse_pytest

FAILED_RUN = """\
============================= test session starts ==============================
collected 44 items

tests/test_rest.py ..F.....                                               [100%]

=================================== FAILURES ===================================
___________________________ test_get_user_bookings ____________________________
E   pydantic_core._pydantic_core.ValidationError: 1 validation error for BookingOut
E   refund_total
E     Field required [type=missing, input_value={...}, input_type=dict]
=========================== short test summary info ============================
FAILED tests/test_rest.py::test_get_user_bookings - pydantic_core._pydantic_core.ValidationError: 1 validation error for BookingOut
========================= 1 failed, 43 passed in 3.21s =========================
"""

COLLECTION_ERROR = """\
=========================== short test summary info ============================
ERROR tests/test_fares.py - ModuleNotFoundError: No module named 'pricing.rounding'
!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
=============================== 1 error in 0.41s ===============================
"""


def test_counts_and_first_failure_from_a_failed_run() -> None:
    summary = parse_pytest(FAILED_RUN)
    assert (summary.passed, summary.failed) == (43, 1)
    assert summary.first_failure is not None
    assert summary.first_failure.test == "tests/test_rest.py::test_get_user_bookings"
    assert summary.first_failure.message.startswith("pydantic_core._pydantic_core.ValidationError")


def test_collection_errors_count_as_failures() -> None:
    summary = parse_pytest(COLLECTION_ERROR)
    assert summary.failed == 1
    assert summary.passed in (0, None)
    assert summary.first_failure is not None
    assert summary.first_failure.test == "tests/test_fares.py"
    assert "pricing.rounding" in summary.first_failure.message


def test_green_run() -> None:
    summary = parse_pytest("============ 44 passed, 2 warnings in 1.20s ============\n")
    assert (summary.passed, summary.failed, summary.first_failure) == (44, 0, None)


def test_output_without_a_summary() -> None:
    summary = parse_pytest("Traceback (most recent call last):\n  ...\nImportError: boom\n")
    assert summary.passed is None and summary.failed is None


def test_excerpt_keeps_the_short_summary_and_respects_the_limit() -> None:
    text = excerpt(FAILED_RUN)
    assert "short test summary info" in text
    assert "test_get_user_bookings" in text
    assert len(excerpt("x" * 50_000, limit=4000)) <= 4000
