#!/usr/bin/env python3
"""Execute the preregistered RegionMarks callbacks through actual py5 JAVA2D."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import traceback

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
OUTPUT = args.output.resolve()
if not OUTPUT.is_relative_to(ROOT / ".work") or OUTPUT.exists():
    raise ValueError("Output must be fresh under .work")
OUTPUT.mkdir()
sys.path[:0] = [str(ROOT / "packages/python/examples/region_marks"), str(ROOT / "packages/python")]
import py5
from jpype import JChar, JClass
from PIL import Image
import sketch as starter
starter.OUTPUT = OUTPUT

FILES = (
    "packages/python/procedurals/quadrant_partition.py", "packages/python/procedurals/layout.py",
    "packages/python/examples/region_marks/region_marks.py", "packages/python/examples/region_marks/sketch.py",
    "tests/native/py5_region_marks.py", "design/capabilities/region-marks-py5-acceptance.md",
    "catalog/operations/seeded-quadrant-partition.json", "fixtures/operations/seeded-quadrant-partition.json",
)
REPORT = {"status": "failed", "scope": "Actual py5 RegionMarks callbacks; no physical-keyboard, package or source-recreation acceptance", "states": []}
sha = lambda data: hashlib.sha256(data).hexdigest()


def hashes():
    files = [ROOT / name for name in FILES]
    package = Path(py5.__file__).parent
    files += [package / name for name in ("__init__.py", "sketch.py", "base.py", "jars/core.jar", "jars/py5.jar")]
    java = Path(str(JClass("java.lang.System").getProperty("java.home")))
    files += [java / "release", java / "lib/modules"]
    return {str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p): sha(p.read_bytes()) for p in files}


def geometry(composition):
    bounds = [0.0] * 4
    result = []
    for i in range(composition.size):
        composition.bounds_into(i, bounds)
        result.append((composition.id_at(i), *bounds))
    return result


class CheckRegionMarks(starter.RegionMarksSketch):
    def paint_shown_composition(self):
        self.paint_calls += 1
        self.ellipse_calls = 0
        super().paint_shown_composition()

    def ellipse(self, *args):
        self.ellipse_calls += 1
        return super().ellipse(*args)

    def setup(self):
        try:
            self.paint_calls = 0
            super().setup()
            previous = None
            def capture(name, cells, marks, retained, image=False):
                nonlocal previous
                current = self.composition
                values = geometry(current)
                if current.size != cells or self.ellipse_calls != marks:
                    raise AssertionError("cell/ellipse count: " + name)
                if self.shown_revision != self.paint_calls:
                    raise AssertionError("paint/revision mismatch")
                if previous:
                    if (current is previous[0]) != retained:
                        raise AssertionError("composition identity: " + name)
                    if (values == previous[1]) != retained:
                        raise AssertionError("geometry retention/change: " + name)
                self.load_np_pixels()
                pixels = self.np_pixels[:, :, [1, 2, 3, 0]].tobytes()
                if self.np_pixels.shape != (640, 640, 4):
                    raise AssertionError("canvas dimensions")
                state = {"id": name, "cells": cells, "marks": marks, "revision": self.shown_revision,
                         "retained": retained, "rgba_sha256": sha(pixels),
                         "settings": {k: getattr(self, k) for k in
                                      ("seed", "replacements", "fraction", "grid_marks", "alternate", "authored")}}
                if image:
                    destination = OUTPUT / (name + ".png")
                    self.save(str(destination), drop_alpha=False, use_thread=False)
                    with Image.open(destination) as saved:
                        if saved.size != (640, 640) or saved.convert("RGBA").tobytes() != pixels:
                            raise AssertionError("saved observation differs from canvas")
                    state.update(image=destination.name, png_sha256=sha(destination.read_bytes()))
                REPORT["states"].append(state)
                previous = (current, values)
                return pixels
            def key(value):
                self._instance.key = JChar(value)
                self.key_pressed()
            capture("baseline", 301, 301, None, True)
            key("m"); capture("grid", 301, 2709, True, True)
            key("c"); capture("colour", 301, 2709, True, True)
            key("g"); capture("layout", 301, 2709, False, True)
            key("n"); capture("count", 601, 5409, False)
            key("r"); capture("seed", 601, 5409, False)
            key("x"); displayed = capture("authored", 11, 99, False, True)
            for value in ("r", "n", "g"):
                key(value)
                if capture("ignored-" + value, 11, 99, True) != displayed:
                    raise AssertionError("ignored control changed pixels")
            key("s")
            if capture("save", 11, 99, True) != displayed:
                raise AssertionError("save changed pixels")
            destination = OUTPUT / "region-marks.png"
            with Image.open(destination) as saved:
                if saved.convert("RGBA").tobytes() != displayed:
                    raise AssertionError("cached save differs")
            if self.paint_calls != 7:
                raise AssertionError("unexpected additional paint")
            states = REPORT["states"]
            if states[0]["rgba_sha256"] == states[1]["rgba_sha256"] or states[1]["rgba_sha256"] == states[2]["rgba_sha256"]:
                raise AssertionError("style edit did not change pixels")
            REPORT.update(status="passed", paint_calls=self.paint_calls, saved_png_sha256=sha(destination.read_bytes()))
        except BaseException:
            REPORT.update(status="failed", failure=traceback.format_exc())
        finally:
            self.exit_sketch()


REPORT.update(py5=py5.__version__, python=sys.version, java=str(JClass("java.lang.System").getProperty("java.version")))
REPORT["input_sha256_before"] = hashes()
(OUTPUT / "attempt.json").write_text(json.dumps(REPORT, indent=2))
try:
    CheckRegionMarks().run_sketch(block=True)
except BaseException:
    REPORT.update(status="failed", failure=traceback.format_exc())
REPORT["input_sha256_after"] = hashes()
if REPORT["input_sha256_before"] != REPORT["input_sha256_after"]:
    REPORT.update(status="failed", failure="source/runtime changed during attempt")
(OUTPUT / "result.json").write_text(json.dumps(REPORT, indent=2) + "\n")
print(json.dumps({"status": REPORT["status"], "output": str(OUTPUT), "failure": REPORT.get("failure")}))
raise SystemExit(0 if REPORT["status"] == "passed" else 1)
