#!/usr/bin/env python3
"""Run the frozen bilinear-raster-remap fixtures against the Python native port."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "catalog/operations/bilinear-raster-remap.json"
FIXTURE = ROOT / "fixtures/operations/bilinear-raster-remap.json"
SOURCE = ROOT / "packages/python/procedurals/raster_remap.py"
SELF = Path(__file__).resolve()
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.raster_remap import RasterRemapError, bilinear_raster_remap_2d


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
            bilinear_raster_remap_2d(case["input"])
        except RasterRemapError as error:
            if error.code != case["error"]:
                raise AssertionError(f"{case['id']}: {error.code}")
            return None
        else:
            raise AssertionError(f"{case['id']}: expected {case['error']}")
    raster = bilinear_raster_remap_2d(case["input"])
    equal(raster.to_values(), case["output"], case["id"])
    return raster


def ownership_checks() -> list[str]:
    config = {"source": {"width": 2, "height": 2, "pixels": [0, 0xFF000000, 0x00FF0000, 0x0000FF00]},
              "outputWidth": 2, "outputHeight": 2, "sourceCoordinates": [[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [1.0, 1.0]]}
    raster = bilinear_raster_remap_2d(config)
    baseline = copy.deepcopy(raster.to_values())
    config["source"]["pixels"][0] = 99
    config["source"]["width"] = 99
    config["sourceCoordinates"][0][0] = 99.0
    equal(raster.to_values(), baseline, "input detachment")
    exported_pixels = raster.pixels()
    exported_pixels[0] = 77
    equal(raster.to_values(), baseline, "pixels() export detachment")
    exported = raster.to_values()
    exported["pixels"][0] = 77
    exported["width"] = 77
    equal(raster.to_values(), baseline, "to_values() export detachment")
    if raster.width != 2 or raster.height != 2:
        raise AssertionError("dimensions")
    if raster.pixel_at(0) != baseline["pixels"][0]:
        raise AssertionError("pixel_at")

    def rejected(action, code):
        try:
            action()
        except RasterRemapError as error:
            if error.code != code:
                raise AssertionError((code, error.code))
        else:
            raise AssertionError("accepted invalid native value")
    for index in (-1, True, 0.5, float("nan"), float("inf"), 10**1000, "0"):
        rejected(lambda: raster.pixel_at(index), "INVALID_INDEX")
    rejected(lambda: raster.pixel_at(4), "INDEX_OUT_OF_RANGE")
    return ["input containers detached", "pixels/to_values export detached", "pixel_at index/range precedence"]


def native_access_checks() -> list[str]:
    base = {"source": {"width": 1, "height": 1, "pixels": [0]}, "outputWidth": 1, "outputHeight": 1, "sourceCoordinates": [[0.0, 0.0]]}
    def rejected(action, code):
        try:
            action()
        except RasterRemapError as error:
            if error.code != code:
                raise AssertionError((code, error.code))
        else:
            raise AssertionError("accepted invalid native value")
    for value in (float("nan"), float("inf"), -float("inf"), 10**1000, True):
        rejected(lambda: bilinear_raster_remap_2d({**base, "sourceCoordinates": [[value, 0.0]]}), "INVALID_INPUT")
    class Mapping(dict): pass
    for bad in (Mapping(base), {**base, "source": Mapping(base["source"])}):
        rejected(lambda: bilinear_raster_remap_2d(bad), "INVALID_INPUT")
    return ["nonfinite/huge-integer/bool input domains", "custom mappings rejected"]


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
