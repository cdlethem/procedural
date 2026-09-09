#!/usr/bin/env python3
import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.binary_cell_partition import PartitionError, binary_cell_partition_2d  # noqa: E402

CATALOG = ROOT / "catalog/operations/binary-cell-partition-2d.json"
FIXTURE = ROOT / "fixtures/operations/binary-cell-partition-2d.json"
SOURCE = ROOT / "packages/python/procedurals/binary_cell_partition.py"
SELF = Path(__file__).resolve()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def name(path):
    return str(path.relative_to(ROOT)).replace("\\", "/")


def hashes():
    return {name(p): sha256(p) for p in (CATALOG, FIXTURE, SOURCE, SELF)}


def check_case(item):
    if "error" not in item:
        result = binary_cell_partition_2d(item["input"])
        assert result.to_values() == item["output"], item["id"]
        return result
    try:
        binary_cell_partition_2d(item["input"])
    except PartitionError as error:
        assert error.code == item["error"], item["id"]
        return None
    raise AssertionError(f"{item['id']}: expected {item['error']}")


def ownership_checks():
    config = {"seed": 42, "columns": 8, "rows": 8, "attempts": 6, "axisPolicy": "RANDOM"}
    result = binary_cell_partition_2d(config)
    baseline = result.to_values()
    config["seed"] = 0
    config["columns"] = 1
    config["axisPolicy"] = "LONGEST"
    assert result.to_values() == baseline, "input record detached after construction"
    result.bounds_at(0)[0] = 77
    detached = result.to_values()
    detached["bounds"][0][0] = 77
    detached["bounds"].clear()
    detached["splits"] = 99
    assert result.to_values() == baseline, "export detached; bounds_at copy detached"
    assert result.size == len(baseline["bounds"])
    assert result.splits == baseline["splits"]

    out = [9, 9, 9, 9]
    assert result.bounds_into(0, out) is out
    assert out == baseline["bounds"][0]

    for bad in ([1, 2, 3], (9, 9, 9, 9), {}, None):
        try:
            result.bounds_into(0, bad)
            raise AssertionError("expected INVALID_OUTPUT")
        except PartitionError as error:
            assert error.code == "INVALID_OUTPUT"

    for index in (-1, True, float("nan"), float("inf"), 0.5, 9007199254740992, "0"):
        for access in (lambda: result.bounds_at(index), lambda: result.bounds_into(index, [9, 9, 9, 9])):
            try:
                access()
                raise AssertionError("expected INVALID_INDEX")
            except PartitionError as error:
                assert error.code == "INVALID_INDEX"

    for index in (result.size, 9007199254740991):
        for access in (lambda: result.bounds_at(index), lambda: result.bounds_into(index, [9, 9, 9, 9])):
            try:
                access()
                raise AssertionError("expected INDEX_OUT_OF_RANGE")
            except PartitionError as error:
                assert error.code == "INDEX_OUT_OF_RANGE"

    assert result.to_values() == baseline
    return ["input record detached after construction", "bounds_at/export detached", "ordinary list output",
            "wrong-typed outputs rejected", "index precedence: INVALID_INDEX before INDEX_OUT_OF_RANGE"]


def native_checks():
    base = {"seed": 42, "columns": 8, "rows": 8, "attempts": 6, "axisPolicy": "RANDOM"}
    for value in (float("nan"), float("inf"), float("-inf"), 1.5, True):
        for key in ("seed", "columns", "rows", "attempts"):
            try:
                binary_cell_partition_2d({**base, key: value})
                raise AssertionError(f"expected INVALID_INPUT for {key}={value}")
            except PartitionError as error:
                assert error.code == "INVALID_INPUT"
    for bad in ({**base, "axisPolicy": "random"}, {**base, "extra": 1}, None, [1, 2, 3, 4, 5]):
        try:
            binary_cell_partition_2d(bad)
            raise AssertionError(f"expected INVALID_INPUT for {bad}")
        except PartitionError as error:
            assert error.code == "INVALID_INPUT"
    return ["nonfinite/fractional/boolean carriers", "unknown axisPolicy", "extra/missing keys", "non-record input"]


def main():
    if len(sys.argv) != 3 or sys.argv[1] != "--output":
        raise SystemExit("Usage: --output FRESH_JSON_PATH")
    output = Path(sys.argv[2]).resolve()
    work_dir = (ROOT / ".work").resolve()
    if work_dir not in output.parents or output.exists():
        raise SystemExit("Output must be fresh and under .work")
    fixture = json.loads(FIXTURE.read_bytes())
    assert fixture["catalog_sha256"] == sha256(CATALOG), "fixture catalog binding"
    before = hashes()
    t0 = time.time()
    for item in fixture["cases"]:
        check_case(item)
    ownership = ownership_checks()
    native = native_checks()
    after = hashes()
    assert after == before, "source stability"
    report = {
        "status": "passed", "operation": fixture["operation"], "python_version": sys.version,
        "scope": "Actual Python module fixture/carrier/ownership checks. No renderer/acceptance claim.",
        "input_sha256_before": before, "input_sha256_after": after,
        "scenarios": {"fixture_cases": len(fixture["cases"]), "ownership_access": ownership, "native_only": native},
        "wall_time_seconds": time.time() - t0,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": report["status"], "output": str(output), "scenarios": report["scenarios"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
