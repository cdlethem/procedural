#!/usr/bin/env python3
"""Run the shared gradient-noise fixtures against the Python core.

This runner exercises the native Python API and the language-neutral scalar/hash
vectors.  It does not import a fixture oracle or a probing implementation.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages" / "python"))

from procedurals import GradientNoiseError, gradient_noise_2d_01  # noqa: E402
from procedurals.fields import _corner_hash, _mix32  # noqa: E402


def expect_error(fn, code: str) -> None:
    try:
        fn()
    except GradientNoiseError as error:
        if error.code != code:
            raise AssertionError(f"expected {code}, got {error.code}") from error
    else:
        raise AssertionError(f"expected {code}")


def assert_positive_zeroes(value: object) -> None:
    if isinstance(value, dict):
        for item in value.values():
            assert_positive_zeroes(item)
    elif isinstance(value, list):
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
            expect_error(lambda case=case: gradient_noise_2d_01(case["input"]), case["error"])
        else:
            field = gradient_noise_2d_01(case["input"])
            assert field.serialize() == case["serialized"]
            assert set(field.serialize()) == {"seed"}
            assert_positive_zeroes(field.serialize())
            for query in case["queries"]:
                expected = query["output"]
                interchange = field.sample(query["input"])
                scalar = field.sample(query["input"][0], query["input"][1])
                assert type(interchange) is float
                assert type(scalar) is float
                assert_positive_zeroes(interchange)
                assert_positive_zeroes(scalar)
                assert interchange == expected, (case["id"], query, interchange)
                assert scalar == expected, (case["id"], query, scalar)
                fixture_samples += 1
                native_query_calls += 2
        constructor_cases += 1

    query_errors = 0
    field = gradient_noise_2d_01({"seed": 42})
    for case in fixture["query_cases"]:
        expect_error(lambda case=case: field.sample(case["input"]), case["error"])
        query_errors += 1

    mix_vectors = 0
    for case in fixture["mix_vectors"]:
        assert _mix32(case["input"]) == case["output"], case
        mix_vectors += 1
    corner_vectors = 0
    for case in fixture["corner_vectors"]:
        actual = _corner_hash(case["seed"], case["i"], case["j"])
        assert actual == case["output"], (case, actual)
        corner_vectors += 1
    return {
        "constructor_cases": constructor_cases,
        "fixture_samples": fixture_samples,
        "native_query_calls": native_query_calls,
        "query_errors": query_errors,
        "mix_vectors": mix_vectors,
        "corner_vectors": corner_vectors,
    }


def run_native_invariants() -> dict[str, int]:
    passed = 0

    original = {"seed": 42}
    field = gradient_noise_2d_01(original)
    original["seed"] = 7
    assert field.serialize() == {"seed": 42}
    detached = field.serialize()
    detached["seed"] = 8
    assert field.serialize() == {"seed": 42}
    try:
        field._seed_value = 8
    except Exception:
        pass
    else:
        raise AssertionError("field seed must be immutable")
    passed += 1

    # Queries have no state: changing order and interleaving independent fields
    # must preserve every value.
    first = gradient_noise_2d_01({"seed": 1})
    second = gradient_noise_2d_01({"seed": 42})
    queries = [[0.25, 0.75], [-0.25, -0.75], [0.1, 0.2], [0.75, 0.25]]
    expected_first = [first.sample(q) for q in queries]
    expected_second = [second.sample(q) for q in queries]
    reordered = list(reversed(queries))
    for query in reordered:
        first.sample(query)
        second.sample(query[0], query[1])
    assert [first.sample(q[0], q[1]) for q in queries] == expected_first
    assert [second.sample(q) for q in queries] == expected_second
    passed += 1

    # Validate shape before coordinates, and reject bool/nonfinite values.
    for value in ([], [0], [0, 0, 0], {"x": 0, "y": 0}, (0, 0, 0)):
        expect_error(lambda value=value: field.sample(value), "INVALID_QUERY")
    for value in ((True, 0), (math.nan, 0), (0, math.inf), (0, -math.inf)):
        expect_error(lambda value=value: field.sample(value), "INVALID_QUERY")
    expect_error(lambda: field.sample(0, True), "INVALID_QUERY")
    expect_error(lambda: field.sample(9007199254740991, 0), "INVALID_QUERY")
    expect_error(lambda: field.sample(-9007199254740992, 0), "INVALID_QUERY")
    passed += 1

    descriptor = gradient_noise_2d_01({"seed": -0.0}).serialize()
    assert descriptor == {"seed": 0}
    assert type(descriptor["seed"]) is int
    assert field.sample([0, 0]) == 0.5
    assert type(field.sample(0, 0)) is float
    passed += 2
    return {"native_checks": passed}


def benchmark() -> dict[str, object]:
    """Time one bounded 250000-query scalar traversal after two warmups."""
    field = gradient_noise_2d_01({"seed": 42})

    def traverse() -> float:
        checksum = 0.0
        for index in range(250_000):
            checksum += field.sample(index * 0.001, index * 0.002)
        return checksum

    traverse()
    traverse()
    started = time.perf_counter()
    checksum = traverse()
    elapsed = time.perf_counter() - started
    # This checksum is part of the bounded benchmark's semantic guard.
    assert checksum == 123_399.9596239042, checksum
    return {"queries": 250_000, "warmups": 2, "seconds": elapsed, "checksum": checksum}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, default=ROOT / "fixtures/operations/gradient-noise-2d-01.json")
    parser.add_argument("--benchmark", action="store_true", help="run the bounded scalar-query benchmark")
    args = parser.parse_args()

    failures: list[str] = []
    counts: dict[str, int] = {}
    summary: dict[str, object] = {
        "operation": "field.gradient-noise-2d-01",
        "implementation": "python",
        "runtime": sys.version,
    }
    try:
        counts.update(run_fixture(args.fixture))
        counts.update(run_native_invariants())
        if args.benchmark:
            summary["benchmark"] = benchmark()
    except (AssertionError, GradientNoiseError, OSError, json.JSONDecodeError) as error:
        failures.append(str(error))
    summary["counts"] = counts
    summary["failures"] = failures
    print(json.dumps(summary, sort_keys=True))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
