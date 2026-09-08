#!/usr/bin/env python3
"""Run frozen CP5 triangle fixtures against the bounded Python core."""
from array import array
from hashlib import sha256
import argparse
import copy
import json
import math
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "packages/python/procedurals/triangle_points.py"
SEEDED_FILE = ROOT / "fixtures/operations/seeded-triangle-points.json"
MAPPING_FILE = ROOT / "fixtures/operations/triangle-coordinate-map.json"
SEEDED_CATALOG = ROOT / "catalog/operations/seeded-triangle-points.json"
MAPPING_CATALOG = ROOT / "catalog/operations/triangle-coordinate-map.json"
_MAX_SAFE = 9_007_199_254_740_991
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.triangle_points import (  # noqa: E402
    TrianglePointsError, _Stream, map_triangle_coordinates_2d,
    seeded_triangle_points_2d,
)


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def bits(value):
    return struct.pack(">d", value).hex()


def exact(actual, expected, label):
    if isinstance(expected, float):
        if not isinstance(actual, (int, float)) or bits(float(actual)) != bits(expected):
            raise AssertionError(f"{label}: {bits(float(actual)) if isinstance(actual, (int, float)) else actual} != {bits(expected)}")
    elif isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            raise AssertionError(f"{label}: list shape")
        for index, (left, right) in enumerate(zip(actual, expected)):
            exact(left, right, f"{label}[{index}]")
    elif isinstance(expected, dict):
        if not isinstance(actual, dict) or set(actual) != set(expected):
            raise AssertionError(f"{label}: record shape")
        for key in expected:
            exact(actual[key], expected[key], f"{label}.{key}")
    elif actual != expected:
        raise AssertionError(f"{label}: {actual!r} != {expected!r}")


def error_code(action):
    try:
        action()
    except TrianglePointsError as error:
        return error.code
    except Exception as error:
        return f"UNEXPECTED:{type(error).__name__}"
    return None


def point_bits(result):
    return [[bits(value) for value in point] for point in result.to_values()["points"]]


def run_cases(fixture, factory):
    results = {}
    for case in fixture["cases"]:
        if "error" in case:
            actual = error_code(lambda case=case: factory(case["input"]))
            if actual != case["error"]:
                raise AssertionError(f"{case['id']}: {actual}")
        else:
            result = factory(case["input"])
            exact(result.to_values(), case["output"], case["id"])
            if point_bits(result) != case["points_bits_hex"]:
                raise AssertionError(f"{case['id']}: point bits")
            results[case["id"]] = result
    return results


def stream_and_draw_checks(fixture):
    for vector in fixture["seed_vectors"]:
        stream = _Stream(vector["seed"])
        if stream.state() != vector["initial_state"]:
            raise AssertionError(f"stream initial {vector['seed']}")
        for expected in vector["first_10"]:
            actual = stream.output()
            if actual != expected["output_u32"] or stream.state() != expected["post_state"]:
                raise AssertionError(f"stream vector {vector['seed']}")
            if bits(actual / 4294967296.0) != bits(expected["unit"]):
                raise AssertionError(f"stream unit {vector['seed']}")

    original = _Stream.output
    draw_counts = {}
    for case in fixture["cases"]:
        trace = []
        def counted(self, _original=original):
            value = _original(self)
            trace.append(value)
            return value
        _Stream.output = counted
        try:
            result = seeded_triangle_points_2d(case["input"])
        except TrianglePointsError:
            result = None
        finally:
            _Stream.output = original
        expected_count = 0 if "error" in case else case["input"]["count"] * 2
        if len(trace) != expected_count:
            raise AssertionError(f"{case['id']}: draws {len(trace)}")
        draw_counts[case["id"]] = len(trace)
        if result is not None:
            pairs = [trace[index:index + 2] for index in range(0, len(trace), 2)]
            if pairs != case["generated_unit_u32"]:
                raise AssertionError(f"{case['id']}: generated uints")
            generated = [[value / 4294967296.0 for value in pair] for pair in pairs]
            for index, pair in enumerate(generated):
                exact(pair, case["generated_unit_coordinates"][index], f"{case['id']}: units")
            if point_bits(result) != case["points_bits_hex"]:
                raise AssertionError(f"{case['id']}: instrumented bits")
    return draw_counts


