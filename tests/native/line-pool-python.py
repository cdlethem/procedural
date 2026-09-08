#!/usr/bin/env python3
"""Run the frozen seeded-line-pool-2d fixtures against the Python native port."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "catalog/operations/seeded-line-pool-2d.json"
FIXTURE = ROOT / "fixtures/operations/seeded-line-pool-2d.json"
SOURCE = ROOT / "packages/python/procedurals/line_pool.py"
FDLIBM = ROOT / "packages/python/procedurals/_fdlibm_trig.py"
SELF = Path(__file__).resolve()
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.line_pool import LinePoolError, seeded_line_pool_2d


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes() -> dict[str, str]:
    return {str(path.relative_to(ROOT)): digest(path)
            for path in (CATALOG, FIXTURE, SOURCE, FDLIBM, SELF)}


def equal(actual, expected, label: str) -> None:
    if type(actual) is not type(expected) and not (isinstance(actual, (int, float)) and isinstance(expected, (int, float))):
        raise AssertionError(f"{label}: type {type(actual)} vs {type(expected)}")
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
            seeded_line_pool_2d(case["input"])
        except LinePoolError as error:
            if error.code != case["error"]:
                raise AssertionError(f"{case['id']}: {error.code}")
            for key, expected in (case.get("error_detail") or {}).items():
                attribute = {"attempt": "attempt", "stage": "stage", "childOrdinal": "childOrdinal", "selectedIndex": "selectedIndex"}[key]
                if getattr(error, attribute) != expected:
                    raise AssertionError(f"{case['id']}.{key}: {getattr(error, attribute)!r} != {expected!r}")
            return
        else:
            raise AssertionError(f"{case['id']}: expected {case['error']}")
    result = seeded_line_pool_2d(case["input"])
    equal(result.to_values(), case["output"], case["id"])


def ownership_checks() -> list[str]:
    config = {"seed": 12, "segment": [0.0, 0.0, 1.0, 0.0], "attempts": 1, "firstCutAngleScale": 1.0, "minCutLength": 1.0, "maxSegments": 3}
    result = seeded_line_pool_2d(config)
    baseline = copy.deepcopy(result.to_values())
    config["segment"][0] = 99
    config["seed"] = 99
    equal(result.to_values(), baseline, "input detachment")
    exported = result.to_values()
    exported["segments"][0][0] = 77
    exported["divided"][0] = True
    equal(result.to_values(), baseline, "to_values export detachment")
    if result.size != len(baseline["segments"]): raise AssertionError("size")
    equal(result.segment_at(0), baseline["segments"][0], "segment_at")
    if result.divided_at(0) != baseline["divided"][0]: raise AssertionError("divided_at")

    target = [9, 9, 9, 9]
    if result.segment_into(0, target) is not target: raise AssertionError("segment_into return")
    equal(target, baseline["segments"][0], "segment_into values")

    wide = [0, 0, 0, 0, 0, 0]
    result.segment_into(0, wide, 2)
    equal(wide[2:], baseline["segments"][0], "segment_into offset")
    try:
        result.segment_into(0, [0, 0, 0, 0], 1)
    except LinePoolError as error:
        if error.code != "INVALID_OUTPUT": raise
    else:
        raise AssertionError("accepted out-of-bounds offset")

    for bad in (tuple([1, 2, 3, 4]), [1, 2, 3], {}, None):
        before = copy.deepcopy(bad)
        try:
            result.segment_into(0, bad)
        except LinePoolError as error:
            if error.code != "INVALID_OUTPUT": raise
        else:
            raise AssertionError("accepted invalid output carrier")
        if bad != before:
            raise AssertionError("invalid output mutated destination")

    for index in (-1, True, 0.5, float("nan"), float("inf"), 10**1000, "0"):
        for accessor in (lambda: result.segment_at(index), lambda: result.divided_at(index),
                         lambda: result.segment_into(index, [0, 0, 0, 0])):
            try:
                accessor()
            except LinePoolError as error:
                if error.code != "INVALID_INDEX": raise
            else:
                raise AssertionError("accepted invalid index")
    try:
        result.segment_at(result.size)
    except LinePoolError as error:
        if error.code != "INDEX_OUT_OF_RANGE": raise
    else:
        raise AssertionError("accepted out-of-range index")
    equal(result.segment_at(-0.0), result.segment_at(0), "negative-zero index")

    return ["input containers detached", "to_values export detached", "at/into accessors", "offset precedence",
            "invalid outputs atomic", "index/range precedence"]


def native_access_checks() -> list[str]:
    base = {"seed": 12, "segment": [0.0, 0.0, 1.0, 0.0], "attempts": 1, "firstCutAngleScale": 1.0, "minCutLength": 1.0, "maxSegments": 3}

    def rejected(action, code):
        try:
            action()
        except LinePoolError as error:
            if error.code != code:
                raise AssertionError((code, error.code))
        else:
            raise AssertionError("accepted invalid native value")

    for value in (float("nan"), float("inf"), float("-inf")):
        rejected(lambda value=value: seeded_line_pool_2d({**base, "minCutLength": value}), "INVALID_INPUT")
    for bad in (True, "12", 10**40):
        rejected(lambda bad=bad: seeded_line_pool_2d({**base, "seed": bad}), "INVALID_INPUT")

    class Mapping(dict): pass
    class Pair(list): pass
    rejected(lambda: seeded_line_pool_2d(Mapping(base)), "INVALID_INPUT")
    rejected(lambda: seeded_line_pool_2d({**base, "segment": Pair(base["segment"])}), "INVALID_INPUT")
    equal(seeded_line_pool_2d(base).to_values(), seeded_line_pool_2d(dict(base)).to_values(), "plain dict parity")
    return ["nonfinite/wrong-type input domains", "custom mappings/pairs rejected"]


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
        "scope": "Python pure fixture and ownership/access conformance only, including the shared fdlibm5.3 sin/cos/atan2 numeric dependency; no renderer or target acceptance claim",
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
