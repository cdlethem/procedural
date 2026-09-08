#!/usr/bin/env python3
"""Run the shared regular-grid fixtures against the Python implementation."""

from __future__ import annotations

import argparse
from array import array
import json
import math
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages" / "python"))

from procedurals.layout import GridError, regular_grid  # noqa: E402


class HostileList(list):
    """A writable-looking subclass that must not be trusted as output storage."""

    def __setitem__(self, index, value):
        raise AssertionError("hostile output setter was reached")


def expect_error(fn, code: str) -> None:
    try:
        fn()
    except GridError as error:
        if error.code != code:
            raise AssertionError(f"expected {code}, got {error.code}") from error
    else:
        raise AssertionError(f"expected {code}")


def canonical_float(value: object) -> float:
    result = float(value)
    return 0.0 if result == 0.0 else result


def canonical_descriptor(params: dict[str, object]) -> dict[str, object]:
    return {
        "origin": [canonical_float(value) for value in params["origin"]],
        "spacing": [canonical_float(value) for value in params["spacing"]],
        "columns": int(params["columns"]),
        "rows": int(params["rows"]),
    }


def assert_positive_zeroes(value: object) -> None:
    if isinstance(value, dict):
        for item in value.values():
            assert_positive_zeroes(item)
    elif isinstance(value, list):
        for item in value:
            assert_positive_zeroes(item)
    elif isinstance(value, float) and value == 0.0:
        assert math.copysign(1.0, value) == 1.0


def assert_point_exact(actual: list[float], expected: list[object]) -> None:
    expected_canonical = [canonical_float(value) for value in expected]
    assert actual == expected_canonical
    assert len(actual) == 2
    for actual_value, expected_value in zip(actual, expected_canonical):
        if expected_value == 0.0:
            assert math.copysign(1.0, actual_value) == 1.0


def run_fixture(path: Path) -> dict[str, int]:
    fixture = json.loads(path.read_text())
    passed = 0
    for case in fixture["cases"]:
        if "error" in case:
            expect_error(lambda case=case: regular_grid(case["input"]), case["error"])
        else:
            grid = regular_grid(case["input"])
            assert grid.size == case["size"]
            for index, expected in zip(case["indices"], case["points"]):
                actual = grid.point_at(index)
                assert_point_exact(actual, expected)
            serialized = grid.serialize()
            assert serialized == canonical_descriptor(case["input"])
            assert set(serialized) == {"origin", "spacing", "columns", "rows"}
            assert_positive_zeroes(serialized)
            serialized["origin"][0] = 999.0
            assert grid.origin[0] != 999.0
        passed += 1
    for case in fixture["access_cases"]:
        grid = regular_grid(fixture["cases"][0]["input"])
        expect_error(lambda case=case: grid.point_at(case["index"]), case["error"])
        passed += 1
    return {"fixture_cases": passed}


def run_native_invariants() -> dict[str, int]:
    passed = 0
    expect_error(lambda: regular_grid({"origin": [math.nan, 0], "spacing": [1, 1], "columns": 1, "rows": 1}), "INVALID_INPUT")
    expect_error(lambda: regular_grid({"origin": [0, 0], "spacing": [1, 1], "columns": 1, "rows": math.inf}), "INVALID_INPUT")
    passed += 2

    origin = [1.0, 2.0]
    spacing = array("d", [3.0, 4.0])
    grid = regular_grid({"origin": origin, "spacing": spacing, "columns": 2, "rows": 2})
    try:
        grid._columns = 9
    except Exception:
        pass
    else:
        raise AssertionError("grid fields must be immutable")
    origin[0] = 99.0
    spacing[0] = 99.0
    assert grid.point_at(1) == [4.0, 2.0]
    assert grid.point_at(1) is not grid.point_at(1)
    passed += 1

    detached = grid.serialize()
    assert detached == {
        "origin": [1.0, 2.0],
        "spacing": [3.0, 4.0],
        "columns": 2,
        "rows": 2,
    }
    detached["spacing"][0] = 77.0
    assert grid.spacing[0] == 3.0
    assert regular_grid(grid.serialize()).point_at(3) == [4.0, 6.0]
    assert math.copysign(1.0, regular_grid({
        "origin": [-0.0, -0.0], "spacing": [1.0, 1.0], "columns": 1, "rows": 1
    }).point_at(0)[0]) == 1.0
    assert math.copysign(1.0, grid.point_at(0)[0]) == 1.0
    assert grid.point_at(0) is not grid.point_at(0)
    passed += 1

    output = [8.0, 9.0, 10.0]
    grid.point_into(1, output, 1)
    assert output == [8.0, 4.0, 2.0]
    before = output[:]
    expect_error(lambda: grid.point_into(-1, output, 1), "INVALID_INDEX")
    assert output == before
    expect_error(lambda: grid.point_into(1, output, 2), "INVALID_OUTPUT")
    assert output == before
    passed += 3

    expect_error(lambda: grid.point_into(1, array("f", [0.0, 0.0])), "INVALID_OUTPUT")
    expect_error(lambda: grid.point_into(1, (0.0, 0.0)), "INVALID_OUTPUT")
    expect_error(lambda: grid.point_into(1, HostileList([0.0, 0.0])), "INVALID_OUTPUT")
    expect_error(lambda: grid.point_into(float("nan"), object()), "INVALID_INDEX")
    expect_error(lambda: grid.point_into(float("inf"), object()), "INVALID_INDEX")
    passed += 3

    huge = regular_grid({"origin": [0, 0], "spacing": [1, 1], "columns": 2_147_483_647, "rows": 4_194_304})
    assert huge.size == 9_007_199_250_546_688
    assert huge.point_at(huge.size - 1) == [2_147_483_646.0, 4_194_303.0]
    passed += 1
    return {"native_invariants": passed}


def benchmark() -> dict[str, object]:
    grid = regular_grid({"origin": [0.0, 0.0], "spacing": [0.25, 0.5], "columns": 500, "rows": 500})
    output = array("d", [0.0, 0.0])
    def traverse() -> float:
        checksum = 0.0
        for index in range(grid.size):
            grid.point_into(index, output)
            checksum += output[0] + output[1]
        return checksum

    traverse()
    traverse()
    started = time.perf_counter()
    checksum = traverse()
    elapsed = time.perf_counter() - started
    assert checksum == 46_781_250.0
    return {"points": grid.size, "seconds": elapsed, "checksum": int(checksum)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, default=ROOT / "fixtures/operations/regular-grid.json")
    parser.add_argument("--benchmark", action="store_true", help="run the bounded 250000-point reused-buffer check")
    args = parser.parse_args()
    failures: list[str] = []
    summary: dict[str, object] = {"operation": "layout.regular-grid", "implementation": "python", "runtime": sys.version}
    try:
        summary.update(run_fixture(args.fixture))
        summary.update(run_native_invariants())
        if args.benchmark:
            summary["benchmark"] = benchmark()
    except (AssertionError, GridError, OSError, json.JSONDecodeError) as error:
        failures.append(str(error))
    summary["failures"] = failures
    print(json.dumps(summary, sort_keys=True))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
