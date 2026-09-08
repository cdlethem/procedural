#!/usr/bin/env python3
"""Run the shared circle placement fixtures against the Python implementation."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
import time
from array import array
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages" / "python"))

from procedurals.placements import (
    MAX_PROPOSALS,
    _Xoshiro128StarStar11,
    _map_candidate,
    CirclePlacementError,
    ordered_circle_filter_2d,
    seeded_circle_placement_2d,
)

MAX_SAFE_INTEGER = 9_007_199_254_740_991

SOURCE_FILES = (
    "fixtures/operations/ordered-circle-filter.json",
    "fixtures/operations/seeded-circle-placement.json",
    "catalog/operations/ordered-circle-filter.json",
    "catalog/operations/seeded-circle-placement.json",
    "tests/native/circle-placements-python.py",
    "packages/python/procedurals/placements.py",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot_sources() -> dict[str, str]:
    return {name: sha256(ROOT / name) for name in SOURCE_FILES}


def bits_equal(actual: float, expected: float) -> bool:
    return struct.pack("<d", float(actual)) == struct.pack("<d", float(expected))


def assert_exact(actual: float, expected: float, what: str) -> None:
    if not bits_equal(actual, expected):
        raise AssertionError(f"{what}: {actual!r} is not bit-exact to {expected!r}")
    if float(actual) == 0.0:
        assert math.copysign(1.0, float(actual)) == 1.0, f"{what}: zero must be positive"


def expect_error(fn, code: str, detail: dict[str, Any] | None = None) -> None:
    try:
        fn()
    except CirclePlacementError as error:
        if error.code != code:
            raise AssertionError(f"expected {code}, got {error.code}") from None
        if detail is not None:
            if getattr(error, "candidate_index", None) != detail.get("candidateIndex"):
                raise AssertionError(
                    f"candidate_index {getattr(error, 'candidate_index', None)!r} != {detail.get('candidateIndex')!r}"
                ) from None
            if getattr(error, "stage", None) != detail.get("stage"):
                raise AssertionError(
                    f"stage {getattr(error, 'stage', None)!r} != {detail.get('stage')!r}"
                ) from None
        return
    except Exception as error:  # noqa: BLE001 - a leaked conversion error is the failure
        raise AssertionError(f"expected {code}, leaked {type(error).__name__}: {error}") from None
    raise AssertionError(f"expected {code}, no error raised")


def assert_values_exact(values: dict[str, Any], expected: dict[str, Any], what: str) -> None:
    assert set(values) == {"centres", "radii", "sourceIndices", "attempts"}, f"{what}: output keys"
    assert values["attempts"] == expected["attempts"], f"{what}: attempts"
    centres, radii, indices = values["centres"], values["radii"], values["sourceIndices"]
    assert len(centres) == len(expected["centres"]), f"{what}: centre count"
    assert len(radii) == len(expected["radii"]), f"{what}: radius count"
    assert list(indices) == list(expected["sourceIndices"]), f"{what}: source indices"
    for index, ((cx, cy), radius) in enumerate(zip(centres, radii)):
        assert type(centres[index]) is list and len(centres[index]) == 2, f"{what}: centre {index}"
        assert_exact(cx, expected["centres"][index][0], f"{what}: centre {index} x")
        assert_exact(cy, expected["centres"][index][1], f"{what}: centre {index} y")
        assert_exact(radius, expected["radii"][index], f"{what}: radius {index}")


def run_fixture(path: Path, operation: str, construct) -> tuple[int, dict[str, Any]]:
    fixture = json.loads(path.read_text())
    contract = json.loads((ROOT / "catalog/operations" / f"{operation}.json").read_text())
    assert sha256(ROOT / "catalog/operations" / f"{operation}.json") == fixture["catalog_sha256"], \
        f"{operation}: fixture is bound to a different catalog"
    assert contract["id"] == f"sampling.{operation}-2d", f"{operation}: contract identity"
    passed = 0
    results: dict[str, Any] = {}
    for case in fixture["cases"]:
        if "error" in case:
            expect_error(lambda case=case: construct(case["input"]), case["error"], case.get("error_detail"))
        else:
            result = construct(case["input"])
            assert result.size == len(case["output"]["centres"]), f"{case['id']}: size"
            assert result.attempts == case["output"]["attempts"], f"{case['id']}: attempts"
            assert_values_exact(result.to_values(), case["output"], case["id"])
            values = result.to_values()
            values["centres"].append([0.0, 0.0])
            values["radii"].append(9.0)
            values["sourceIndices"].append(9)
            assert_values_exact(result.to_values(), case["output"], case["id"] + ": detached")
            results[case["id"]] = result
        passed += 1
    return passed, results


def run_seed_vectors(fixture: dict[str, Any]) -> int:
    passed = 0
    for vector in fixture["seed_vectors"]:
        stream = _Xoshiro128StarStar11(vector["seed"])
        assert (stream.s0, stream.s1, stream.s2, stream.s3) == tuple(vector["initial_state"]), \
            f"seed {vector['seed']}: initial state"
        for step in vector["first_10"]:
            output = stream.next_u32()
            assert output == step["output_u32"], f"seed {vector['seed']} step {step['index']}: output"
            assert (stream.s0, stream.s1, stream.s2, stream.s3) == tuple(step["post_state"]), \
                f"seed {vector['seed']} step {step['index']}: state"
            assert_exact(output / 4_294_967_296.0, step["unit"], f"seed {vector['seed']} step {step['index']}: unit")
        passed += 1
    return passed


def run_mapping_vectors(fixture: dict[str, Any]) -> int:
    passed = 0
    for vector in fixture["mapping_vectors"]:
        config = vector["config"]
        x, y, radius = _map_candidate(
            (float(config["origin"][0]), float(config["origin"][1])),
            (float(config["extent"][0]), float(config["extent"][1])),
            (float(config["radiusRange"][0]), float(config["radiusRange"][1])),
            vector["units"][0], vector["units"][1], vector["units"][2], vector["units"][3], 0,
        )
        assert_exact(x, vector["mapped"]["centre"][0], f"{vector['id']}: x")
        assert_exact(y, vector["mapped"]["centre"][1], f"{vector['id']}: y")
        assert_exact(radius, vector["mapped"]["radius"], f"{vector['id']}: radius")
        passed += 1
    return passed


def run_cross_case_checks(seeded_fixture: dict[str, Any], ordered_fixture: dict[str, Any],
                          seeded_results: dict[str, Any]) -> int:
    passed = 0
    filter_cases = {case["id"]: case for case in ordered_fixture["cases"]}
    for check in seeded_fixture["cross_case_checks"]:
        if check["kind"] == "accepted-binary64-prefix":
            prefix = seeded_results[check["prefix_case"]].to_values()
            extended = seeded_results[check["extended_case"]].to_values()
            assert len(extended["centres"]) > len(prefix["centres"]), f"{check['id']}: extended must be longer"
            assert_values_exact(
                {
                    "centres": extended["centres"][: len(prefix["centres"])],
                    "radii": extended["radii"][: len(prefix["radii"])],
                    "sourceIndices": extended["sourceIndices"][: len(prefix["sourceIndices"])],
                    "attempts": prefix["attempts"],
                },
                prefix, f"{check['id']}: prefix",
            )
        elif check["kind"] == "independently-materialized-proposals-share-filter-output":
            seeded_case = next(c for c in seeded_fixture["cases"] if c["id"] == check["seeded_case"])
            config = seeded_case["input"]
            stream = _Xoshiro128StarStar11(config["seed"])
            centres: list[list[float]] = []
            radii: list[float] = []
            for _ in range(config["attempts"]):
                ux, uy, u, v = stream.unit(), stream.unit(), stream.unit(), stream.unit()
                x, y, r = _map_candidate(
                    (float(config["origin"][0]), float(config["origin"][1])),
                    (float(config["extent"][0]), float(config["extent"][1])),
                    (float(config["radiusRange"][0]), float(config["radiusRange"][1])),
                    ux, uy, u, v, 0,
                )
                centres.append([x, y])
                radii.append(r)
            materialized = ordered_circle_filter_2d({
                "centres": centres, "radii": radii,
                "separationScale": float(config["separationScale"]),
            })
            assert_values_exact(materialized.to_values(), seeded_case["output"], f"{check['id']}: materialized")
            independent = filter_cases[check["filter_case"]]
            assert "error" not in independent, f"{check['id']}: filter case must be a value case"
            assert_values_exact(seeded_results[check["seeded_case"]].to_values(), independent["output"],
                                f"{check['id']}: independent")
        else:  # pragma: no cover - fixture schema
            raise AssertionError(f"{check['id']}: unknown check kind {check['kind']}")
        passed += 1
    return passed


class HostileList(list):
    """A writable-looking subclass that must not be trusted as output storage."""

    def __setitem__(self, key: Any, value: Any) -> None:
        raise AssertionError("hostile output setter was reached")


def seeded_config(**overrides: Any) -> dict[str, Any]:
    config: dict[str, Any] = {
        "seed": 42, "attempts": 16, "origin": [10.0, 20.0], "extent": [300.0, 400.0],
        "radiusRange": [4.0, 24.0], "separationScale": 1.5,
    }
    config.update(overrides)
    return config


def run_native_invariants() -> int:
    passed = 0
    base = seeded_config()

    # Nonfinite native domain is INVALID_INPUT (JSON fixtures cannot carry NaN/Infinity).
    for field in ("origin", "extent", "radiusRange"):
        for value in ([math.nan, 0.0], [math.inf, 1.0]):
            config = seeded_config(**{field: value})
            expect_error(lambda config=config: seeded_circle_placement_2d(config), "INVALID_INPUT")
    for value in (math.nan, math.inf):
        config = seeded_config(separationScale=value)
        expect_error(lambda config=config: seeded_circle_placement_2d(config), "INVALID_INPUT")
    passed += 8
    for field, value in (("centres", [[math.nan, 0.0]]), ("radii", [math.inf]), ("separationScale", math.nan)):
        config = {"centres": [[0.0, 0.0]], "radii": [1.0], "separationScale": 1.0, field: value}
        expect_error(lambda config=config: ordered_circle_filter_2d(config), "INVALID_INPUT")
    passed += 3

    # Arbitrary-size integer domains: range-check before narrowing, no leaked conversion error.
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(seed=2 ** 64)), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(seed=10 ** 100)), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(attempts=2 ** 64)), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(attempts=MAX_PROPOSALS + 1)), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(origin=[10 ** 400, 0.0])), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(extent=[10 ** 400, 1.0])), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(radiusRange=[4.0, 10 ** 400])), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(separationScale=10 ** 400)), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(seed=True)), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(attempts=4.5)), "INVALID_INPUT")
    passed += 10

    # Custom carriers are rejected; only builtin dict/list values are accepted.
    class Mapping(dict):
        pass

    class PairList(list):
        pass

    expect_error(lambda: seeded_circle_placement_2d(Mapping(base)), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(origin=(10.0, 20.0))), "INVALID_INPUT")
    expect_error(lambda: seeded_circle_placement_2d(seeded_config(origin=PairList([10.0, 20.0]))), "INVALID_INPUT")
    expect_error(lambda: ordered_circle_filter_2d({
        "centres": ((0.0, 0.0),), "radii": [1.0], "separationScale": 1.0,
    }), "INVALID_INPUT")
    expect_error(lambda: ordered_circle_filter_2d({
        "centres": [PairList([0.0, 0.0])], "radii": [1.0], "separationScale": 1.0,
    }), "INVALID_INPUT")
    passed += 5

    # Ownership: caller input mutation never touches the retained result.
    input_config = seeded_config(attempts=12)
    result = seeded_circle_placement_2d(input_config)
    before = result.to_values()
    input_config["origin"] = [999.0, 999.0]
    input_config["extent"][0] = 1.0
    input_config["radiusRange"][1] = 1.0
    input_config["separationScale"] = 9.0
    assert_values_exact(result.to_values(), before, "input mutation")
    passed += 1

    # Accessors: valid and invalid indices/offsets/destinations.
    assert result.size > 0, "invariant needs a nonempty result"
    for index in (-1, -0.5, 0.5, math.nan, math.inf, "0", None, True, 2 ** 53):
        expect_error(lambda index=index: result.point_at(index), "INVALID_INDEX")
        expect_error(lambda index=index: result.radius_at(index), "INVALID_INDEX")
        expect_error(lambda index=index: result.source_index_at(index), "INVALID_INDEX")
        expect_error(lambda index=index: result.point_into(index, [0.0, 0.0]), "INVALID_INDEX")
    expect_error(lambda: result.point_at(result.size), "INDEX_OUT_OF_RANGE")
    expect_error(lambda: result.radius_at(result.size + 1), "INDEX_OUT_OF_RANGE")
    expect_error(lambda: result.source_index_at(result.size * 2), "INDEX_OUT_OF_RANGE")
    assert result.point_at(0.0) == result.point_at(0), "integral float index"
    passed += 4

    destination = [7.0, 8.0, 9.0]
    result.point_into(0, destination, 1)
    assert destination[1] == result.point_at(0)[0] and destination[2] == result.point_at(0)[1]
    for bad_offset in (-1, 0.5, math.nan, math.inf, "1", None, True, 2 ** 53):
        expect_error(lambda bad_offset=bad_offset: result.point_into(0, destination, bad_offset), "INVALID_OUTPUT")
    for bad_destination in (array("f", [0.0, 0.0]), array("d", [0.0]), (0.0, 0.0), HostileList([0.0, 0.0]),
                           {}, None, "xy"):
        expect_error(lambda bad_destination=bad_destination: result.point_into(0, bad_destination), "INVALID_OUTPUT")
    assert destination == [7.0, result.point_at(0)[0], result.point_at(0)[1]], \
        "failed writes left destination untouched"
    buffer = array("d", [0.0, 0.0, 0.0])
    result.point_into(1, buffer, 1)
    assert buffer[1] == result.point_at(1)[0] and buffer[2] == result.point_at(1)[1]
    assert buffer[0] == 0.0
    passed += 3

    # Empty results expose no indices and materialize the empty schema.
    empty = seeded_circle_placement_2d(seeded_config(attempts=0))
    assert empty.size == 0 and empty.attempts == 0
    expect_error(lambda: empty.point_at(0), "INDEX_OUT_OF_RANGE")
    expect_error(lambda: empty.point_into(0, [0.0, 0.0]), "INDEX_OUT_OF_RANGE")
    grown = seeded_circle_placement_2d(seeded_config(
        attempts=4_096, origin=[0.0, 0.0], extent=[1_000.0, 1_000.0], radiusRange=[4.0, 16.0],
    ))
    assert grown.size > 128, "growth invariant needs a deep result"
    grown_values = grown.to_values()
    assert_values_exact(grown.to_values(), grown_values, "growth self-consistency")
    for index in (0, 1, grown.size - 2, grown.size - 1):
        assert bits_equal(grown.point_at(index)[0], grown_values["centres"][index][0])
        assert grown.source_index_at(index) == grown_values["sourceIndices"][index]
    zero = ordered_circle_filter_2d({"centres": [[-0.0, -0.0]], "radii": [1.0], "separationScale": 1.0})
    point = zero.point_at(0)
    assert point == [0.0, 0.0]
    assert math.copysign(1.0, point[0]) == 1.0 and math.copysign(1.0, point[1]) == 1.0
    passed += 1

    # Materialization is detached from retained storage even when poked white-box.
    materialized = result.to_values()
    result._coordinates[0] = 1.0  # noqa: SLF001 - white-box detach check
    assert_values_exact(materialized, before, "materialization detached from retained storage")
    passed += 1
    return passed


def benchmark() -> dict[str, Any]:
    config = {
        "seed": 42, "attempts": 20_000, "origin": [0.0, 0.0], "extent": [1_000.0, 1_000.0],
        "radiusRange": [4.0, 16.0], "separationScale": 1.0,
    }
    result = seeded_circle_placement_2d(config)
    output = [0.0, 0.0]

    def traverse() -> float:
        checksum = 0.0
        for index in range(result.size):
            result.point_into(index, output)
            checksum += output[0] + output[1] + result.radius_at(index)
        return checksum

    traverse()
    started = time.perf_counter()
    checksum = traverse()
    elapsed = time.perf_counter() - started
    return {"accepted": result.size, "attempts": 20_000, "seconds": elapsed, "checksum": checksum}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--benchmark", action="store_true",
                        help="run the bounded 100000-proposal reused-buffer check")
    args = parser.parse_args()
    sources_before = snapshot_sources()
    failures: list[str] = []
    summary: dict[str, Any] = {
        "status": "failed",
        "scope": "Python pure core fixtures and host ownership/access only; no py5 renderer claim.",
        "implementation": "python",
        "runtime": sys.version,
    }
    try:
        seeded_fixture = json.loads((ROOT / "fixtures/operations/seeded-circle-placement.json").read_text())
        ordered_fixture = json.loads((ROOT / "fixtures/operations/ordered-circle-filter.json").read_text())
        ordered_cases, _ordered_results = run_fixture(
            ROOT / "fixtures/operations/ordered-circle-filter.json", "ordered-circle-filter",
            ordered_circle_filter_2d)
        seeded_cases, seeded_results = run_fixture(
            ROOT / "fixtures/operations/seeded-circle-placement.json", "seeded-circle-placement",
            seeded_circle_placement_2d)
        seed_vectors = run_seed_vectors(seeded_fixture)
        mapping_vectors = run_mapping_vectors(seeded_fixture)
        cross_checks = run_cross_case_checks(seeded_fixture, ordered_fixture, seeded_results)
        host = run_native_invariants()
        if args.benchmark:
            summary["benchmark"] = benchmark()
        summary.update({
            "fixtures": {
                "ordered_cases": ordered_cases,
                "seeded_cases": seeded_cases,
                "seeded_seed_vectors_consumed": seed_vectors,
                "seeded_mapping_vectors_consumed": mapping_vectors,
                "seeded_cross_case_checks": cross_checks,
                "ordered_native_only_cases": len(ordered_fixture["native_only_cases"]),
                "seeded_native_only_cases": len(seeded_fixture["native_only_cases"]),
            },
            "host_access_ownership": "passed" if host else "failed",
            "native_invariants": host,
        })
        summary["status"] = "passed"
    except (AssertionError, CirclePlacementError, OSError, json.JSONDecodeError, KeyError) as error:
        failures.append(f"{type(error).__name__}: {error}")
    summary["failures"] = failures
    summary["source_sha256_before"] = sources_before
    summary["source_sha256_after"] = snapshot_sources()
    assert summary["source_sha256_before"] == summary["source_sha256_after"], "sources changed during the run"
    report_path = ROOT / ".work/conformance/circle-placements-python.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    print(json.dumps(summary, sort_keys=True))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
