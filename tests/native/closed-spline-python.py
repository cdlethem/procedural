#!/usr/bin/env python3
"""Run the frozen closed-spline-2d fixtures against the Python native port."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import struct
import sys
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "catalog/operations/closed-spline-2d.json"
FIXTURE = ROOT / "fixtures/operations/closed-spline-2d.json"
SOURCE = ROOT / "packages/python/procedurals/closed_spline.py"
SELF = Path(__file__).resolve()
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.closed_spline import SplineError, closed_spline_2d


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


def check_query(spline, entry: dict, label: str) -> None:
    result = spline.sample(entry["input"])
    equal(result, entry["output"], label)


def check_case(case: dict):
    if case.get("error"):
        try:
            closed_spline_2d(case["input"])
        except SplineError as error:
            if error.code != case["error"]:
                raise AssertionError(f"{case['id']}: {error.code}")
            return None
        else:
            raise AssertionError(f"{case['id']}: expected {case['error']}")
    spline = closed_spline_2d(case["input"])
    equal(spline.serialize(), case["serialized"], case["id"])
    equal(spline.length, case["metadata"]["length"], case["id"] + ".length")
    if spline.control_count != case["metadata"]["controlCount"]:
        raise AssertionError(f"{case['id']}: controlCount")
    if spline.subdivisions != case["metadata"]["subdivisions"]:
        raise AssertionError(f"{case['id']}: subdivisions")
    for query in case["queries"]:
        check_query(spline, query, case["id"])
    return spline


def check_query_cases(fixture: dict, base_spline) -> int:
    for item in fixture["query_cases"]:
        try:
            base_spline.sample(item["input"])
        except SplineError as error:
            if error.code != item["error"]:
                raise AssertionError(f"{item['id']}: {error.code}")
        else:
            raise AssertionError(f"{item['id']}: expected {item['error']}")
    return len(fixture["query_cases"])


def ownership_checks() -> list[str]:
    config = {"controls": [[0.0, 0.0], [2.0, 0.0], [2.0, 2.0], [0.0, 2.0]], "subdivisions": 2}
    spline = closed_spline_2d(config)
    baseline = copy.deepcopy(spline.serialize())
    config["controls"][0][0] = 99.0
    config["controls"].append([9.0, 9.0])
    config["subdivisions"] = 999
    equal(spline.serialize(), baseline, "input detachment")
    exported = spline.serialize()
    exported["controls"][0][0] = 77.0
    exported["subdivisions"] = 77
    equal(spline.serialize(), baseline, "export detachment")

    target = [9.0, 9.0, 9.0, 9.0]
    if spline.sample_parameter_into(0.0, target) is not None:
        raise AssertionError("sample_parameter_into return")
    equal(target, [0.0, 0.0, 1.0, -1.0], "sample_parameter_into values")
    dtarget = [9.0, 9.0, 9.0, 9.0]
    spline.sample_distance_into(0.0, dtarget)
    equal(dtarget, [0.0, 0.0, 1.0, -1.0], "sample_distance_into values")

    class ReadOnlyList(list): pass
    bad_outputs = [tuple([1.0] * 4), array("f", [1.0] * 4), ReadOnlyList([1.0, 2.0, 3.0, 4.0]),
                   [1.0, 2.0, 3.0], [1.0, 2.0, 3.0, 4.0, 5.0], {}, None]
    for bad in bad_outputs:
        before = copy.deepcopy(bad)
        for accessor in (lambda: spline.sample_parameter_into(0.0, bad),
                         lambda: spline.sample_distance_into(0.0, bad)):
            try:
                accessor()
            except SplineError as error:
                if error.code != "INVALID_QUERY":
                    raise
            else:
                raise AssertionError("accepted invalid output carrier")
        if bad != before:
            raise AssertionError("invalid output mutated destination")
    for value in (float("nan"), float("inf"), -float("inf"), None, "0", True):
        for accessor in (lambda: spline.sample_parameter_into(value, [0.0] * 4),
                         lambda: spline.sample_distance_into(value, [0.0] * 4)):
            try:
                accessor()
            except SplineError as error:
                if error.code != "INVALID_QUERY":
                    raise
            else:
                raise AssertionError("accepted invalid query value")
    for out in ([9.0, 9.0, 9.0, 9.0], array("d", [9.0, 9.0, 9.0, 9.0])):
        spline.sample_parameter_into(0.0, out)
        equal(list(out), [0.0, 0.0, 1.0, -1.0], "valid Into output")
    return ["input containers detached", "serialize export detached", "Into atomic on invalid target/value",
            "Into accepts list and array(d)"]


def native_access_checks() -> list[str]:
    base = {"controls": [[0.0, 0.0], [2.0, 0.0], [2.0, 2.0], [0.0, 2.0]], "subdivisions": 1}
    def rejected(action, code):
        try:
            action()
        except SplineError as error:
            if error.code != code:
                raise AssertionError((code, error.code))
        else:
            raise AssertionError("accepted invalid native value")
    for value in (float("nan"), float("inf"), -float("inf"), 10**1000, True):
        for axis in (0, 1):
            controls = [list(pair) for pair in base["controls"]]
            controls[0][axis] = value
            rejected(lambda: closed_spline_2d({"controls": controls, "subdivisions": base["subdivisions"]}), "INVALID_INPUT")
        rejected(lambda: closed_spline_2d({"controls": base["controls"], "subdivisions": value}), "INVALID_INPUT")
    class Mapping(dict): pass
    class Pair(list): pass
    for bad in (Mapping(base), {**base, "controls": [[0.0, 0.0], Pair([2.0, 0.0]), [2.0, 2.0], [0.0, 2.0]]},
                {**base, "controls": [array("d", [0.0, 0.0]), [2.0, 0.0], [2.0, 2.0], [0.0, 2.0]]}):
        rejected(lambda: closed_spline_2d(bad), "INVALID_INPUT")
    integral_float = closed_spline_2d({**base, "subdivisions": 1.0})
    if integral_float.length != closed_spline_2d(base).length:
        raise AssertionError("integral float subdivisions")
    return ["nonfinite/huge-integer/bool input domains", "custom mappings/pairs rejected", "integral float subdivisions"]


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--output", required=True, type=Path); args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to((ROOT / ".work").resolve()): raise ValueError("output must stay under .work")
    if output.exists(): raise FileExistsError("refusing occupied output: " + str(output))
    fixture = json.loads(FIXTURE.read_text())
    if fixture["catalog_sha256"] != digest(CATALOG): raise RuntimeError("fixture catalog binding is stale")
    before = hashes()
    base_spline = None
    for case in fixture["cases"]:
        spline = check_case(case)
        if spline is not None and base_spline is None:
            base_spline = spline
    query_cases = check_query_cases(fixture, base_spline)
    ownership = ownership_checks() + native_access_checks()
    after = hashes()
    if before != after: raise RuntimeError("inputs changed during run")
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "status": "passed", "operation": fixture["operation"],
        "scope": "Python pure fixture, query and ownership/access conformance only, using a bit-exact ported fdlibm5.3 hypot verified against java.lang.StrictMath.hypot; no renderer or target acceptance claim",
        "catalog_sha256": digest(CATALOG), "input_sha256_before": before, "input_sha256_after": after,
        "scenarios": {
            "fixture_cases": {"total": len(fixture["cases"]), "executed": len(fixture["cases"])},
            "query_cases": {"total": len(fixture["query_cases"]), "executed": query_cases},
            "ownership_access": {"executed": len(ownership), "checks": ownership},
        },
    }
    with output.open("x") as stream:
        stream.write(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": "passed", "output": str(output.relative_to(ROOT)),
                       "fixture_cases": len(fixture["cases"]), "query_cases": query_cases}))
    return 0


if __name__ == "__main__":
    try: raise SystemExit(main())
    except Exception as error: print(str(error), file=sys.stderr); raise SystemExit(1)
