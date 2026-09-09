#!/usr/bin/env python3
import copy
import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.raster_crossfade import RasterCrossfadeError, raster_crossfade_2d  # noqa: E402

CATALOG = ROOT / "catalog/operations/raster-crossfade.json"
FIXTURE = ROOT / "fixtures/operations/raster-crossfade.json"
SOURCE = ROOT / "packages/python/procedurals/raster_crossfade.py"
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
    except RasterCrossfadeError as error:
        assert error.code == code, f"{message}: expected {code}, got {error.code}"


def check_case(item):
    if "error" not in item:
        result = raster_crossfade_2d(item["input"])
        assert result.to_values() == item["output"], item["id"]
        return result
    expect_code(lambda: raster_crossfade_2d(item["input"]), item["error"], item["id"])
    return None


def ownership_checks():
    config = {"first": {"width": 1, "height": 1, "pixels": [0xFF112233]},
              "second": {"width": 1, "height": 1, "pixels": [0xFFAABBCC]}, "weights": [0.5]}
    result = raster_crossfade_2d(copy.deepcopy(config))
    baseline = result.to_values()
    config["first"]["pixels"][0] = 0
    config["weights"][0] = 0
    config["weights"].append(1)
    assert result.to_values() == baseline, "input record detached after construction"
    detached = result.to_values()
    detached["pixels"][0] = 99
    detached["pixels"].clear()
    detached["width"] = 99
    assert result.to_values() == baseline, "export detached"
    px = result.pixels()
    px[0] = 99
    assert result.pixels() == baseline["pixels"], "pixels() detached"
    assert result.width == baseline["width"]
    assert result.height == baseline["height"]
    for index in (-1, True, float("nan"), float("inf"), 0.5, 9007199254740992, "0"):
        expect_code(lambda i=index: result.pixel_at(i), "INVALID_INDEX", f"index={index}")
    for index in (1, 9007199254740991):
        expect_code(lambda i=index: result.pixel_at(i), "INDEX_OUT_OF_RANGE", f"index={index}")
    assert result.to_values() == baseline
    return ["input containers detached", "pixels()/to_values() detached", "index precedence: INVALID_INDEX before INDEX_OUT_OF_RANGE"]


def native_checks():
    base = {"first": {"width": 1, "height": 1, "pixels": [0xFF112233]},
            "second": {"width": 1, "height": 1, "pixels": [0xFFAABBCC]}, "weights": [0.5]}
    expect_code(lambda: raster_crossfade_2d(None), "INVALID_INPUT", "non-record")
    expect_code(lambda: raster_crossfade_2d({**base, "extra": 1}), "INVALID_INPUT", "extra key")
    bad_dims = {**base, "second": {"width": 2, "height": 1, "pixels": [1, 2]}}
    expect_code(lambda: raster_crossfade_2d(bad_dims), "INVALID_INPUT", "mismatched dims")
    expect_code(lambda: raster_crossfade_2d({**base, "weights": [0.5, 0.5]}), "INVALID_INPUT", "wrong weight count")
    expect_code(lambda: raster_crossfade_2d({**base, "weights": [-0.1]}), "INVALID_INPUT", "negative weight")
    expect_code(lambda: raster_crossfade_2d({**base, "weights": [1.1]}), "INVALID_INPUT", "excess weight")
    oversized = {**base, "first": {"width": 1, "height": 1, "pixels": [4294967296]}}
    expect_code(lambda: raster_crossfade_2d(oversized), "INVALID_INPUT", "oversized pixel")
    degenerate = {**base, "first": {"width": 0, "height": 1, "pixels": []}}
    expect_code(lambda: raster_crossfade_2d(degenerate), "INVALID_INPUT", "degenerate dims")
    nz = raster_crossfade_2d({**base, "weights": [-0.0]})
    assert nz.to_values()["pixels"] == [0xFF112233]
    return ["non-record/extra-key/mismatched-dims/wrong-weight-count/out-of-range-weight/oversized-pixel/degenerate-dims", "negative-zero weight equals zero"]


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
