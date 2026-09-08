#!/usr/bin/env python3
"""Run the frozen noise-band-path fixtures against the Python native port."""
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
CATALOG = ROOT / "catalog/operations/noise-band-path.json"
FIXTURE = ROOT / "fixtures/operations/noise-band-path.json"
SOURCES = [
    ROOT / "packages/python/procedurals/noise_band_path.py",
    ROOT / "packages/python/procedurals/fields.py",
    ROOT / "packages/python/procedurals/_fdlibm_trig.py",
]
SELF = Path(__file__).resolve()
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.noise_band_path import NoiseBandPathError, noise_band_path_2d


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes() -> dict[str, str]:
    return {str(path.relative_to(ROOT)): digest(path)
            for path in (CATALOG, FIXTURE, *SOURCES, SELF)}


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


def check_case(case: dict):
    if case.get("error"):
        try:
            noise_band_path_2d(case["input"])
        except NoiseBandPathError as error:
            if error.code != case["error"]:
                raise AssertionError(f"{case['id']}: {error.code}")
            detail = case.get("error_detail")
            if detail:
                if error.attempt_index != detail["attemptIndex"] or error.stage != detail["stage"]:
                    raise AssertionError(f"{case['id']}: dynamic detail")
            return None
        else:
            raise AssertionError(f"{case['id']}: expected {case['error']}")
    path = noise_band_path_2d(case["input"])
    equal(path.to_values(), case["output"], case["id"])
    return path


def ownership_checks() -> list[str]:
    config = {"field": {"seed": 177}, "start": [320.0, 320.0], "heading": 0.0, "seed": 0, "attempts": 12,
              "stepDistance": 1.0, "fieldScale": 0.006, "fieldOffset": [7.3, 11.7], "tolerance": 0.002, "maxVertices": 13}
    path = noise_band_path_2d(config)
    baseline = copy.deepcopy(path.to_values())
    config["start"][0] = 99.0
    config["field"]["seed"] = 99
    config["fieldOffset"][0] = 99.0
    equal(path.to_values(), baseline, "input detachment")
    exported = path.to_values()
    exported["positions"][0][0] = 77.0
    exported["headings"][0] = 77.0
    equal(path.to_values(), baseline, "to_values export detachment")
    serialized = path.serialize()
    serialized["start"][0] = 77.0
    serialized["field"]["seed"] = 77
    equal(path.serialize(), path.serialize(), "serialize stable")
    if path.serialize()["start"][0] == 77.0:
        raise AssertionError("serialize export detachment")

    if path.size != len(baseline["positions"]): raise AssertionError("size")
    if path.attempts != baseline["attempts"]: raise AssertionError("attempts")
    if path.accepted != baseline["accepted"]: raise AssertionError("accepted")
    if path.rejected != baseline["rejected"]: raise AssertionError("rejected")
    equal(path.point_at(0), baseline["positions"][0], "point_at")
    if path.heading_at(0) != baseline["headings"][0]: raise AssertionError("heading_at")
    target = [9.0, 9.0]
    if path.point_into(0, target) is not target: raise AssertionError("point_into return")
    equal(target, baseline["positions"][0], "point_into values")

    class ReadOnlyList(list): pass
    for bad in (tuple([1.0, 2.0]), array("f", [1.0, 2.0]), ReadOnlyList([1.0]), [1.0], {}, None):
        before = copy.deepcopy(bad)
        try:
            path.point_into(0, bad)
        except NoiseBandPathError as error:
            if error.code != "INVALID_OUTPUT":
                raise
        else:
            raise AssertionError("accepted invalid output carrier")
        if bad != before:
            raise AssertionError("invalid output mutated destination")
    for out in ([9.0, 9.0], array("d", [9.0, 9.0])):
        path.point_into(0, out)
        equal(list(out), baseline["positions"][0], "valid point_into")

    for index in (-1, True, 0.5, float("nan"), float("inf"), 10**1000, "0"):
        for accessor in (lambda: path.point_at(index), lambda: path.heading_at(index),
                         lambda: path.point_into(index, [0.0, 0.0])):
            try:
                accessor()
            except NoiseBandPathError as error:
                if error.code != "INVALID_INDEX":
                    raise
            else:
                raise AssertionError("accepted invalid index")
    try:
        path.point_at(path.size)
    except NoiseBandPathError as error:
        if error.code != "INDEX_OUT_OF_RANGE":
            raise
    else:
        raise AssertionError("accepted out-of-range point index")
    try:
        path.heading_at(baseline["accepted"])
    except NoiseBandPathError as error:
        if error.code != "INDEX_OUT_OF_RANGE":
            raise
    else:
        raise AssertionError("accepted out-of-range heading index")
    return ["input containers detached", "to_values/serialize export detached", "point_into atomic/typed outputs", "index/range precedence"]


def native_access_checks() -> list[str]:
    base = {"field": {"seed": 1}, "start": [0.0, 0.0], "heading": 0.0, "seed": 1, "attempts": 3,
            "stepDistance": 1.0, "fieldScale": 0.01, "fieldOffset": [0.0, 0.0], "tolerance": 0.5, "maxVertices": 10}
    def rejected(action, code):
        try:
            action()
        except NoiseBandPathError as error:
            if error.code != code:
                raise AssertionError((code, error.code))
        else:
            raise AssertionError("accepted invalid native value")
    for value in (float("nan"), float("inf"), -float("inf"), 10**1000, True):
        rejected(lambda: noise_band_path_2d({**base, "heading": value}), "INVALID_INPUT")
    class Mapping(dict): pass
    class Pair(list): pass
    for bad in (Mapping(base), {**base, "start": Pair([0.0, 0.0])}):
        rejected(lambda: noise_band_path_2d(bad), "INVALID_INPUT")
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
        "scope": "Python pure fixture and ownership/access conformance only, using a bit-exact ported fdlibm5.3 sin/cos verified against java.lang.StrictMath.sin/cos and the existing gradient_noise_2d_01 field; no renderer or target acceptance claim",
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
