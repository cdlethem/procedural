#!/usr/bin/env python3
"""Native py5 observer for the frozen PlacementMarks starter acceptance sequence.

The subclass calls the actual starter setup/key_pressed callbacks. It records
canvas state after every registered composition, verifies retained placement
identity on style edits and replacement on rebuilds, the extended accepted
prefix, the authored radial transfer count (recorded, not asserted: radial
host trigonometry is outside exact core semantics), ignored edits while
radial, and the cached save route.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import struct
import sys
import threading
import time
import traceback
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "packages/python/examples/placement_marks"), str(ROOT / "packages/python")]

import py5
from jpype import JChar
from PIL import Image

import sketch as starter

OUTPUT = ROOT / ".work/reproductions/py5-placement-marks"
REPORT = ROOT / "evidence/conformance/py5-placement-marks.json"
JAVA_RADIAL_ACCEPTED = 111  # accepted CP3 Java evidence; recorded, not asserted

BASE = {"seed": 42, "attempts": 5000, "minimum": 4.0, "maximum": 64.0,
        "separation": 1.0, "radial": False, "diamonds": False, "alternate": False}

# (identifier, trigger, settings, expected_accepted, retained_identity, visual_id, pixels_equal_to)
STEPS = (
    ("baseline", None, BASE, 424, None, "baseline", None),
    ("diamond", "m", {**BASE, "diamonds": True}, 424, True, "diamond", None),
    ("rings-restored", "m", BASE, 424, True, None, "baseline"),
    ("palette", "c", {**BASE, "alternate": True}, 424, True, "palette", None),
    ("palette-restored", "c", BASE, 424, True, None, "baseline"),
    ("spacing", "g", {**BASE, "separation": 1.2}, 353, False, "spacing", None),
    ("spacing-restored", "g", BASE, 424, False, None, "baseline"),
    ("size-min", "i", {**BASE, "minimum": 8.0}, 239, False, "size-min", None),
    ("size-min-restored", "i", BASE, 424, False, None, "baseline"),
    ("size-max", "o", {**BASE, "maximum": 32.0}, 613, False, "size-max", None),
    ("size-max-restored", "o", BASE, 424, False, None, "baseline"),
    ("count-extended", "n", {**BASE, "attempts": 10000}, 517, False, "count-extended", None),
    ("count-restored", "n", BASE, 424, False, None, "baseline"),
    ("seed", "r", {**BASE, "seed": 43}, 432, False, "seed", None),
    ("radial", "x", {**BASE, "seed": 43, "radial": True}, None, False, "radial", None),
    ("radial-spacing", "g", {**BASE, "seed": 43, "radial": True, "separation": 1.2},
     None, False, "radial-spacing", None),
    ("radial-spacing-restored", "g", {**BASE, "seed": 43, "radial": True}, None, False, None, "radial"),
)

SOURCE_FILES = (
    "packages/python/procedurals/placements.py",
    "packages/python/procedurals/__init__.py",
    "packages/python/examples/placement_marks/placement_marks.py",
    "packages/python/examples/placement_marks/sketch.py",
    "tests/native/py5_placement_marks.py",
    "catalog/operations/ordered-circle-filter.json",
    "catalog/operations/seeded-circle-placement.json",
    "fixtures/operations/ordered-circle-filter.json",
    "fixtures/operations/seeded-circle-placement.json",
)

RESULT: dict[str, object] = {
    "passed": False,
    "part": "cp3-placement-marks",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def bits(value: float) -> bytes:
    return struct.pack(">d", value)


def rgba_from_canvas(sketch) -> bytes:
    sketch.load_np_pixels()
    # py5 supplies ARGB bytes; use portable RGBA in evidence.
    return sketch.np_pixels[:, :, [1, 2, 3, 0]].tobytes()


def opaque_nonbackground(rgba: bytes, name: str) -> int:
    if len(rgba) != 640 * 640 * 4:
        raise AssertionError(f"{name}: canvas is not 640x640 RGBA")
    covered = 0
    for index in range(0, len(rgba), 4):
        r, g, b, a = rgba[index:index + 4]
        if a > 0 and (r, g, b) != (236, 231, 218):
            covered += 1
    if covered == 0:
        raise AssertionError(f"{name}: canvas is entirely background")
    return covered


def settings_of(sketch) -> dict[str, Any]:
    return {"seed": sketch.seed, "attempts": sketch.attempts, "minimum": sketch.minimum,
            "maximum": sketch.maximum, "separation": sketch.separation, "radial": sketch.radial,
            "diamonds": sketch.diamonds, "alternate": sketch.alternate}


def placements_values(placements) -> dict[str, Any]:
    return placements.to_values()


class CheckPlacementMarks(starter.PlacementMarksSketch):
    """Drive the actual starter callbacks through the registered sequence."""

    def setup(self):
        self.paint_calls = 0
        try:
            super().setup()
            OUTPUT.mkdir(parents=True, exist_ok=True)
            records: list[dict[str, Any]] = []
            canvases: dict[str, bytes] = {}
            compositions: dict[str, Any] = {}
            images: dict[str, dict[str, Any]] = {}

            def key(value: str) -> None:
                self._instance.key = JChar(value)
                self.key_pressed()

            def visual(identifier: str) -> None:
                destination = OUTPUT / f"{identifier}.png"
                self.save(str(destination), drop_alpha=False, use_thread=False)
                with Image.open(destination) as image:
                    assert image.size == (640, 640)
                    saved = image.convert("RGBA").tobytes()
                assert saved == canvases[identifier], f"{identifier}: saved visual differs from displayed canvas"
                images[f"{identifier}.png"] = {"png_sha256": sha256(destination.read_bytes()),
                                               "rgba_sha256": sha256(saved),
                                               "nonbackground_pixels": opaque_nonbackground(saved, identifier)}

            prior_composition = None
            radial_record: dict[str, Any] | None = None
            for position, (identifier, trigger, expected, accepted, retained,
                           visual_id, pixels_equal_to) in enumerate(STEPS, start=1):
                if trigger is not None:
                    key(trigger)
                assert (self.width, self.height, self.pixel_width, self.pixel_height) == (640, 640, 640, 640)
                assert self._instance.sketchPixelDensity() == 1
                assert self.shown_revision == position, f"{identifier}: revision"
                assert self.paint_calls == position, f"{identifier}: paint count"
                assert settings_of(self) == expected, f"{identifier}: settings"
                placements = self.composition
                assert placements.size > 0, f"{identifier}: empty composition"
                assert placements.attempts == (160 if expected["radial"] else expected["attempts"]), \
                    f"{identifier}: attempts"
                if retained is not None:
                    assert (placements is prior_composition) == retained, f"{identifier}: retained identity"
                rgba = rgba_from_canvas(self)
                coverage = opaque_nonbackground(rgba, identifier)
                if pixels_equal_to is not None:
                    assert rgba == canvases[pixels_equal_to], f"{identifier}: pixels differ from {pixels_equal_to}"
                elif position > 1:
                    previous = STEPS[position - 2][0]
                    assert rgba != canvases[previous], f"{identifier}: edit did not change pixels"
                records.append({
                    "id": identifier, "revision": position,
                    "accepted": placements.size, "attempts": placements.attempts,
                    "source": "radial" if expected["radial"] else "seeded",
                    "retained_identity": None if retained is None else retained,
                    "drawn_circles": placements.size,
                    "drawn_vertices": placements.size * (4 if expected["diamonds"] else 64),
                    "rgba_sha256": sha256(rgba), "nonbackground_pixels": coverage,
                })
                canvases[identifier] = rgba
                compositions[identifier] = placements
                if accepted is not None:
                    assert placements.size == accepted, f"{identifier}: accepted count"
                if visual_id is not None:
                    visual(visual_id)
                if identifier == "radial":
                    assert placements.attempts == 160, "radial proposal count"
                    radial_record = records[-1]
                    # Ignored edits while radial: no rebuild, no repaint, same pixels.
                    radial_composition = placements
                    for ignored_id, ignored in (("radial-ignored-r", "r"), ("radial-ignored-n", "n"),
                                                ("radial-ignored-i", "i"), ("radial-ignored-o", "o")):
                        before_paints, before_revision = self.paint_calls, self.shown_revision
                        key(ignored)
                        assert self.paint_calls == before_paints, f"{ignored_id}: ignored edit painted"
                        assert self.shown_revision == before_revision, f"{ignored_id}: revision changed"
                        assert self.shown_revision == 15, f"{ignored_id}: unexpected revision"
                        assert self.composition is radial_composition, f"{ignored_id}: result replaced"
                        assert settings_of(self) == {**BASE, "seed": 43, "radial": True}, \
                            f"{ignored_id}: settings changed"
                        assert rgba_from_canvas(self) == canvases["radial"], f"{ignored_id}: pixels changed"
                if identifier == "count-extended":
                    prefix = placements_values(compositions["baseline"])
                    extended = placements_values(placements)
                    for index in range(len(prefix["centres"])):
                        assert bits(extended["centres"][index][0]) == bits(prefix["centres"][index][0]), \
                            "prefix centre x"
                        assert bits(extended["centres"][index][1]) == bits(prefix["centres"][index][1]), \
                            "prefix centre y"
                        assert bits(extended["radii"][index]) == bits(prefix["radii"][index]), "prefix radius"
                        assert extended["sourceIndices"][index] == prefix["sourceIndices"][index], \
                            "prefix source index"
                prior_composition = placements

            assert radial_record is not None, "radial composition missing"


            # Cached save with quiet observation.
            before_save_paints, before_save_revision = self.paint_calls, self.shown_revision
            key("s")
            saved_path = OUTPUT / "placement-marks.png"
            assert self.shown_revision == before_save_revision == 17, "S caused a paint"
            assert self.paint_calls == before_save_paints, "S caused a composition"
            assert saved_path.is_file(), "S did not save"
            with Image.open(saved_path) as image:
                assert image.size == (640, 640)
                saved_rgba = image.convert("RGBA").tobytes()
            assert saved_rgba == canvases["radial-spacing-restored"], "S did not save the shown composition"
            quiet_started = time.monotonic()

            native = {
                "passed": True,
                "scope": "Actual py5 PlacementMarks starter setup/key_pressed callback route; not physical keyboard or cross-host raster identity.",
                "render_states": records,
                "images": images,
                "radial_transfer": {
                    "attempts": 160, "accepted": radial_record["accepted"],
                    "java_accepted": JAVA_RADIAL_ACCEPTED,
                    "matches_java_count": radial_record["accepted"] == JAVA_RADIAL_ACCEPTED,
                    "note": "Radial proposal trigonometry is host composition, outside exact core semantics; the count is recorded, not asserted.",
                },
                "keyboard_edit": {"key": "c", "composition": "palette", "revision": 4,
                                  "note": "Palette edit triggered through the key_pressed callback route."},
                "save_png": {"path": "placement-marks.png", "bytes": len(saved_path.read_bytes()),
                             "png_sha256": sha256(saved_path.read_bytes()),
                             "decoded_rgba_sha256": sha256(saved_rgba), "matches_current_canvas": True},
                "retained_style_edits": True,
                "rebuild_replaced": True,
                "extended_accepted_prefix": True,
                "ignored_while_radial": True,
                "compositions": 17,
            }

            def finish_after_quiet():
                try:
                    quiet_ms = (time.monotonic() - quiet_started) * 1000
                    assert quiet_ms >= 300
                    assert self.shown_revision == 17 and self.paint_calls == 17, "S caused a quiet composition"
                    native["save_png"]["quiet_ms"] = quiet_ms
                    RESULT.update(passed=True, native=native)
                except BaseException:
                    RESULT["passed"] = False
                    RESULT["traceback"] = traceback.format_exc()
                finally:
                    self.exit_sketch()

            threading.Timer(0.3, finish_after_quiet).start()
            self._quiet_pending = True
        except BaseException:
            RESULT["passed"] = False
            RESULT["traceback"] = traceback.format_exc()
        finally:
            if not getattr(self, "_quiet_pending", False):
                self.exit_sketch()

    def paint_shown_composition(self):
        self.paint_calls += 1
        super().paint_shown_composition()

    def save_shown_composition(self):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        destination = OUTPUT / "placement-marks.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        return destination

def snapshot_sources() -> dict[str, str]:
    values = {name: sha256((ROOT / name).read_bytes()) for name in SOURCE_FILES}
    environment = Path(os.environ.get("PROCEDURALS_PY5_ENV") or ROOT / ".work/environments/py5")
    if not environment.is_dir():
        environment = Path("/home/colin/dev/procedural/.work/environments/py5")
    RESULT["environment"] = str(environment)
    site = next((environment / "lib").glob("python*/site-packages"), None)
    if site is not None:
        for name in ("py5/__init__.py", "py5/base.py", "py5/sketch.py", "py5/graphics.py",
                     "py5/mixins/pixels.py", "py5/jars/core.jar", "py5/jars/py5.jar"):
            path = site / name
            if path.is_file():
                values[f"env:{name}"] = sha256(path.read_bytes())
    return values


def main() -> int:
    RESULT["py5"] = py5.__version__
    try:
        from jpype import JClass
        RESULT["java"] = str(JClass("java.lang.System").getProperty("java.version"))
    except Exception:  # noqa: BLE001 - the py5 import already proved the JVM
        RESULT["java"] = "unavailable"
    sources_before = snapshot_sources()
    try:
        CheckPlacementMarks().run_sketch(block=True)
    except BaseException:
        RESULT["passed"] = False
        RESULT["traceback"] = traceback.format_exc()
    RESULT["input_sha256"] = sources_before
    RESULT["status"] = "passed" if RESULT.get("passed") is True else "failed"
    sources_after = snapshot_sources()
    assert sources_after == sources_before, "sources changed during the native attempt"
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    temporary = REPORT.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(RESULT, indent=2, sort_keys=True) + "\n")
    temporary.replace(REPORT)
    print("PROCEDURALS_RESULT=" + json.dumps(RESULT, sort_keys=True))
    return 0 if RESULT.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
