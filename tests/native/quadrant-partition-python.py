#!/usr/bin/env python3
"""Run the frozen quadrant-partition fixtures against the Python native port."""
from __future__ import annotations

import argparse
from array import array
import copy
import hashlib
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "catalog/operations/seeded-quadrant-partition.json"
FIXTURE = ROOT / "fixtures/operations/seeded-quadrant-partition.json"
SOURCE = ROOT / "packages/python/procedurals/quadrant_partition.py"
SELF = Path(__file__).resolve()
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.quadrant_partition import (PartitionError, _Stream,
                                             seeded_quadrant_partition_2d)


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
        result = seeded_quadrant_partition_2d(case["input"])
    except PartitionError as error:
        if case.get("error") != error.code: raise AssertionError(f"{case['id']}: {error.code}")
        detail = case.get("error_detail")
        if detail and (error.replacement_index != detail["replacementIndex"] or error.stage != detail["stage"]):
            raise AssertionError(f"{case['id']}: dynamic detail")
        return None
    if case.get("error"): raise AssertionError(f"{case['id']}: expected {case['error']}")
    equal(result.to_values(), case["output"], case["id"])
    return result


def stream_vectors(fixture: dict) -> None:
    for vector in fixture["seed_vectors"]:
        stream = _Stream(vector["seed"])
        units = _Stream(vector["seed"])
        if list(stream.state()) != vector["initial_state"]: raise AssertionError("initial stream state")
        for expected in vector["first_10"]:
            actual = stream.output()
            if actual != expected["output_u32"]: raise AssertionError("stream output")
            if stream.state() != expected["post_state"]: raise AssertionError("stream post-state")
            if bits(units.unit()) != bits(expected["unit"]): raise AssertionError("stream unit")


def instrumentation(fixture: dict) -> dict[str, int]:
    original = _Stream.unit
    counts: dict[str, int] = {}
    for case in fixture["cases"]:
        count = 0
        def counted(self, _original=original):
            nonlocal count
            count += 1
            return _original(self)
        _Stream.unit = counted
        try:
            try: seeded_quadrant_partition_2d(case["input"])
            except PartitionError: pass
        finally:
            _Stream.unit = original
        expected = len(case.get("selection_trace", []))
        if count != expected: raise AssertionError(f"{case['id']}: drew {count}, expected {expected}")
        counts[case["id"]] = count
    return counts


def ownership_checks() -> list[str]:
    config = {"seed": 42, "replacements": 2, "origin": [0.0, 0.0], "extent": [16.0, 16.0], "selectionFraction": 1.0}
    result = seeded_quadrant_partition_2d(config)
    baseline = copy.deepcopy(result.to_values())
    config["origin"][:] = [99.0, 99.0]
    config["extent"][:] = [1.0, 1.0]
    config["seed"] = 0
    config["replacements"] = 0
    equal(result.to_values(), baseline, "input detachment")
    detached = result.bounds_at(0); detached[0] = 77.0
    equal(result.to_values(), baseline, "bounds detachment")
    exported = result.to_values(); exported["bounds"][0][0] = 77.0; exported["ids"][0] = 77
    equal(result.to_values(), baseline, "export detachment")
    destination = [9.0] * 6
    if result.bounds_into(0, destination, 1) is not None: raise AssertionError("bounds_into return")
    equal(destination[1:5], baseline["bounds"][0], "bounds_into")
    class ReadOnlyList(list): pass
    for bad in (tuple([1.0] * 4), array("f", [1.0] * 4), ReadOnlyList([1.0] * 4), [1.0, 2.0, 3.0]):
        before = copy.deepcopy(bad)
        try: result.bounds_into(0, bad, 0)
        except PartitionError as error:
            if error.code != "INVALID_OUTPUT": raise
        else: raise AssertionError("accepted invalid output carrier")
        if list(bad) != list(before): raise AssertionError("invalid output mutated destination")
    for bad in ({**config, "origin": (0.0, 0.0)}, ReadOnlyList(config.items()), type("Config", (), config)()):
        try: seeded_quadrant_partition_2d(bad)
        except PartitionError as error:
            if error.code != "INVALID_INPUT": raise
        else: raise AssertionError("accepted custom input carrier")
    for bad in ({**config, "seed": 10**100}, {**config, "replacements": 10**100}):
        try: seeded_quadrant_partition_2d(bad)
        except PartitionError as error:
            if error.code != "INVALID_INPUT": raise
        else: raise AssertionError("accepted overflowing integer")
    return ["input containers detached", "bounds/to_values detached", "bounds_into atomic", "output carriers rejected", "custom carriers rejected", "huge integers rejected"]


