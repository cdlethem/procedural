#!/usr/bin/env python3
"""Focused native py5 observer for the CutBranchMarks starter.

Drives the actual CutBranchMarksSketch through setup and key_pressed callbacks (real
py5/JAVA2D Py5Graphics, not a mock), following the same self._instance.key + key_pressed()
technique used by the CP2 PathMarks native observer. Scoped conformance check, not the
full CP2-milestone plan.json/evidence apparatus.

Run under the shared machine render lease:
  python3 /home/colin/dev/procedural/tools/with_native_render_lock.py --timeout 120 -- \\
    xvfb-run -a /home/colin/dev/procedural/.work/environments/py5/bin/python3 \\
    tests/native/py5_cut_branch_marks.py
"""
from __future__ import annotations

import hashlib
import json
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "packages/python/examples/cut_branch_marks"), str(ROOT / "packages/python")]

import py5
from jpype.types import JChar

import sketch as starter

RESULT: dict[str, object] = {"passed": False, "part": "cut-branch-marks-native", "py5": py5.__version__}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rgba_from_canvas(sketch) -> bytes:
    sketch.load_np_pixels()
    return sketch.np_pixels[:, :, [1, 2, 3, 0]].tobytes()


class CheckCutBranchMarks(starter.CutBranchMarksSketch):
    def _key(self, value: str):
        self._instance.key = JChar(value)
        self.key_pressed()

    def setup(self):
        try:
            super().setup()
            assert self._instance.sketchPixelDensity() == 1
            assert (self.width, self.height, self.pixel_width, self.pixel_height) == (960, 960, 960, 960)
            assert self.shown_revision == 1
            assert self.model.pool.size == 12616

            baseline_rgba = rgba_from_canvas(self)
            baseline_model = self.model

            self._key("c")  # next colour, no rebuild
            assert self.shown_revision == 2
            colour_rgba = rgba_from_canvas(self)
            assert colour_rgba != baseline_rgba, "C must visibly change colour"
            assert self.model is baseline_model, "C must not rebuild the pool"

            self._key("w")  # sparse work, rebuild
            assert self.shown_revision == 3
            sparse_model = self.model
            assert sparse_model is not baseline_model, "W must rebuild the pool"
            assert sparse_model.pool.size < baseline_model.pool.size, "sparse work must retain fewer cuts"
            sparse_rgba = rgba_from_canvas(self)
            assert sparse_rgba != colour_rgba, "W must visibly change the drawn pool"

            self._key("r")  # next seed, rebuild
            assert self.shown_revision == 4
            reseeded_model = self.model
            assert reseeded_model is not sparse_model, "R must rebuild the pool"
            assert self.seed == 43

            self._key("0")  # reset
            assert self.shown_revision == 5
            assert self.seed == 42 and self.color_index == 0
            reset_rgba = rgba_from_canvas(self)
            assert reset_rgba == baseline_rgba, "0 must restore byte-identical baseline pixels"
            assert self.model is not baseline_model, "0 rebuilds a fresh baseline pool"

            before_save_revision = self.shown_revision
            self._key("s")
            assert self.shown_revision == before_save_revision, "S must not redraw"
            saved_path = starter.OUTPUT / "cut-branch-marks.png"
            from PIL import Image
            with Image.open(saved_path) as image:
                assert image.size == (960, 960)
                saved_rgba = image.convert("RGBA").tobytes()
            assert saved_rgba == reset_rgba, "S must save the already displayed canvas"

            RESULT.update(passed=True, native={
                "scope": "Actual py5 CutBranchMarks starter setup/key_pressed callback route; not physical keyboard or cross-host raster identity.",
                "checks": ["C changes colour without rebuild", "W rebuilds with fewer sparse cuts",
                           "R rebuilds with a new seed", "reset restores baseline pixels",
                           "reset rebuilds a fresh pool", "save matches displayed without redraw"],
                "baseline_rgba_sha256": sha256(baseline_rgba),
                "sparse_rgba_sha256": sha256(sparse_rgba),
                "save_png_sha256": sha256(saved_path.read_bytes()),
                "compositions": self.shown_revision,
            })
        except BaseException:
            RESULT["traceback"] = traceback.format_exc()
        finally:
            self.exit_sketch()


def main():
    try:
        CheckCutBranchMarks().run_sketch(block=True)
    except BaseException:
        RESULT["passed"] = False
        RESULT["traceback"] = traceback.format_exc()
    print("PROCEDURALS_RESULT=" + json.dumps(RESULT, sort_keys=True))
    return 0 if RESULT.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
