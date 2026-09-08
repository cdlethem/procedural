#!/usr/bin/env python3
"""Focused native py5 observer for the WarpMarks starter.

Drives the actual WarpMarksSketch through setup and key_pressed callbacks (real
py5/JAVA2D Py5Graphics, offscreen source capture, and the real bilinear-raster-remap
pixel round-trip -- not a mock), following the same self._instance.key + key_pressed()
technique used by the CP2 PathMarks native observer. Scoped conformance check, not the
full CP2-milestone plan.json/evidence apparatus.

Run under the shared machine render lease:
  python3 /home/colin/dev/procedural/tools/with_native_render_lock.py --timeout 120 -- \\
    xvfb-run -a /home/colin/dev/procedural/.work/environments/py5/bin/python3 \\
    tests/native/py5_warp_marks.py
"""
from __future__ import annotations

import hashlib
import json
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "packages/python/examples/warp_marks"), str(ROOT / "packages/python")]

import py5
from jpype.types import JChar

import sketch as starter

RESULT: dict[str, object] = {"passed": False, "part": "warp-marks-native", "py5": py5.__version__}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rgba_from_canvas(sketch) -> bytes:
    sketch.load_np_pixels()
    return sketch.np_pixels[:, :, [1, 2, 3, 0]].tobytes()


class CheckWarpMarks(starter.WarpMarksSketch):
    def _key(self, value: str):
        self._instance.key = JChar(value)
        self.key_pressed()

    def setup(self):
        try:
            super().setup()
            assert self._instance.sketchPixelDensity() == 1
            assert (self.width, self.height, self.pixel_width, self.pixel_height) == (640, 640, 640, 640)
            assert self.shown_revision == 1
            assert self.strength == 32 and self.alternate_field is False and self.stripes is False

            baseline_rgba = rgba_from_canvas(self)
            baseline_pixels = self.source_pixels

            self._key("w")  # strength 32 -> 64
            assert self.shown_revision == 2 and self.strength == 64
            strength64_rgba = rgba_from_canvas(self)
            assert strength64_rgba != baseline_rgba, "W must visibly change the warp"
            assert self.source_pixels is baseline_pixels, "W must not recapture the source"

            self._key("w")  # 64 -> 0 (identity)
            assert self.shown_revision == 3 and self.strength == 0
            identity_rgba = rgba_from_canvas(self)

            self._key("w")  # 0 -> 32 (back to baseline)
            assert self.shown_revision == 4 and self.strength == 32
            replay_rgba = rgba_from_canvas(self)
            assert replay_rgba == baseline_rgba, "returning to strength 32 must reproduce identical pixels"

            self._key("f")  # gradient-noise -> paired-sine field
            assert self.shown_revision == 5 and self.alternate_field is True
            field_rgba = rgba_from_canvas(self)
            assert field_rgba != baseline_rgba, "F must visibly change the field"

            self._key("p")  # dots -> stripes source (recaptures)
            assert self.shown_revision == 6 and self.stripes is True
            assert self.source_pixels is not baseline_pixels, "P must recapture the source"
            stripes_rgba = rgba_from_canvas(self)
            assert stripes_rgba != field_rgba, "P must visibly change the source pattern"

            self._key("0")  # reset
            assert self.shown_revision == 7
            assert self.strength == 32 and self.alternate_field is False and self.stripes is False
            reset_rgba = rgba_from_canvas(self)
            assert reset_rgba == baseline_rgba, "0 must restore byte-identical baseline pixels"

            before_save_revision = self.shown_revision
            self._key("s")
            assert self.shown_revision == before_save_revision, "S must not redraw"
            saved_path = starter.OUTPUT / "warp-marks.png"
            from PIL import Image
            with Image.open(saved_path) as image:
                assert image.size == (640, 640)
                saved_rgba = image.convert("RGBA").tobytes()
            assert saved_rgba == reset_rgba, "S must save the already displayed canvas"

            RESULT.update(passed=True, native={
                "scope": "Actual py5 WarpMarks starter setup/key_pressed callback route, including the real offscreen source capture and bilinear-remap pixel round-trip; not physical keyboard or cross-host raster identity.",
                "checks": ["W changes the warp without recapturing the source", "identity strength differs from warped",
                           "returning to strength 32 replays identical pixels", "F changes the field",
                           "P recaptures the source and changes the pattern", "reset restores baseline pixels",
                           "save matches displayed without redraw"],
                "baseline_rgba_sha256": sha256(baseline_rgba),
                "identity_rgba_sha256": sha256(identity_rgba),
                "stripes_rgba_sha256": sha256(stripes_rgba),
                "save_png_sha256": sha256(saved_path.read_bytes()),
                "compositions": self.shown_revision,
            })
        except BaseException:
            RESULT["traceback"] = traceback.format_exc()
        finally:
            self.exit_sketch()


def main():
    try:
        CheckWarpMarks().run_sketch(block=True)
    except BaseException:
        RESULT["passed"] = False
        RESULT["traceback"] = traceback.format_exc()
    print("PROCEDURALS_RESULT=" + json.dumps(RESULT, sort_keys=True))
    return 0 if RESULT.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
