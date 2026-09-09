#!/usr/bin/env python3
import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.retained_rectangle_cuts import RectangleCutError, retained_rectangle_cuts_2d  # noqa: E402

CATALOG = ROOT / "catalog/operations/retained-rectangle-cuts-2d.json"
FIXTURE = ROOT / "fixtures/operations/retained-rectangle-cuts-2d.json"
SOURCE = ROOT / "packages/python/procedurals/retained_rectangle_cuts.py"
SELF = Path(__file__).resolve()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def name(path):
    return str(path.relative_to(ROOT)).replace("\\", "/")


def hashes():
    return {name(p): sha256(p) for p in (CATALOG, FIXTURE, SOURCE, SELF)}


def expect_code(fn, code, message):
    try:
        fn()
        raise AssertionError(f"{message}: expected {code}")
    except RectangleCutError as error:
        assert error.code == code, f"{message}: expected {code}, got {error.code}"


def check_creation_case(item):
    if "error" not in item:
        model = retained_rectangle_cuts_2d(item["input"])
        assert model.to_values() == item["output"], item["id"]
        return
    expect_code(lambda: retained_rectangle_cuts_2d(item["input"]), item["error"], item["id"])


def run_command(model, command):
    if command["op"] == "cut":
        return model.cut(command["id"], command["axis"], command["coordinate"])
    if command["op"] == "remove":
        return model.remove(command["id"])
    raise AssertionError("Unhandled command op: " + command["op"])


def check_command_case(item):
    model = retained_rectangle_cuts_2d(item["input"])
    if "error" not in item:
        last_return = None
        for command in item["commands"]:
            last_return = run_command(model, command)
        assert model.to_values() == item["output"], item["id"]
        return last_return
    for command in item["commands"][:-1]:
        run_command(model, command)
    expect_code(lambda: run_command(model, item["commands"][-1]), item["error"], item["id"])
    assert model.to_values() == item["after_error"], item["id"] + " after_error"
    if "recovery" in item:
        result = run_command(model, item["recovery"]["command"])
        if "returns" in item["recovery"]:
            assert result == item["recovery"]["returns"], item["id"] + " recovery return"
        assert model.to_values() == item["recovery"]["output"], item["id"] + " recovery output"


def ownership_checks():
    config = {"bounds": [0, 0, 10, 8]}
    model = retained_rectangle_cuts_2d(config)
    config["bounds"][0] = 99
    config["bounds"].append(1)
    assert model.to_values() == {"nextId": 1, "leaves": [{"id": 0, "bounds": [0, 0, 10, 8]}]}, "input record detached"

    leaf0 = model.leaf(0)
    try:
        leaf0["bounds"] = (77, 77, 77, 77)
        raise AssertionError("leaf value should be immutable")
    except TypeError:
        pass

    low_id, high_id = model.cut(0, "X", 4)
    assert (low_id, high_id) == (1, 2)
    leaves = model.leaves()
    leaves.append("junk")
    leaves[0] = "mutated"
    assert len(model.leaves()) == 2, "leaves() detached"

    detached = model.to_values()
    detached["leaves"][0]["bounds"][0] = 77
    detached["leaves"].clear()
    detached["nextId"] = 99
    assert model.to_values() == {"nextId": 3, "leaves": [{"id": 1, "bounds": [0, 0, 4, 8]}, {"id": 2, "bounds": [4, 0, 10, 8]}]}

    expect_code(lambda: model.leaf(0), "UNKNOWN_ID", "stale leaf")
    expect_code(lambda: model.cut(0, "X", 2), "UNKNOWN_ID", "stale cut")
    expect_code(lambda: model.remove(0), "UNKNOWN_ID", "stale remove")
    for identity in (-1, 0.5, 9007199254740991, True, float("nan"), "1"):
        for access in (lambda i=identity: model.leaf(i), lambda i=identity: model.cut(i, "X", 1), lambda i=identity: model.remove(i)):
            expect_code(access, "INVALID_ID", f"id={identity}")
    return ["input record detached after construction", "leaf values immutable", "leaves()/to_values() detached",
            "stale id precedence: UNKNOWN_ID after removal", "id domain: INVALID_ID before UNKNOWN_ID"]


def native_checks():
    expect_code(lambda: retained_rectangle_cuts_2d(None), "INVALID_INPUT", "non-record")
    expect_code(lambda: retained_rectangle_cuts_2d({"bounds": [0, 0, 10, 8], "extra": 1}), "INVALID_INPUT", "extra key")
    expect_code(lambda: retained_rectangle_cuts_2d({"bounds": [0, 0, 10]}), "INVALID_INPUT", "wrong length")
    expect_code(lambda: retained_rectangle_cuts_2d({"bounds": [0, 0, 10, "8"]}), "INVALID_INPUT", "string carrier")
    expect_code(lambda: retained_rectangle_cuts_2d({"bounds": [float("nan"), 0, 10, 8]}), "INVALID_INPUT", "nonfinite")
    expect_code(lambda: retained_rectangle_cuts_2d({"bounds": [0, 0, 0, 8]}), "INVALID_INPUT", "degenerate")
    model = retained_rectangle_cuts_2d({"bounds": [0, 0, 10, 8]})
    expect_code(lambda: model.cut(0, "Z", 4), "INVALID_INPUT", "unknown axis")
    expect_code(lambda: model.cut(0, "X", float("nan")), "INVALID_INPUT", "nonfinite coordinate")
    expect_code(lambda: model.cut(0, "X", 0), "INVALID_CUT", "boundary coordinate low")
    expect_code(lambda: model.cut(0, "X", 10), "INVALID_CUT", "boundary coordinate high")
    return ["non-record/wrong-length/string/nonfinite/degenerate creation inputs", "unknown axis/nonfinite/boundary cut coordinate"]


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
        check_creation_case(item)
    for item in fixture["command_cases"]:
        check_command_case(item)
    ownership = ownership_checks()
    native = native_checks()
    after = hashes()
    assert after == before, "source stability"
    report = {
        "status": "passed", "operation": fixture["operation"], "python_version": sys.version,
        "scope": "Actual Python module creation/command/carrier/ownership checks. No renderer/acceptance claim.",
        "input_sha256_before": before, "input_sha256_after": after,
        "scenarios": {
            "creation_cases": len(fixture["cases"]), "command_cases": len(fixture["command_cases"]),
            "ownership_access": ownership, "native_only": native,
        },
        "wall_time_seconds": time.time() - t0,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": report["status"], "output": str(output), "scenarios": report["scenarios"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
