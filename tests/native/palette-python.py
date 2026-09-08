#!/usr/bin/env python3
"""Run the shared cyclic-palette fixtures against the Python core.

The runner exercises the native Python API and does not import the fixture
oracle.  Its benchmark is a bounded scalar traversal of the source-pelines
palette; the checksum is reported as an observation for cross-target review.
"""

from __future__ import annotations

import argparse
from decimal import Decimal
import json
import math
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages" / "python"))

from procedurals import CyclicPaletteError, cyclic_palette  # noqa: E402


def expect_error(fn, code: str) -> None:
    try:
        fn()
    except CyclicPaletteError as error:
        if error.code != code:
            raise AssertionError(f"expected {code}, got {error.code}") from error
    else:
        raise AssertionError(f"expected {code}")


def assert_positive_zeroes(value: object) -> None:
    if isinstance(value, dict):
        for item in value.values():
            assert_positive_zeroes(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            assert_positive_zeroes(item)
    elif isinstance(value, float) and value == 0.0:
        assert math.copysign(1.0, value) == 1.0


def run_fixture(path: Path) -> dict[str, int]:
    fixture = json.loads(path.read_text())
    constructor_cases = 0
    fixture_samples = 0
    native_query_calls = 0
    for case in fixture["cases"]:
        if "error" in case:
            expect_error(lambda case=case: cyclic_palette(case["input"]), case["error"])
        else:
            palette = cyclic_palette(case["input"])
            assert palette.serialize() == case["serialized"]
            assert set(palette.serialize()) == {"colors"}
            for query in case["queries"]:
                actual = palette.sample(query["input"])
                assert type(actual) is int
                assert actual == query["output"], (case["id"], query, actual)
                fixture_samples += 1
                native_query_calls += 1
        constructor_cases += 1

    query_errors = 0
    palette = cyclic_palette({"colors": [0, 16_777_215]})
    for case in fixture["query_cases"]:
        expect_error(lambda case=case: palette.sample(case["input"]), case["error"])
        query_errors += 1

    return {
        "constructor_cases": constructor_cases,
        "fixture_samples": fixture_samples,
        "native_query_calls": native_query_calls,
        "query_errors": query_errors,
        "oracle_index_vectors_not_native_tested": len(fixture["index_vectors"]),
    }


def run_native_invariants() -> dict[str, int]:
    passed = 0

    # Construction snapshots both the caller's list and serialized results.
    source = {"colors": [0, 1_193_046, 16_777_215]}
    palette = cyclic_palette(source)
    source["colors"][0] = 16_777_215
    assert palette.serialize() == {"colors": [0, 1_193_046, 16_777_215]}
    detached = palette.serialize()
    detached["colors"][1] = 0
    assert palette.serialize() == {"colors": [0, 1_193_046, 16_777_215]}
    try:
        palette._colors = (8,)  # type: ignore[misc]
    except Exception:
        pass
    else:
        raise AssertionError("palette colors must be immutable")
    passed += 1

    # Query validation remains active for a one-entry palette.
    single = cyclic_palette({"colors": [1_193_046]})
    for value in (None, True, "0.5", [], {}, math.nan, math.inf, -math.inf):
        expect_error(lambda value=value: single.sample(value), "INVALID_QUERY")
    expect_error(lambda: single.sample(1 << 10_000), "INVALID_QUERY")
    expect_error(lambda: single.sample(Decimal("0.5")), "INVALID_QUERY")
    # Native integers normalize to canonical binary64 before domain checking.
    maximum = sys.float_info.max
    rounded_integer = int(maximum) + 1
    assert float(rounded_integer) == maximum
    assert palette.sample(rounded_integer) == palette.sample(maximum)
    assert palette.sample(-rounded_integer) == palette.sample(-maximum)
    passed += 1

    # Nonfinite entries are invalid, and integral floats are accepted.
    for value in (math.nan, math.inf, -math.inf):
        expect_error(lambda value=value: cyclic_palette({"colors": [value]}), "INVALID_INPUT")
    assert cyclic_palette({"colors": [-0.0, 1.0]}).serialize() == {"colors": [0, 1]}
    passed += 1

    # Sampling returns exact integers; zero phases and serialized zeros are canonical.
    zero = cyclic_palette({"colors": [0, 0]})
    assert type(zero.sample(-0.0)) is int and zero.sample(-0.0) == 0
    assert_positive_zeroes(zero.serialize())
    passed += 1

    # Stateless query order and palette interleaving preserve each result.
    first = cyclic_palette({"colors": [0, 16_777_215]})
    second = cyclic_palette({"colors": [16_711_680, 255]})
    queries = [-0.25, 0.125, 0.5, 1.25, -1.25]
    first_expected = [first.sample(value) for value in queries]
    second_expected = [second.sample(value) for value in queries]
    for value in reversed(queries):
        first.sample(value)
        second.sample(value)
    assert [first.sample(value) for value in queries] == first_expected
    assert [second.sample(value) for value in queries] == second_expected
    passed += 1

    return {"native_checks": passed}


def benchmark() -> dict[str, object]:
    """Time one bounded 250000-query source-pelines scalar traversal."""
    palette = cyclic_palette({"colors": [3_252_561, 16_754_462, 329_804, 14_566_968, 4_046_263]})

    def traverse() -> int:
        checksum = 0
        for index in range(250_000):
            checksum += palette.sample(index * 0.001)
        return checksum

    traverse()
    traverse()
    started = time.perf_counter()
    checksum = traverse()
    elapsed = time.perf_counter() - started
    return {
        "queries": 250_000,
        "warmups": 2,
        "seconds": elapsed,
        "checksum": checksum,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--fixture",
        type=Path,
        default=ROOT / "fixtures/operations/cyclic-palette.json",
    )
    args = parser.parse_args()
    failures: list[str] = []
    summary: dict[str, object] = {
        "operation": "color.cyclic-palette",
        "implementation": "python",
        "runtime": sys.version,
    }
    try:
        summary["counts"] = {
            **run_fixture(args.fixture),
            **run_native_invariants(),
        }
        summary["benchmark"] = benchmark()
    except (AssertionError, CyclicPaletteError, OSError, json.JSONDecodeError) as error:
        failures.append(str(error))
    summary["failures"] = failures
    print(json.dumps(summary, sort_keys=True))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
