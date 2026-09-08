#!/usr/bin/env python3
"""Focused native py5 observer for the LoopMarks starter.

Drives the actual LoopMarksSketch through setup and key_pressed callbacks (real
py5/JAVA2D Py5Graphics, not a mock), following the same self._instance.key + key_pressed()
technique used by the CP2 PathMarks native observer. This is a scoped conformance check
(retained identity across style edits, mode/palette/move behavior, reset-restores-baseline
pixels, save-matches-displayed), not the full CP2-milestone plan.json/evidence apparatus.

Run under the shared machine render lease:
  python3 /home/colin/dev/procedural/tools/with_native_render_lock.py --timeout 120 -- \\
    xvfb-run -a /home/colin/dev/procedural/.work/environments/py5/bin/python3 \\
    tests/native/py5_loop_marks.py
"""
from __future__ import annotations

import hashlib
import json
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "packages/python/examples/loop_marks"), str(ROOT / "packages/python")]

import py5
from jpype.types import JChar

import sketch as starter

RESULT: dict[str, object] = {"passed": False, "part": "loop-marks-native", "py5": py5.__version__}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rgba_from_canvas(sketch) -> bytes:
    sketch.load_np_pixels()
    return sketch.np_pixels[:, :, [1, 2, 3, 0]].tobytes()


class CheckLoopMarks(starter.LoopMarksSketch):
    def _key(self, value: str):
        self._instance.key = JChar(value)
        self.key_pressed()

    def setup(self):
        try:
            super().setup()
            assert self._instance.sketchPixelDensity() == 1
            assert (self.width, self.height, self.pixel_width, self.pixel_height) == (640, 640, 640, 640)
            assert self.shown_revision == 1

            baseline_rgba = rgba_from_canvas(self)
            baseline_model = self.model
            assert self.model.curves.__len__() == 4

            self._key("m")  # fans
            assert self.shown_revision == 2
            fans_rgba = rgba_from_canvas(self)
            assert fans_rgba != baseline_rgba, "fans view must differ from tiles view"
            assert self.model is baseline_model, "M must not rebuild curves"

            self._key("m")  # back to tiles
            assert self.shown_revision == 3
            replay_rgba = rgba_from_canvas(self)
            assert replay_rgba == baseline_rgba, "returning to tiles must reproduce identical pixels"

            self._key("t")  # move a control, rebuild
            assert self.shown_revision == 4
            moved_model = self.model
            assert moved_model is not baseline_model, "T must rebuild curves"
            moved_rgba = rgba_from_canvas(self)
            assert moved_rgba != baseline_rgba, "T must visibly reshape the curves"

            self._key("c")  # recolor, no rebuild
            assert self.shown_revision == 5
            assert self.model is moved_model, "C must not rebuild curves"
            recolour_rgba = rgba_from_canvas(self)
            assert recolour_rgba != moved_rgba, "C must visibly change colour"

            self._key("0")  # reset
            assert self.shown_revision == 6
            reset_rgba = rgba_from_canvas(self)
            assert reset_rgba == baseline_rgba, "0 must restore byte-identical baseline pixels"
            assert self.model is not baseline_model, "0 rebuilds a fresh baseline curve set"

            before_save_revision = self.shown_revision
            self._key("s")
            assert self.shown_revision == before_save_revision, "S must not redraw"
            saved_path = starter.OUTPUT / "loop-marks.png"
            from PIL import Image
            with Image.open(saved_path) as image:
                assert image.size == (640, 640)
                saved_rgba = image.convert("RGBA").tobytes()
            assert saved_rgba == reset_rgba, "S must save the already displayed canvas"

            RESULT.update(passed=True, native={
                "scope": "Actual py5 LoopMarks starter setup/key_pressed callback route; not physical keyboard or cross-host raster identity.",
                "checks": ["fans differs from tiles", "M does not rebuild", "tiles replay pixel-identical",
                           "T rebuilds and reshapes", "C recolours without rebuild", "reset restores baseline pixels",
                           "reset rebuilds a fresh baseline set", "save matches displayed without redraw"],
                "baseline_rgba_sha256": sha256(baseline_rgba),
                "fans_rgba_sha256": sha256(fans_rgba),
                "moved_rgba_sha256": sha256(moved_rgba),
                "save_png_sha256": sha256(saved_path.read_bytes()),
                "compositions": self.shown_revision,
            })
        except BaseException:
            RESULT["traceback"] = traceback.format_exc()
        finally:
            self.exit_sketch()


def main():
    try:
        CheckLoopMarks().run_sketch(block=True)
    except BaseException:
        RESULT["passed"] = False
        RESULT["traceback"] = traceback.format_exc()
    print("PROCEDURALS_RESULT=" + json.dumps(RESULT, sort_keys=True))
    return 0 if RESULT.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
