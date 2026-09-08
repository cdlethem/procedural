#!/usr/bin/env python3
"""Run reviewed gradient-path fixtures against the native Python public API.

This runner imports no fixture oracle. It reports pure native conformance only;
it does not render, publish evidence, or establish the other target ports.
"""

from __future__ import annotations

import argparse
from array import array
import copy
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import time
import tracemalloc
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "catalog/operations/gradient-path.json"
sys.path.insert(0, str(ROOT / "packages" / "python"))

from procedurals import GradientPathError, gradient_path_2d  # noqa: E402
import procedurals.paths as path_module  # noqa: E402


def expect_error(action, code: str, detail: dict[str, object] | None = None) -> None:
    try:
        action()
    except GradientPathError as error:
        if error.code != code:
            raise AssertionError(f"expected {code}, got {error.code}") from error
        actual = (None if error.step_index is None else
                  {"stepIndex": error.step_index, "stage": error.stage})
        if actual != detail:
            raise AssertionError(f"expected detail {detail!r}, got {actual!r}") from error
    else:
        raise AssertionError(f"expected {code}")


def bits(value: float) -> str:
    return struct.pack(">d", value).hex()


def assert_positive_zero(value: object) -> None:
    if isinstance(value, dict):
        for item in value.values():
            assert_positive_zero(item)
    elif isinstance(value, list):
        for item in value:
            assert_positive_zero(item)
    elif isinstance(value, float) and value == 0.0:
        assert math.copysign(1.0, value) == 1.0


def assert_close(actual: float, expected: float, tolerance: float, label: str) -> None:
    if abs(actual - expected) > tolerance:
        raise AssertionError(f"{label}: {actual!r} differs from {expected!r}, tolerance={tolerance!r}")
    if tolerance == 0.0 and expected == 0.0:
        assert bits(actual) == "0000000000000000", label


def assert_values(actual: dict[str, list[object]], expected: dict[str, object],
                  comparison: dict[str, object], label: str) -> None:
    positions = actual["positions"]
    headings = actual["headings"]
    expected_positions = expected["positions"]
    expected_headings = expected["headings"]
    assert len(positions) == len(expected_positions), label
    assert len(headings) == len(expected_headings), label
    position_tolerance = float(comparison["positions_abs"])
    heading_tolerance = float(comparison["headings_abs"])
    for index, (point, wanted) in enumerate(zip(positions, expected_positions)):
        assert isinstance(point, list) and len(point) == 2
        for coordinate, wanted_coordinate in zip(point, wanted):
            assert_close(float(coordinate), float(wanted_coordinate), position_tolerance,
                         f"{label}/point[{index}]")
    for index, (heading, wanted_heading) in enumerate(zip(headings, expected_headings)):
        assert_close(float(heading), float(wanted_heading), heading_tolerance,
                     f"{label}/heading[{index}]")
    assert_positive_zero(actual)


def verify_fixture_bindings(path: Path, fixture: dict[str, object]) -> None:
    catalog_sha = hashlib.sha256(CATALOG.read_bytes()).hexdigest()
    if fixture.get("catalog_sha256") != catalog_sha:
        raise AssertionError("fixture catalog_sha256 does not bind the current catalog")
    source = fixture.get("long_cases_source")
    if not isinstance(source, dict) or not isinstance(source.get("path"), str) or not isinstance(source.get("sha256"), str):
        raise AssertionError("long cases require path and sha256 provenance")
    source_path = (ROOT / source["path"]).resolve()
    try:
        source_path.relative_to(ROOT.resolve())
    except ValueError as error:
        raise AssertionError("long-case provenance must remain inside repository") from error
    if not source_path.is_file() or hashlib.sha256(source_path.read_bytes()).hexdigest() != source["sha256"]:
        raise AssertionError("long-case provenance source is missing or stale")


