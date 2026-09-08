#!/usr/bin/env python3
"""Execute the preregistered GrainMarks callbacks through actual py5 JAVA2D."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import traceback
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
OUTPUT = args.output.resolve()
if not OUTPUT.is_relative_to(ROOT / ".work") or OUTPUT.exists():
    raise ValueError("Output must be fresh under .work")
OUTPUT.mkdir()
sys.path[:0] = [str(ROOT / "packages/python/examples/grain_marks"), str(ROOT / "packages/python")]
import py5
from jpype import JChar, JClass
from PIL import Image
import sketch as starter
starter.OUTPUT = OUTPUT

FILES = (
    "packages/python/procedurals/quadrant_partition.py", "packages/python/procedurals/triangle_points.py",
    "packages/python/examples/grain_marks/grain_marks.py", "packages/python/examples/grain_marks/sketch.py",
    "tests/native/py5_grain_marks.py", "design/capabilities/grain-marks-py5-acceptance.md",
    "catalog/operations/seeded-quadrant-partition.json", "fixtures/operations/seeded-quadrant-partition.json",
    "catalog/operations/seeded-triangle-points.json", "catalog/operations/triangle-coordinate-map.json",
    "fixtures/operations/seeded-triangle-points.json", "fixtures/operations/triangle-coordinate-map.json",
)
REPORT = {"status": "failed", "scope": "Actual py5 GrainMarks callbacks; no physical-keyboard, package or source-recreation acceptance", "states": []}
sha = lambda data: hashlib.sha256(data).hexdigest()


def hashes():
    files = [ROOT / name for name in FILES]
    package = Path(py5.__file__).parent
    files += [package / name for name in ("__init__.py", "sketch.py", "base.py", "jars/core.jar", "jars/py5.jar")]
    java = Path(str(JClass("java.lang.System").getProperty("java.home")))
    files += [java / "release", java / "lib/modules"]
    return {str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p): sha(p.read_bytes()) for p in files}


def geometry(composition):
    import struct
    digest = hashlib.sha256()
    point = [0.0, 0.0]
    for region in range(composition.size):
        points = composition.region_at(region)
        digest.update(struct.pack(">q", points.size))
        for index in range(points.size):
            points.point_into(index, point)
            digest.update(struct.pack(">dd", *point))
    return digest.hexdigest()


class CheckGrainMarks(starter.GrainMarksSketch):
    def paint_shown_composition(self):
        self.paint_calls += 1
        self.point_calls = self.line_calls = 0
        super().paint_shown_composition()

    def point(self, *args):
        self.point_calls += 1
        return super().point(*args)

    def line(self, *args):
        self.line_calls += 1
        return super().line(*args)

    def setup(self):
        try:
            self.paint_calls = 0
            super().setup()
            previous = None
            def capture(name, regions, marks, retained, expected, image=False):
                nonlocal previous
                current = self.composition
                values = geometry(current)
                if current.size != regions or current.total_points != marks or self.point_calls + self.line_calls != marks:
                    raise AssertionError("region/mark count: " + name)
                for field, value in expected.items():
                    if getattr(self, field) != value:
                        raise AssertionError("setting differs: " + field)
                if (self.line_calls if self.strokes else self.point_calls) != marks:
                    raise AssertionError("wrong mark primitive")
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
                state = {"id": name, "regions": regions, "marks": marks, "revision": self.shown_revision,
                         "retained": retained, "rgba_sha256": sha(pixels),
                         "settings": {k: getattr(self, k) for k in
                                      ("seed", "density", "distribution", "strokes", "alternate", "cells")}}
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
            defaults = dict(seed=42, density=.1, distribution=0, strokes=False, alternate=False, cells=False)
            baseline = capture("baseline", 1, 15680, None, defaults, True)
            expected_bounds = [float("inf"), float("inf"), -float("inf"), -float("inf")]
            point = [0.0, 0.0]
            for region in range(self.composition.size):
                points = self.composition.region_at(region)
                for index in range(points.size):
                    points.point_into(index, point)
                    expected_bounds[0] = min(expected_bounds[0], point[0])
                    expected_bounds[1] = min(expected_bounds[1], point[1])
                    expected_bounds[2] = max(expected_bounds[2], point[0])
                    expected_bounds[3] = max(expected_bounds[3], point[1])
            mask = np.any(self.np_pixels[:, :, 1:4] != [243, 240, 232], axis=2)
            ys, xs = np.nonzero(mask)
            if len(xs) == 0:
                raise AssertionError("empty dot raster")
            actual_bounds = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
            if any(abs(a-b)>2 for a,b in zip(actual_bounds,expected_bounds)):
                raise AssertionError("dot raster extent differs from retained geometry")
            REPORT["baseline_envelope"] = dict(actual=actual_bounds, expected=expected_bounds, tolerance_pixels=2)
            key("m"); capture("strokes", 1, 15680, True, {**defaults,"strokes":True}, True)
            style = {**defaults,"strokes":True,"alternate":True}
            key("c"); capture("colour", 1, 15680, True, style, True)
            key("b"); capture("bias1", 1, 15680, False, {**style,"distribution":1}, True)
            key("b"); capture("bias2", 1, 15680, False, {**style,"distribution":2}, True)
            dense = {**style,"distribution":2,"density":.2}
            key("n"); capture("density", 1, 31360, False, dense)
            key("r"); capture("seed", 1, 31360, False, {**dense,"seed":43})
            key("x"); capture("cells", 26, 81920, False, {**dense,"seed":43,"cells":True}, True)
            key("0"); displayed = capture("reset", 1, 15680, False, defaults, True)
            if displayed != baseline:
                raise AssertionError("reset differs from baseline")
            key("q")
            if capture("ignored-q", 1, 15680, True, defaults) != displayed:
                raise AssertionError("ignored key changed pixels")
            key("s")
            if capture("save", 1, 15680, True, defaults) != displayed:
                raise AssertionError("save changed pixels")
            destination = OUTPUT / "grain-marks.png"
            with Image.open(destination) as saved:
                if saved.convert("RGBA").tobytes() != displayed:
                    raise AssertionError("cached save differs")
            if self.paint_calls != 9:
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
    CheckGrainMarks().run_sketch(block=True)
except BaseException:
    REPORT.update(status="failed", failure=traceback.format_exc())
REPORT["input_sha256_after"] = hashes()
if REPORT["input_sha256_before"] != REPORT["input_sha256_after"]:
    REPORT.update(status="failed", failure="source/runtime changed during attempt")
(OUTPUT / "result.json").write_text(json.dumps(REPORT, indent=2) + "\n")
print(json.dumps({"status": REPORT["status"], "output": str(OUTPUT), "failure": REPORT.get("failure")}))
raise SystemExit(0 if REPORT["status"] == "passed" else 1)