def ownership_and_access_checks():
    seeded_config = {"seed": 42, "count": 4, "triangle": [[0, 0], [16, 0], [0, 8]]}
    seeded = seeded_triangle_points_2d(seeded_config)
    baseline = seeded.to_values()
    seeded_config["triangle"][0][0] = 99
    seeded_config["count"] = 0
    exact(seeded.to_values(), baseline, "seeded input detached")
    map_config = {"triangle": [[0, 0], [16, 0], [0, 8]], "unitCoordinates": [[.25, .5], [.75, .25]]}
    mapped = map_triangle_coordinates_2d(map_config)
    mapped_baseline = mapped.to_values()
    map_config["triangle"][0][0] = 99
    map_config["unitCoordinates"][0][0] = 1
    exact(mapped.to_values(), mapped_baseline, "map input detached")
    point = seeded.point_at(0)
    if type(point) is not list:
        raise AssertionError("point_at native list")
    point[0] = 99
    exported = seeded.to_values()
    exported["points"][0][0] = 99
    exact(seeded.to_values(), baseline, "access detached")
    for out in ([9.0] * 5, array("d", [9.0] * 5)):
        if seeded.point_into(0.0, out, 1.0) is not None:
            raise AssertionError("point_into return")
        exact(list(out)[1:3], baseline["points"][0], "point_into binary64")
    def reject(action, code):
        actual = error_code(action)
        if actual != code:
            raise AssertionError(f"{code}: {actual}")
    for bad in (tuple([9.0, 9.0]), array("f", [9.0, 9.0]), type("L", (list,), {})([9.0, 9.0]), [9.0]):
        before = list(bad)
        reject(lambda bad=bad: seeded.point_into(0, bad), "INVALID_OUTPUT")
        if list(bad) != before:
            raise AssertionError("invalid destination mutated")
    for index in (-1, True, .5, math.nan, math.inf, 10**1000, "0"):
        for access in (lambda index=index: seeded.point_at(index),
                       lambda index=index: seeded.point_into(index, None, -1)):
            reject(access, "INVALID_INDEX")
    for index in (seeded.size, _MAX_SAFE):
        reject(lambda index=index: seeded.point_at(index), "INDEX_OUT_OF_RANGE")
        reject(lambda index=index: seeded.point_into(index, None, -1), "INDEX_OUT_OF_RANGE")
    for offset in (-1, True, .5, math.nan, math.inf, 10**1000, "0", 2):
        destination = [9.0] * 3
        reject(lambda offset=offset, destination=destination: seeded.point_into(0, destination, offset), "INVALID_OUTPUT")
        if destination != [9.0] * 3:
            raise AssertionError("failed output changed")
    reject(lambda: seeded.point_into(0, None, -1), "INVALID_OUTPUT")
    class Mapping(dict): pass
    class Pair(list): pass
    for bad in (Mapping(seeded_config), {**seeded_config, "triangle": [Pair([0, 0]), [16, 0], [0, 8]]},
                {**seeded_config, "triangle": array("d", [0, 0, 16, 0, 0, 8])}):
        reject(lambda bad=bad: seeded_triangle_points_2d(bad), "INVALID_INPUT")
    for key in ("seed", "count"):
        reject(lambda key=key: seeded_triangle_points_2d({**seeded_config, key: 10**1000}), "INVALID_INPUT")
    for bad in ({"triangle": [[0, 0], [1, 0], [0, 1]], "unitCoordinates": [[True, 0]]},
                {"triangle": [[0, 0], [1, 0], [0, 1]], "unitCoordinates": [[math.nan, 0]]},
                {"triangle": [[0, 0], [1, 0], [0, 1]], "unitCoordinates": array("d")},
                {"triangle": [[0, 0], [1, 0], [0, 1]], "unitCoordinates": [[0, 0, 0]]}):
        reject(lambda bad=bad: map_triangle_coordinates_2d(bad), "INVALID_INPUT")
    for bad_number in (True, math.nan, math.inf, -math.inf, 10**1000):
        for field in ("seed", "count"):
            invalid = {"seed": 42, "count": 0, "triangle": [[0, 0], [16, 0], [0, 8]], field: bad_number}
            reject(lambda invalid=invalid: seeded_triangle_points_2d(invalid), "INVALID_INPUT")
        invalid_triangle = [[0, 0], [16, bad_number], [0, 8]]
        reject(lambda: seeded_triangle_points_2d({"seed": 42, "count": 0, "triangle": invalid_triangle}), "INVALID_INPUT")
        reject(lambda: map_triangle_coordinates_2d({"triangle": invalid_triangle, "unitCoordinates": []}), "INVALID_INPUT")
        for slot in (0, 1):
            row = [0.5, 0.5]; row[slot] = bad_number
            reject(lambda row=row: map_triangle_coordinates_2d({"triangle": [[0, 0], [16, 0], [0, 8]], "unitCoordinates": [row]}), "INVALID_INPUT")
    return ["all caller containers detached", "point_at/to_values exact builtin detached lists",
            "point_into array(d)/list and atomic failures", "index/range/output precedence",
            "bool, huge integer, and custom carrier rejection"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    work = (ROOT / ".work").resolve()
    if not output.is_relative_to(work):
        raise ValueError("output must stay under .work")
    if output.exists():
        raise FileExistsError(f"refusing occupied output: {output}")
    seeded_fixture, mapping_fixture = json.loads(SEEDED_FILE.read_text()), json.loads(MAPPING_FILE.read_text())
    if seeded_fixture["catalog_sha256"] != digest(SEEDED_CATALOG) or mapping_fixture["catalog_sha256"] != digest(MAPPING_CATALOG):
        raise RuntimeError("fixture catalog binding is stale")
    inputs = [SOURCE, Path(__file__).resolve(), SEEDED_FILE, MAPPING_FILE, SEEDED_CATALOG, MAPPING_CATALOG]
    before = {str(path.relative_to(ROOT)): digest(path) for path in inputs}
    seeded = run_cases(seeded_fixture, seeded_triangle_points_2d)
    mapped = run_cases(mapping_fixture, map_triangle_coordinates_2d)
    draws = stream_and_draw_checks(seeded_fixture)
    for check in seeded_fixture["cross_case_checks"]:
        if check["kind"] == "raw-binary64-prefix":
            exact(seeded[check["extended_case"]].to_values()["points"][:seeded[check["prefix_case"]].size], seeded[check["prefix_case"]].to_values()["points"], check["id"])
        elif check["kind"] == "seeded-output-equals-explicit-map":
            exact(seeded[check["seeded_case"]].to_values(), mapped[check["mapping_case"]].to_values(), check["id"])
        else:
            raise AssertionError(f"unhandled cross check {check['kind']}")
    ownership = ownership_and_access_checks()
    after = {str(path.relative_to(ROOT)): digest(path) for path in inputs}
    if before != after:
        raise RuntimeError("inputs changed during run")
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {"status": "passed", "python": sys.version, "executable": sys.executable, "operations": [seeded_fixture["operation"], mapping_fixture["operation"]],
              "scope": "Actual Python CP5 pure fixtures, RNG, equivalence, ownership and access checks; no rendering or support claim.",
              "contract_sha256": {"seeded": digest(SEEDED_CATALOG), "mapping": digest(MAPPING_CATALOG)},
              "fixture_cases": {"seeded": len(seeded_fixture["cases"]), "mapping": len(mapping_fixture["cases"])},
              "seed_vectors": len(seeded_fixture["seed_vectors"]), "cross_case_checks": len(seeded_fixture["cross_case_checks"]),
              "generated_draw_counts": draws, "ownership_access": ownership,
              "auxiliary": {"seeded_native_only_cases": seeded_fixture["native_only_cases"], "mapping_native_only_cases": mapping_fixture["native_only_cases"], "seeded_requirements": seeded_fixture["native_ownership_access_requirements"], "mapping_requirements": mapping_fixture["native_ownership_access_requirements"]},
              "allocation_failure": {"executed": False, "source_review": "All static validation precedes packed array allocation and stream construction; generation appends primitive binary64 scalars without per-point lists. Host allocation failure is not injected."},
              "input_sha256_before": before, "input_sha256_after": after}
    with output.open("x") as stream:
        json.dump(report, stream, indent=2, sort_keys=True)
        stream.write("\n")
    print(json.dumps({"status": "passed", "output": str(output.relative_to(ROOT)), "fixture_cases": report["fixture_cases"]}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