def run_fixture(path: Path) -> tuple[dict[str, int], dict[str, object], dict[str, object]]:
    fixture = json.loads(path.read_text())
    verify_fixture_bindings(path, fixture)
    completed: dict[str, object] = {}
    short_success = short_errors = long_records = 0
    for case in fixture["cases"]:
        if "error" in case:
            expect_error(lambda case=case: gradient_path_2d(case["input"]), case["error"],
                         case.get("error_detail"))
            short_errors += 1
            continue
        trace = gradient_path_2d(case["input"])
        actual = trace.to_values()
        assert_values(actual, case["output"], case["comparison"], case["id"])
        completed[case["id"]] = trace
        short_success += 1
    for case in fixture.get("long_cases", []):
        trace = gradient_path_2d(case["input"])
        position_tolerance = float(case["comparison"]["positions_abs"])
        heading_tolerance = float(case["comparison"]["headings_abs"])
        for record in case["selected"]:
            actual = trace.point_at(record["pointIndex"])
            for actual_coordinate, expected_coordinate in zip(actual, record["position"]):
                assert_close(actual_coordinate, float(expected_coordinate), position_tolerance,
                             f"{case['id']}/point[{record['pointIndex']}]")
            if "headingIndex" in record:
                assert_close(trace.heading_at(record["headingIndex"]), float(record["heading"]),
                             heading_tolerance, f"{case['id']}/heading[{record['headingIndex']}]")
            long_records += 1
        assert_positive_zero(trace.to_values())
    for check in fixture.get("cross_case_checks", []):
        if check["kind"] != "raw-binary64-prefix":
            raise AssertionError(f"unsupported fixture cross-case check {check['kind']!r}")
        first = completed[check["prefix_case"]].to_values()
        second = completed[check["extended_case"]].to_values()
        assert [[bits(value) for value in point] for point in first["positions"]] == [
            [bits(value) for value in point] for point in second["positions"][:len(first["positions"])]
        ], check["id"]
        assert [bits(value) for value in first["headings"]] == [
            bits(value) for value in second["headings"][:len(first["headings"])]
        ], check["id"]
    return ({"short_success_cases": short_success, "short_error_cases": short_errors,
             "long_cases": len(fixture.get("long_cases", [])), "long_selected_records": long_records,
             "cross_case_checks": len(fixture.get("cross_case_checks", []))}, completed, fixture)


class HostileList(list):
    def __setitem__(self, index, value):  # pragma: no cover - failure proves it was not called
        raise AssertionError("hostile output setter reached")


class DictSubclass(dict):
    pass


class ListSubclass(list):
    pass


def run_native_invariants(reference_input: dict[str, object]) -> dict[str, int]:
    passed = 0
    source = copy.deepcopy(reference_input)
    path = gradient_path_2d(source)
    source["field"]["seed"] = 7
    source["start"][0] = 99.0
    source["fieldOffset"][0] = 99.0
    canonical = path.serialize()
    assert canonical["field"]["seed"] != 7 and canonical["start"][0] != 99.0
    descriptor = path.serialize()
    descriptor["field"]["seed"] = 8
    descriptor["start"][0] = 8.0
    assert path.serialize() == canonical
    values = path.to_values()
    values["positions"][0][0] = 8.0
    values["headings"][0] = 8.0
    assert path.to_values()["positions"][0][0] != 8.0
    assert path.point_at(0) is not path.point_at(0)
    try:
        path._positions[0] = 0  # type: ignore[index]
    except TypeError:
        pass
    else:
        raise AssertionError("retained packed positions must be immutable")
    passed += 1

    replay = gradient_path_2d(path.serialize())
    assert replay.to_values() == path.to_values()
    assert replay.steps == path.steps
    passed += 1

    # Exact builtin input-carrier policy; subclasses, tuples and custom mappings are not interchange.
    invalid_carriers = [
        DictSubclass(copy.deepcopy(reference_input)),
        {**copy.deepcopy(reference_input), "start": (0.0, 0.0)},
        {**copy.deepcopy(reference_input), "start": ListSubclass([0.0, 0.0])},
        {**copy.deepcopy(reference_input), "field": DictSubclass({"seed": 42})},
    ]
    for params in invalid_carriers:
        expect_error(lambda params=params: gradient_path_2d(params), "INVALID_INPUT")
    huge = 1 << 10_000
    for replacement in (
            {**copy.deepcopy(reference_input), "steps": huge},
            {**copy.deepcopy(reference_input), "field": {"seed": huge}},
            {**copy.deepcopy(reference_input), "start": [huge, 0.0]},
    ):
        expect_error(lambda replacement=replacement: gradient_path_2d(replacement), "INVALID_INPUT")
    passed += 2

    output = [7.0, 8.0, 9.0]
    path.point_into(1, output, 1)
    assert output[0] == 7.0 and output[1:] == path.point_at(1)
    before = output[:]
    expect_error(lambda: path.point_into(float("nan"), object(), 0), "INVALID_INDEX")
    expect_error(lambda: path.point_into(path.steps + 1, object(), 0), "INDEX_OUT_OF_RANGE")
    expect_error(lambda: path.point_into(0, output, -1), "INVALID_OUTPUT")
    assert output == before
    expect_error(lambda: path.point_into(0, output, 2), "INVALID_OUTPUT")
    assert output == before
    expect_error(lambda: path.point_into(0, array("f", [0.0, 0.0])), "INVALID_OUTPUT")
    expect_error(lambda: path.point_into(0, (0.0, 0.0)), "INVALID_OUTPUT")
    expect_error(lambda: path.point_into(0, HostileList([0.0, 0.0])), "INVALID_OUTPUT")
    expect_error(lambda: path.point_into(huge, object(), 0), "INVALID_INDEX")
    typed = array("d", [0.0, 0.0])
    path.point_into(0, typed)
    assert list(typed) == path.point_at(0)
    passed += 3

    # Allocator/export failures are host resource errors and leave existing paths usable.
    with patch.object(path_module, "array", side_effect=MemoryError("simulated allocation")):
        try:
            gradient_path_2d(reference_input)
        except MemoryError:
            pass
        else:
            raise AssertionError("MemoryError must not become a validation error")
    with patch.object(path_module, "_copy_values", side_effect=MemoryError("simulated export")):
        try:
            path.to_values()
        except MemoryError:
            pass
        else:
            raise AssertionError("to_values allocation failure must remain a resource error")
    with patch.object(path_module, "_copy_configuration", side_effect=MemoryError("simulated export")):
        try:
            path.serialize()
        except MemoryError:
            pass
        else:
            raise AssertionError("serialize allocation failure must remain a resource error")
    assert path.point_at(0) == replay.point_at(0)
    passed += 1
    return {"native_invariants": passed}


