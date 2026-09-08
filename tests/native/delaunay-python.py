#!/usr/bin/env python3
"""Run the frozen delaunay-2d fixtures against the Python native port."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import struct
import sys
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "catalog/operations/delaunay-2d.json"
FIXTURE = ROOT / "fixtures/operations/delaunay-2d.json"
SOURCE = ROOT / "packages/python/procedurals/delaunay.py"
SELF = Path(__file__).resolve()
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.delaunay import DelaunayError, delaunay_2d


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes() -> dict[str, str]:
    return {str(path.relative_to(ROOT)): digest(path)
            for path in (CATALOG, FIXTURE, SOURCE, SELF)}


def bits(value: float) -> bytes:
    return struct.pack(">d", value)


def equal(actual, expected, label: str) -> None:
    if isinstance(actual, float) or isinstance(expected, float):
        if not isinstance(actual, (int, float)) or isinstance(actual, bool) or isinstance(expected, (int, float)) is False:
            raise AssertionError(label)
        if bits(float(actual)) != bits(float(expected)):
            raise AssertionError(f"{label}: {actual!r} != {expected!r}")
        return
    if type(actual) is not type(expected) and not (isinstance(actual, int) and isinstance(expected, int)):
        raise AssertionError(f"{label}: type")
    if isinstance(actual, dict):
        if set(actual) != set(expected): raise AssertionError(f"{label}: keys")
        for key in actual: equal(actual[key], expected[key], f"{label}.{key}")
    elif isinstance(actual, (list, tuple)):
        if len(actual) != len(expected): raise AssertionError(f"{label}: length")
        for index, (left, right) in enumerate(zip(actual, expected)): equal(left, right, f"{label}[{index}]")
    elif actual != expected:
        raise AssertionError(f"{label}: {actual!r} != {expected!r}")


def check_case(case: dict) -> object | None:
    try:
        result = delaunay_2d(case["input"])
    except DelaunayError as error:
        if case.get("error") != error.code: raise AssertionError(f"{case['id']}: {error.code}")
        detail = case.get("error_detail")
        if detail and (error.stage != detail["stage"] or error.work_used != detail["workUsed"]):
            raise AssertionError(f"{case['id']}: dynamic detail")
        return None
    if case.get("error"): raise AssertionError(f"{case['id']}: expected {case['error']}")
    equal(result.to_values(), case["output"], case["id"])
    comparison = case.get("comparison")
    if comparison and "points_bits_hex" in comparison:
        values = result.to_values()
        for i, expected_bits in enumerate(comparison["points_bits_hex"]):
            for axis in (0, 1):
                if bits(values["points"][i][axis]).hex() != expected_bits[axis]:
                    raise AssertionError(f"{case['id']}: point {i} axis {axis} bits")
    return result


def cross_checks(fixture: dict, results: dict[str, object]) -> int:
    executed = 0
    for check in fixture["cross_case_checks"]:
        kind = check["kind"]
        if kind == "same-coordinate-topology":
            expected = next(c for c in fixture["cases"] if c["id"] == check["cases"][0])["output"]
            for case_id in check["cases"][1:]:
                values = results[case_id].to_values()
                for field in ("points", "triangles", "edges", "edgeFaces", "workUsed"):
                    equal(values[field], expected[field], check["id"])
        elif kind == "canonical-positive-zero":
            values = results[check["case"]].to_values()
            for index in check["point_indices"]:
                for axis in (0, 1):
                    if bits(values["points"][index][axis]) != bits(0.0):
                        raise AssertionError(check["id"])
        elif kind == "exact-work-threshold":
            if results[check["success_case"]].work_used != check["work_used"]:
                raise AssertionError(check["id"])
            failure = next(c for c in fixture["cases"] if c["id"] == check["failure_case"])
            if failure["error_detail"]["workUsed"] != check["work_used"] - 1:
                raise AssertionError(check["id"])
        elif kind == "one-short-stage-witnesses":
            for stage, case_id in check["stages"].items():
                item = next(c for c in fixture["cases"] if c["id"] == case_id)
                if item["error"] != "WORK_LIMIT_EXCEEDED": raise AssertionError(check["id"])
                if item["input"]["maxWork"] != check["thresholds"]["one_short_max_work"][stage]:
                    raise AssertionError(check["id"])
                if item["error_detail"]["stage"] != stage: raise AssertionError(check["id"])
            canonicalize_case = next(c for c in fixture["cases"] if c["id"] == check["stages"]["canonicalize"])
            if len(canonicalize_case["input"]["points"]) != check["thresholds"]["first_charge_after"]["canonicalize"]:
                raise AssertionError(check["id"])
        else:
            raise AssertionError(f"unhandled cross-case kind {kind}")
        executed += 1
    return executed


def ownership_checks() -> list[str]:
    config = {"points": [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], [0.25, 0.25]], "maxWork": 9007199254740991}
    result = delaunay_2d(config)
    baseline = copy.deepcopy(result.to_values())
    config["points"][0][0] = 99.0
    config["points"][4] = [5.0, 5.0]
    config["maxWork"] = 0
    equal(result.to_values(), baseline, "input detachment")
    detached = result.point_at(0); detached[0] = 77.0
    result.triangle_at(0)[0] = 77
    result.edge_at(0)[1] = 77
    result.edge_faces_at(0)[0] = 77
    exported = result.to_values()
    exported["points"][0][0] = 77.0
    exported["inputToVertex"][0] = 77
    exported["sourceIndices"][0] = 77
    exported["triangles"][0][1] = 77
    exported["edges"][0][0] = 77
    exported["edgeFaces"][0][1] = 77
    exported["workUsed"] = 99
    equal(result.to_values(), baseline, "export detachment")
    if (result.input_count, result.vertex_count, result.face_count, result.edge_count, result.work_used) != (
            len(baseline["inputToVertex"]), len(baseline["points"]), len(baseline["triangles"]),
            len(baseline["edges"]), baseline["workUsed"]):
        raise AssertionError("counts")
    destination = [9.0] * 6
    if result.point_into(0, destination, 1) is not destination: raise AssertionError("point_into return")
    equal(destination[1:3], baseline["points"][0], "point_into")
    destination = [9] * 8
    if result.triangle_into(0, destination, 1) is not destination: raise AssertionError("triangle_into return")
    equal(destination[1:4], baseline["triangles"][0], "triangle_into")
    destination = [9] * 6
    if result.edge_into(0, destination, 1) is not destination: raise AssertionError("edge_into return")
    equal(destination[1:3], baseline["edges"][0], "edge_into")
    destination = [9] * 6
    if result.edge_faces_into(0, destination, 1) is not destination: raise AssertionError("edge_faces_into return")
    equal(destination[1:3], baseline["edgeFaces"][0], "edge_faces_into")
    if result.input_vertex_at(0) != baseline["inputToVertex"][0]: raise AssertionError("input_vertex_at")
    if result.source_index_at(0) != baseline["sourceIndices"][0]: raise AssertionError("source_index_at")
    class ReadOnlyList(list): pass
    for bad in (tuple([1.0] * 2), array("f", [1.0] * 2), array("i", [1] * 2), ReadOnlyList([1.0, 2.0]), [1.0]):
        before = copy.deepcopy(bad)
        try: result.point_into(0, bad, 0)
        except DelaunayError as error:
            if error.code != "INVALID_OUTPUT": raise
        else: raise AssertionError("accepted invalid output carrier")
        if list(bad) != list(before): raise AssertionError("invalid output mutated destination")
    for bad in (tuple([1] * 3), array("f", [1.0] * 3), ReadOnlyList([1, 2, 3]), [1, 2]):
        before = copy.deepcopy(bad)
        try: result.triangle_into(0, bad, 0)
        except DelaunayError as error:
            if error.code != "INVALID_OUTPUT": raise
        else: raise AssertionError("accepted invalid integer output carrier")
        if list(bad) != list(before): raise AssertionError("invalid output mutated destination")
    return ["input containers detached", "At carriers and export detached",
            "ordinary/array(d) into outputs", "invalid output carriers rejected",
            "index/offset accessors validated"]


def native_access_checks() -> list[str]:
    base = {"points": [[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]], "maxWork": 5}
    result = delaunay_2d(base)
    def rejected(action, code):
        try:
            action()
        except DelaunayError as error:
            if error.code != code:
                raise AssertionError((code, error.code))
        else:
            raise AssertionError("accepted invalid native value")
    for value in (float("nan"), float("inf"), -float("inf"), 10**1000, True):
        for axis in (0, 1):
            points = [list(pair) for pair in base["points"]]
            points[0][axis] = value
            rejected(lambda: delaunay_2d({"points": points, "maxWork": base["maxWork"]}), "INVALID_INPUT")
        rejected(lambda: delaunay_2d({"points": base["points"], "maxWork": value}), "INVALID_INPUT")
    class Mapping(dict): pass
    class Pair(list): pass
    for bad in (Mapping(base), {**base, "points": [[0.0, 0.0], Pair([1.0, 0.0]), [0.0, 1.0]]},
                {**base, "points": [array("d", [0.0, 0.0]), [1.0, 0.0], [0.0, 1.0]]}):
        rejected(lambda: delaunay_2d(bad), "INVALID_INPUT")
    # Negative zero canonicalizes in the output; integral float maxWork is accepted.
    negative_zero = delaunay_2d({"points": [[-0.0, 0.5], [1.0, 0.0], [0.0, 1.0], [0.5, 2.0]], "maxWork": 9007199254740991})
    for point in negative_zero.to_values()["points"]:
        if point[0] == 0.0 and bits(point[0]) != bits(0.0): raise AssertionError("negative zero not canonical")
    integral_float = delaunay_2d({"points": [[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]], "maxWork": 9.0})
    if integral_float.work_used != result.work_used: raise AssertionError("integral float maxWork")
    for index in (-1, True, 0.5, float("nan"), float("inf"), 10**1000, "0"):
        for action in (lambda: result.point_at(index), lambda: result.triangle_at(index),
                       lambda: result.edge_at(index), lambda: result.edge_faces_at(index),
                       lambda: result.input_vertex_at(index), lambda: result.source_index_at(index),
                       lambda: result.point_into(index, None, -1),
                       lambda: result.triangle_into(index, None, -1),
                       lambda: result.edge_into(index, None, -1),
                       lambda: result.edge_faces_into(index, None, -1)):
            rejected(action, "INVALID_INDEX")
    for accessor, count in (("point", result.vertex_count), ("triangle", result.face_count),
                            ("edge", result.edge_count), ("edge_faces", result.edge_count),
                            ("input_vertex", result.input_count), ("source_index", result.vertex_count)):
        if accessor == "point":
            accesses = (lambda: result.point_at(count), lambda: result.point_into(count, [0.0, 0.0]))
        elif accessor == "triangle":
            accesses = (lambda: result.triangle_at(count), lambda: result.triangle_into(count, [0, 0, 0]))
        elif accessor == "edge":
            accesses = (lambda: result.edge_at(count), lambda: result.edge_into(count, [0, 0]))
        elif accessor == "edge_faces":
            accesses = (lambda: result.edge_faces_at(count), lambda: result.edge_faces_into(count, [0, 0]))
        elif accessor == "input_vertex":
            accesses = (lambda: result.input_vertex_at(count),)
    for offset in (-1, True, 0.5, float("nan"), float("inf"), 10**1000, "0", 2):
        out = [9.0] * 3
        rejected(lambda: result.point_into(0, out, offset), "INVALID_OUTPUT")
        if out != [9.0] * 3: raise AssertionError("failed offset mutated destination")
    out = array("d", [9.0] * 6)
    result.point_into(0.0, out, 1.0)
    equal(list(out)[1:3], result.point_at(0), "binary64 buffer integral float access")
    return ["nonfinite/huge-integer/bool input domains", "custom mappings/pairs rejected",
            "negative-zero canonical and integral float maxWork", "all accessor index/range precedence",
            "invalid offsets unchanged", "array(d) valid output"]


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--output", required=True, type=Path); args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to((ROOT / ".work").resolve()): raise ValueError("output must stay under .work")
    if output.exists(): raise FileExistsError("refusing occupied output: " + str(output))
    fixture = json.loads(FIXTURE.read_text()); catalog = json.loads(CATALOG.read_text())
    if fixture["catalog_sha256"] != digest(CATALOG): raise RuntimeError("fixture catalog binding is stale")
    before = hashes(); results = {}
    for case in fixture["cases"]:
        result = check_case(case)
        if result is not None: results[case["id"]] = result
    ownership = ownership_checks() + native_access_checks()
    cross = cross_checks(fixture, results)
    after = hashes()
    if before != after: raise RuntimeError("inputs changed during run")
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {"status": "passed", "operation": fixture["operation"], "scope": "Python pure fixture and ownership/access conformance only; no renderer or target acceptance claim", "catalog_sha256": digest(CATALOG), "input_sha256_before": before, "input_sha256_after": after, "scenarios": {"fixture_cases": {"total": len(fixture["cases"]), "executed": len(fixture["cases"])}, "cross_case_checks": {"total": len(fixture["cross_case_checks"]), "executed": cross}, "ownership_access": {"executed": len(ownership), "checks": ownership}, "allocation_failure": {"executed": 0, "reason": "host allocation failure is not safely injectable; native contract requires source proof only"}}, "native_only_cases": {"executed": ["nonfinite-and-overflowing-numeric-carriers", "passive-input-carriers-only", "negative-zero", "retained-output-and-access"]}}
    with output.open("x") as stream:
        stream.write(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": "passed", "output": str(output.relative_to(ROOT)), "fixture_cases": len(fixture["cases"]), "cross_case_checks": cross}))
    return 0


if __name__ == "__main__":
    try: raise SystemExit(main())
    except Exception as error: print(str(error), file=sys.stderr); raise SystemExit(1)
