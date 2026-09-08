#!/usr/bin/env python3
"""Run the frozen target-springs-2d fixtures against the Python native port."""
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
CATALOG = ROOT / "catalog/operations/target-springs-2d.json"
FIXTURE = ROOT / "fixtures/operations/target-springs-2d.json"
SOURCE = ROOT / "packages/python/procedurals/target_springs.py"
SELF = Path(__file__).resolve()
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.target_springs import SpringError, target_springs_2d


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


def check_case(case: dict) -> None:
    if case.get("error"):
        try:
            target_springs_2d(case["input"])
        except SpringError as error:
            if error.code != case["error"]:
                raise AssertionError(f"{case['id']}: {error.code}")
            detail = case.get("error_details")
            if detail:
                if error.body_index != detail["bodyIndex"] or error.axis != detail["axis"] or error.stage != detail["stage"]:
                    raise AssertionError(f"{case['id']}: dynamic detail")
            return
        else:
            raise AssertionError(f"{case['id']}: expected {case['error']}")
    result = target_springs_2d(case["input"])
    equal(result.to_values(), case["output"], case["id"])


def ownership_checks() -> list[str]:
    config = {"state": {"bodies": [{"position": [3.0, -2.0], "velocity": [1.0, -0.5], "strength": 0.125, "retention": 0.75}]},
              "targets": [[10.0, -4.0]]}
    result = target_springs_2d(config)
    baseline = copy.deepcopy(result.to_values())
    config["state"]["bodies"][0]["position"][0] = 99.0
    config["targets"][0][0] = 99.0
    equal(result.to_values(), baseline, "input detachment")
    exported = result.to_values()
    exported["bodies"][0]["position"][0] = 77.0
    equal(result.to_values(), baseline, "to_values export detachment")
    if result.size != 1: raise AssertionError("size")
    equal(result.position_at(0), baseline["bodies"][0]["position"], "position_at")
    equal(result.velocity_at(0), baseline["bodies"][0]["velocity"], "velocity_at")
    if result.strength_at(0) != baseline["bodies"][0]["strength"]: raise AssertionError("strength_at")
    if result.retention_at(0) != baseline["bodies"][0]["retention"]: raise AssertionError("retention_at")
    target = [9.0, 9.0]
    if result.position_into(0, target) is not target: raise AssertionError("position_into return")
    equal(target, baseline["bodies"][0]["position"], "position_into values")

    class ReadOnlyList(list): pass
    for bad in (tuple([1.0, 2.0]), array("f", [1.0, 2.0]), ReadOnlyList([1.0]), [1.0], {}, None):
        before = copy.deepcopy(bad)
        for accessor in (lambda: result.position_into(0, bad), lambda: result.velocity_into(0, bad)):
            try:
                accessor()
            except SpringError as error:
                if error.code != "INVALID_OUTPUT":
                    raise
            else:
                raise AssertionError("accepted invalid output carrier")
        if bad != before:
            raise AssertionError("invalid output mutated destination")
    for out in ([9.0, 9.0], array("d", [9.0, 9.0])):
        result.position_into(0, out)
        equal(list(out), baseline["bodies"][0]["position"], "valid position_into")

    for index in (-1, True, 0.5, float("nan"), float("inf"), 10**1000, "0"):
        for accessor in (lambda: result.position_at(index), lambda: result.velocity_at(index),
                         lambda: result.strength_at(index), lambda: result.retention_at(index)):
            try:
                accessor()
            except SpringError as error:
                if error.code != "INVALID_INDEX":
                    raise
            else:
                raise AssertionError("accepted invalid index")
    try:
        result.position_at(result.size)
    except SpringError as error:
        if error.code != "INDEX_OUT_OF_RANGE":
            raise
    else:
        raise AssertionError("accepted out-of-range index")

    second = target_springs_2d({"state": result.to_values(), "targets": [[10.0, -4.0]]})
    if second.to_values() == result.to_values():
        raise AssertionError("state did not advance on feedback call")
    return ["input containers detached", "to_values export detached", "at/into accessors", "invalid outputs atomic",
            "index/range precedence", "state feeds back as next input"]


def native_access_checks() -> list[str]:
    base = {"state": {"bodies": [{"position": [0.0, 0.0], "velocity": [0.0, 0.0], "strength": 1.0, "retention": 1.0}]}, "targets": [[1.0, 1.0]]}
    def rejected(action, code):
        try:
            action()
        except SpringError as error:
            if error.code != code:
                raise AssertionError((code, error.code))
        else:
            raise AssertionError("accepted invalid native value")
    for value in (float("nan"), float("inf"), -float("inf"), 10**1000, True):
        bad_body = {**base["state"]["bodies"][0], "strength": value}
        rejected(lambda: target_springs_2d({"state": {"bodies": [bad_body]}, "targets": base["targets"]}), "INVALID_INPUT")
    class Mapping(dict): pass
    class Pair(list): pass
    for bad in (Mapping(base), {"state": {"bodies": Pair([base["state"]["bodies"][0]])}, "targets": base["targets"]}):
        rejected(lambda: target_springs_2d(bad), "INVALID_INPUT")
    return ["nonfinite/huge-integer/bool input domains", "custom mappings/pairs rejected"]


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--output", required=True, type=Path); args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to((ROOT / ".work").resolve()): raise ValueError("output must stay under .work")
    if output.exists(): raise FileExistsError("refusing occupied output: " + str(output))
    fixture = json.loads(FIXTURE.read_text())
    if fixture["catalog_sha256"] != digest(CATALOG): raise RuntimeError("fixture catalog binding is stale")
    before = hashes()
    for case in fixture["cases"]:
        check_case(case)
    ownership = ownership_checks() + native_access_checks()
    after = hashes()
    if before != after: raise RuntimeError("inputs changed during run")
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "status": "passed", "operation": fixture["operation"],
        "scope": "Python pure fixture and ownership/access conformance only; no renderer or target acceptance claim",
        "catalog_sha256": digest(CATALOG), "input_sha256_before": before, "input_sha256_after": after,
        "scenarios": {
            "fixture_cases": {"total": len(fixture["cases"]), "executed": len(fixture["cases"])},
            "ownership_access": {"executed": len(ownership), "checks": ownership},
        },
    }
    with output.open("x") as stream:
        stream.write(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": "passed", "output": str(output.relative_to(ROOT)), "fixture_cases": len(fixture["cases"])}))
    return 0


if __name__ == "__main__":
    try: raise SystemExit(main())
    except Exception as error: print(str(error), file=sys.stderr); raise SystemExit(1)