def cross_checks(fixture: dict, results: dict[str, object], counts: dict[str, int]) -> int:
    checks = fixture["cross_case_checks"]
    if counts["zero-replacements-root"] != 0: raise AssertionError("zero replacement draw")
    selected = next(case for case in fixture["cases"] if case["id"] == "selected-middle-parent-live-list-order")
    if counts[selected["id"]] != selected["input"]["replacements"]: raise AssertionError("one draw per replacement")
    ids = results[selected["id"]].to_values()["ids"]
    if ids != selected["output"]["ids"]: raise AssertionError("birth identity order")
    short = results[selected["id"]].to_values(); long = results["longer-replacement-history-not-final-prefix"].to_values()
    if len(long["ids"]) <= len(short["ids"]): raise AssertionError("long run did not grow")
    if all(short["ids"][i] == long["ids"][i] and short["bounds"][i] == long["bounds"][i] for i in range(len(short["ids"]))):
        raise AssertionError("long final output unexpectedly has short prefix")
    return len(checks)


def native_access_checks():
    base = {"seed": 42, "replacements": 2, "origin": [0, 0], "extent": [16, 16], "selectionFraction": 1}
    result = seeded_quadrant_partition_2d(base)
    def rejected(action, code):
        try:
            action()
        except PartitionError as error:
            if error.code != code:
                raise AssertionError((code, error.code))
        else:
            raise AssertionError("accepted invalid native value")
    for value in (float("nan"), float("inf"), -float("inf"), 10**1000, True):
        for key in ("seed", "replacements", "selectionFraction"):
            rejected(lambda: seeded_quadrant_partition_2d({**base, key: value}), "INVALID_INPUT")
        for key in ("origin", "extent"):
            for axis in (0, 1):
                pair = list(base[key]); pair[axis] = value
                rejected(lambda: seeded_quadrant_partition_2d({**base, key: pair}), "INVALID_INPUT")
    class Mapping(dict): pass
    class Pair(list): pass
    for bad in (Mapping(base), {**base, "origin": Pair([0, 0])}, {**base, "extent": array("d", [16, 16])}):
        rejected(lambda: seeded_quadrant_partition_2d(bad), "INVALID_INPUT")
    for index in (-1, True, 0.5, float("nan"), float("inf"), 10**1000, "0"):
        for action in (lambda: result.id_at(index), lambda: result.bounds_at(index),
                       lambda: result.bounds_into(index, None, -1)):
            rejected(action, "INVALID_INDEX")
    for index in (result.size, 9007199254740991):
        for action in (lambda: result.id_at(index), lambda: result.bounds_at(index),
                       lambda: result.bounds_into(index, None, -1)):
            rejected(action, "INDEX_OUT_OF_RANGE")
    for offset in (-1, True, 0.5, float("nan"), float("inf"), 10**1000, "0", 2):
        out = [9.0] * 5
        rejected(lambda: result.bounds_into(0, out, offset), "INVALID_OUTPUT")
        if out != [9.0] * 5: raise AssertionError("failed offset mutated destination")
    out = array("d", [9.0] * 6)
    result.bounds_into(0.0, out, 1.0)
    equal(list(out)[1:5], result.bounds_at(0), "binary64 buffer integral float access")
    return ["nonfinite/huge-integer/bool input domains", "custom mappings/pairs rejected",
            "all accessor index/range precedence", "invalid offsets unchanged", "array(d) valid output"]


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
    counts = instrumentation(fixture); stream_vectors(fixture); ownership = ownership_checks() + native_access_checks()
    cross = cross_checks(fixture, results, counts)
    after = hashes()
    if before != after: raise RuntimeError("inputs changed during run")
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {"status": "passed", "operation": fixture["operation"], "scope": "Python pure fixture and ownership/access conformance only; no renderer or target acceptance claim", "catalog_sha256": digest(CATALOG), "input_sha256_before": before, "input_sha256_after": after, "scenarios": {"fixture_cases": {"total": len(fixture["cases"]), "executed": len(fixture["cases"])}, "seed_vectors": {"total": len(fixture["seed_vectors"]), "executed": len(fixture["seed_vectors"])}, "cross_case_checks": {"total": len(fixture["cross_case_checks"]), "executed": cross}, "ownership_access": {"executed": len(ownership), "checks": ownership}, "allocation_failure": {"executed": 0, "reason": "host allocation failure is not safely injectable; native contract requires source proof or explicit unexecuted marker"}}, "auxiliary": {"cross_case_checks": fixture["cross_case_checks"], "native_only_cases": fixture["native_only_cases"], "native_ownership_access_requirements": fixture["native_ownership_access_requirements"], "rng_provenance": fixture["rng_provenance"]}, "fixture_status": fixture["fixture_status"]}
    with output.open("x") as stream:
        stream.write(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": "passed", "output": str(output.relative_to(ROOT)), "fixture_cases": len(fixture["cases"]), "seed_vectors": len(fixture["seed_vectors"]), "cross_case_checks": cross}))
    return 0


if __name__ == "__main__":
    try: raise SystemExit(main())
    except Exception as error: print(str(error), file=sys.stderr); raise SystemExit(1)