def checksum(trace) -> str:
    digest = hashlib.sha256()
    values = trace.to_values()
    for point in values["positions"]:
        digest.update(struct.pack(">d", point[0]))
        digest.update(struct.pack(">d", point[1]))
    for heading in values["headings"]:
        digest.update(struct.pack(">d", heading))
    return digest.hexdigest()


def construction_peak(params: dict[str, object]) -> int:
    """Observe Python-tracked construction peak outside the timed repetitions."""
    tracemalloc.start()
    try:
        gradient_path_2d(params)
        _, peak = tracemalloc.get_traced_memory()
        return peak
    finally:
        tracemalloc.stop()


def workload(case: dict[str, object]) -> dict[str, object]:
    params = case["input"]
    count = params["steps"]
    for _ in range(3):
        gradient_path_2d(params)
    samples = []
    digest = ""
    for _ in range(5):
        started = time.perf_counter()
        trace = gradient_path_2d(params)
        elapsed = time.perf_counter() - started
        digest = checksum(trace)
        samples.append(elapsed)
    return {"id": case["id"], "steps": count, "warmups": 3, "repetitions": 5,
            "seconds": samples, "checksum_sha256": digest,
            "raw_final_payload_binary64_bytes": (3 * count + 2) * 8,
            "construction_storage": "temporary array('d') positions/headings copied once into immutable bytes; raw final payload excludes temporary arrays and allocator/object overhead",
            "tracemalloc_peak_bytes_single_construction": construction_peak(params),
            "measurement_scope": "construction peak measured separately from timed construction repetitions"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path,
                        default=ROOT / "fixtures/operations/gradient-path.json")
    parser.add_argument("--no-workloads", action="store_true")
    args = parser.parse_args()
    summary: dict[str, object] = {
        "operation": "path.gradient-trace-2d", "implementation": "python",
        "runtime": sys.version, "fixture": str(args.fixture), "failures": [],
    }
    try:
        counts, completed, fixture = run_fixture(args.fixture)
        reference = next(case["input"] for case in fixture["cases"]
                         if case["id"] == "evolving-field")
        counts.update(run_native_invariants(reference))
        summary["counts"] = counts
        if not args.no_workloads:
            tiny = [next(case for case in fixture["cases"] if case["id"] == case_id)
                    for case_id in ("canonical-negative-zero", "cardinal-zero-heading")]
            representative = [next(case for case in fixture["long_cases"]
                                   if case["input"]["steps"] == count
                                   and case["id"].startswith("cp2-field-"))
                              for count in (2_000, 16_000)]
            summary["workloads"] = [workload(case) for case in [*tiny, *representative]]
    except (AssertionError, GradientPathError, MemoryError, OSError, json.JSONDecodeError) as error:
        summary["failures"].append(str(error))
    print(json.dumps(summary, sort_keys=True))
    return 1 if summary["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
