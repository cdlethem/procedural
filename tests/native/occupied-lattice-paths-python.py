#!/usr/bin/env python3
"""Run the frozen occupied-lattice-paths-2d fixtures against the Python native port."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "catalog/operations/occupied-lattice-paths-2d.json"
FIXTURE = ROOT / "fixtures/operations/occupied-lattice-paths-2d.json"
SOURCE = ROOT / "packages/python/procedurals/occupied_lattice_paths.py"
SELF = Path(__file__).resolve()
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.occupied_lattice_paths import LatticeError, occupied_lattice_paths_2d


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes() -> dict[str, str]:
    return {str(path.relative_to(ROOT)): digest(path)
            for path in (CATALOG, FIXTURE, SOURCE, SELF)}


def equal(actual, expected, label: str) -> None:
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
            occupied_lattice_paths_2d(case["input"])
        except LatticeError as error:
            if error.code != case["error"]:
                raise AssertionError(f"{case['id']}: {error.code}")
            return None
        else:
            raise AssertionError(f"{case['id']}: expected {case['error']}")
    result = occupied_lattice_paths_2d(case["input"])
    equal(result.to_values(), case["output"], case["id"])
    return result


def ownership_checks() -> list[str]:
    config = {"dimensions": [3, 3], "starts": [[1, 1]], "maxSteps": 2, "maxCells": 6, "random": {"seed": 42}}
    result = occupied_lattice_paths_2d(config)
    baseline = copy.deepcopy(result.to_values())
    config["starts"][0][0] = 99
    config["dimensions"][0] = 99
    config["random"]["seed"] = 99
    equal(result.to_values(), baseline, "input detachment")
    exported = result.to_values()
    exported["paths"][0][0][0] = 77
    exported["randomState"][0] = 77
    equal(result.to_values(), baseline, "to_values export detachment")
    if result.path_count != len(baseline["paths"]): raise AssertionError("path_count")
    if result.path_length_at(0) != len(baseline["paths"][0]): raise AssertionError("path_length_at")
    equal(result.cell_at(0, 0), baseline["paths"][0][0], "cell_at")
    if result.completion_reason_at(0) != baseline["completionReasons"][0]: raise AssertionError("completion_reason_at")
    equal(result.random_state(), baseline["randomState"], "random_state")
    random_state_exported = result.random_state()
    random_state_exported[0] = 77
    equal(result.random_state(), baseline["randomState"], "random_state export detachment")

    target = [9, 9]
    if result.cell_into(0, 0, target) is not target: raise AssertionError("cell_into return")
    equal(target, baseline["paths"][0][0], "cell_into values")

    for bad in (tuple([1, 2]), [1], {}, None):
        before = copy.deepcopy(bad)
        try:
            result.cell_into(0, 0, bad)
        except LatticeError as error:
            if error.code != "INVALID_OUTPUT":
                raise
        else:
            raise AssertionError("accepted invalid output carrier")
        if bad != before:
            raise AssertionError("invalid output mutated destination")
    for out in ([9, 9], array("i", [9, 9])):
        result.cell_into(0, 0, out)
        equal(list(out), baseline["paths"][0][0], "valid cell_into")

    for index in (-1, True, 0.5, float("nan"), float("inf"), 10**1000, "0"):
        for accessor in (lambda: result.path_length_at(index), lambda: result.completion_reason_at(index),
                         lambda: result.cell_at(index, 0), lambda: result.cell_at(0, index)):
            try:
                accessor()
            except LatticeError as error:
                if error.code != "INVALID_INDEX":
                    raise
            else:
                raise AssertionError("accepted invalid index")
    try:
        result.path_length_at(result.path_count)
    except LatticeError as error:
        if error.code != "INDEX_OUT_OF_RANGE":
            raise
    else:
        raise AssertionError("accepted out-of-range path index")
    try:
        result.cell_at(0, result.path_length_at(0))
    except LatticeError as error:
        if error.code != "INDEX_OUT_OF_RANGE":
            raise
    else:
        raise AssertionError("accepted out-of-range cell index")

    second = occupied_lattice_paths_2d({"dimensions": [3, 3], "starts": [[0, 0]], "maxSteps": 1, "maxCells": 2, "random": {"state": result.random_state()}})
    if len(second.random_state()) != 4:
        raise AssertionError("continuation state shape")
    return ["input containers detached", "to_values/random_state export detached", "at/into accessors",
            "invalid outputs rejected", "index/range precedence", "random.state continuation"]


def native_access_checks() -> list[str]:
    base = {"dimensions": [2, 2], "starts": [[0, 0]], "maxSteps": 1, "maxCells": 2, "random": {"seed": 1}}
    def rejected(action, code):
        try:
            action()
        except LatticeError as error:
            if error.code != code:
                raise AssertionError((code, error.code))
        else:
            raise AssertionError("accepted invalid native value")
    class Mapping(dict): pass
    class Pair(list): pass
    for bad in (Mapping(base), {**base, "random": {"seed": 1, "state": [1, 0, 0, 0]}},
                {**base, "starts": Pair([[0, 0]])}):
        rejected(lambda: occupied_lattice_paths_2d(bad), "INVALID_INPUT")
    return ["nonfinite/wrong-shape carriers", "custom mappings/pairs rejected"]


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
