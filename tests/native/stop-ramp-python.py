#!/usr/bin/env python3
"""Run the frozen stop-ramp fixtures against the Python native port."""
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
CATALOG = ROOT / "catalog/operations/stop-ramp.json"
FIXTURE = ROOT / "fixtures/operations/stop-ramp.json"
SOURCE = ROOT / "packages/python/procedurals/stop_ramp.py"
SELF = Path(__file__).resolve()
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.stop_ramp import StopRampError, stop_ramp


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


def check_case(case: dict):
    if case.get("error"):
        try:
            stop_ramp(case["input"])
        except StopRampError as error:
            if error.code != case["error"]:
                raise AssertionError(f"{case['id']}: {error.code}")
            return None
        else:
            raise AssertionError(f"{case['id']}: expected {case['error']}")
    ramp = stop_ramp(case["input"])
    equal(ramp.serialize(), case["serialized"], case["id"])
    for query in case["queries"]:
        if ramp.sample(query["input"]) != query["output"]:
            raise AssertionError(f"{case['id']}: query {query['input']}")
    return ramp


def check_query_cases(fixture: dict, base_ramp) -> int:
    for item in fixture["query_cases"]:
        try:
            base_ramp.sample(item["input"])
        except StopRampError as error:
            if error.code != item["error"]:
                raise AssertionError(f"{item['id']}: {error.code}")
        else:
            raise AssertionError(f"{item['id']}: expected {item['error']}")
    return len(fixture["query_cases"])


def ownership_checks() -> list[str]:
    config = {"stops": [{"position": 0.25, "color": 0xFF0000}, {"position": 0.75, "color": 0x0000FF}]}
    ramp = stop_ramp(config)
    baseline = copy.deepcopy(ramp.serialize())
    config["stops"][0]["position"] = 0.99
    config["stops"].append({"position": 0.9, "color": 1})
    equal(ramp.serialize(), baseline, "input detachment")
    exported = ramp.serialize()
    exported["stops"][0]["position"] = 0.01
    exported["stops"].append({"position": 0.5, "color": 9})
    equal(ramp.serialize(), baseline, "export detachment")
    if ramp.sample(0) != 0xFF0000 or ramp.sample(1) != 0x0000FF:
        raise AssertionError("sample after mutation attempt")
    return ["input containers detached", "serialize export detached"]


def native_access_checks() -> list[str]:
    base = {"stops": [{"position": 0.0, "color": 0}, {"position": 1.0, "color": 0xFFFFFF}]}
    def rejected(action, code):
        try:
            action()
        except StopRampError as error:
            if error.code != code:
                raise AssertionError((code, error.code))
        else:
            raise AssertionError("accepted invalid native value")
    for value in (float("nan"), float("inf"), -float("inf"), 10**1000, True):
        rejected(lambda: stop_ramp({"stops": [{"position": value, "color": 0}, base["stops"][1]]}), "INVALID_INPUT")
        rejected(lambda: stop_ramp({"stops": [{"position": 0.0, "color": value}, base["stops"][1]]}), "INVALID_INPUT")
    class Mapping(dict): pass
    class Pair(list): pass
    for bad in (Mapping(base), {"stops": Pair([{"position": 0.0, "color": 0}, {"position": 1.0, "color": 1}])},
                {"stops": [array("d", [0.0, 0.0]), base["stops"][1]]}):
        rejected(lambda: stop_ramp(bad), "INVALID_INPUT")
    return ["nonfinite/huge-integer/bool input domains", "custom mappings/pairs rejected"]


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--output", required=True, type=Path); args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to((ROOT / ".work").resolve()): raise ValueError("output must stay under .work")
    if output.exists(): raise FileExistsError("refusing occupied output: " + str(output))
    fixture = json.loads(FIXTURE.read_text())
    if fixture["catalog_sha256"] != digest(CATALOG): raise RuntimeError("fixture catalog binding is stale")
    before = hashes()
    base_ramp = None
    for case in fixture["cases"]:
        ramp = check_case(case)
        if ramp is not None and base_ramp is None:
            base_ramp = ramp
    query_cases = check_query_cases(fixture, base_ramp)
    ownership = ownership_checks() + native_access_checks()
    after = hashes()
    if before != after: raise RuntimeError("inputs changed during run")
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "status": "passed", "operation": fixture["operation"],
        "scope": "Python pure fixture, query and ownership/access conformance only; no renderer or target acceptance claim",
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
