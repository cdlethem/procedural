#!/usr/bin/env python3
"""Focused native py5 observer for the BandMarks starter.

Drives the actual BandMarksSketch through setup and key_pressed callbacks (real
py5/JAVA2D Py5Graphics, not a mock), following the same self._instance.key + key_pressed()
technique used by the CP2 PathMarks native observer. Scoped conformance check, not the
full CP2-milestone plan.json/evidence apparatus.

Run under the shared machine render lease:
  python3 /home/colin/dev/procedural/tools/with_native_render_lock.py --timeout 120 -- \\
    xvfb-run -a /home/colin/dev/procedural/.work/environments/py5/bin/python3 \\
    tests/native/py5_band_marks.py
"""
from __future__ import annotations

import hashlib
import json
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "packages/python/examples/band_marks"), str(ROOT / "packages/python")]

import py5
from jpype.types import JChar

import sketch as starter

RESULT: dict[str, object] = {"passed": False, "part": "band-marks-native", "py5": py5.__version__}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rgba_from_canvas(sketch) -> bytes:
    sketch.load_np_pixels()
    return sketch.np_pixels[:, :, [1, 2, 3, 0]].tobytes()


class CheckBandMarks(starter.BandMarksSketch):
    def _key(self, value: str):
        self._instance.key = JChar(value)
        self.key_pressed()

    def setup(self):
        try:
            super().setup()
            assert self._instance.sketchPixelDensity() == 1
            assert (self.width, self.height, self.pixel_width, self.pixel_height) == (640, 640, 640, 640)
            assert self.shown_revision == 1
            assert len(self.model.paths) == 64

            baseline_rgba = rgba_from_canvas(self)
            baseline_model = self.model

            self._key("m")  # marks view, no rebuild
            assert self.shown_revision == 2
            marks_rgba = rgba_from_canvas(self)
            assert marks_rgba != baseline_rgba, "marks view must differ from path view"
            assert self.model is baseline_model, "M must not rebuild paths"

            self._key("m")  # back to path view
            assert self.shown_revision == 3
            replay_rgba = rgba_from_canvas(self)
            assert replay_rgba == baseline_rgba, "returning to path view must reproduce identical pixels"

            self._key("t")  # wide tolerance, rebuild
            assert self.shown_revision == 4
            wide_model = self.model
            assert wide_model is not baseline_model, "T must rebuild paths"
            wide_rgba = rgba_from_canvas(self)
            assert wide_rgba != baseline_rgba, "T must visibly change the traced paths"

            self._key("c")  # recolor, no rebuild
            assert self.shown_revision == 5
            assert self.model is wide_model, "C must not rebuild paths"
            recolour_rgba = rgba_from_canvas(self)
            assert recolour_rgba != wide_rgba, "C must visibly change colour"

            self._key("0")  # reset
            assert self.shown_revision == 6
            reset_rgba = rgba_from_canvas(self)
            assert reset_rgba == baseline_rgba, "0 must restore byte-identical baseline pixels"
            assert self.model is not baseline_model, "0 rebuilds a fresh baseline path set"

            before_save_revision = self.shown_revision
            self._key("s")
            assert self.shown_revision == before_save_revision, "S must not redraw"
            saved_path = starter.OUTPUT / "band-marks.png"
            from PIL import Image
            with Image.open(saved_path) as image:
                assert image.size == (640, 640)
                saved_rgba = image.convert("RGBA").tobytes()
            assert saved_rgba == reset_rgba, "S must save the already displayed canvas"

            RESULT.update(passed=True, native={
                "scope": "Actual py5 BandMarks starter setup/key_pressed callback route; not physical keyboard or cross-host raster identity.",
                "checks": ["marks differs from path view", "M does not rebuild", "path-view replay pixel-identical",
                           "T rebuilds and changes the traced paths", "C recolours without rebuild",
                           "reset restores baseline pixels", "reset rebuilds a fresh path set",
                           "save matches displayed without redraw"],
                "baseline_rgba_sha256": sha256(baseline_rgba),
                "marks_rgba_sha256": sha256(marks_rgba),
                "wide_rgba_sha256": sha256(wide_rgba),
                "save_png_sha256": sha256(saved_path.read_bytes()),
                "compositions": self.shown_revision,
            })
        except BaseException:
            RESULT["traceback"] = traceback.format_exc()
        finally:
            self.exit_sketch()


def main():
    try:
        CheckBandMarks().run_sketch(block=True)
    except BaseException:
        RESULT["passed"] = False
        RESULT["traceback"] = traceback.format_exc()
    print("PROCEDURALS_RESULT=" + json.dumps(RESULT, sort_keys=True))
    return 0 if RESULT.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
