#!/usr/bin/env python3
"""Native py5 observer for the seven registered PathMarks starter compositions.

The subclass calls the actual starter callbacks.  Its Py5Frame subclass only records
successful batch counts while forwarding all allocation and drawing to the adapter.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct
import sys
import time
import threading
import traceback

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "packages/python/examples/path_marks"), str(ROOT / "packages/python")]

import py5
from jpype import JChar, JClass
from PIL import Image

import sketch as starter
from procedurals._py5_frame import Py5Frame as _Py5Frame

PLAN = json.loads((ROOT / "evidence/reproductions/cp2-py5/plan.json").read_text())
OUTPUT = ROOT / PLAN["output"]
RESULT: dict[str, object] = {
    "passed": False,
    "part": "cp2-path-marks",
    "py5": py5.__version__,
    "java": str(JClass("java.lang.System").getProperty("java.version")),
}
FRAME_OBSERVATIONS: list[dict[str, object]] = []


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rgba_from_canvas(sketch) -> bytes:
    sketch.load_np_pixels()
    # py5 supplies ARGB bytes; use portable RGBA in evidence.
    return sketch.np_pixels[:, :, [1, 2, 3, 0]].tobytes()


def opaque_nonbackground(rgba: bytes, name: str) -> int:
    if len(rgba) != 640 * 640 * 4:
        raise AssertionError(f"{name}: unexpected pixel payload")
    if any(alpha != 255 for alpha in rgba[3::4]):
        raise AssertionError(f"{name}: non-opaque pixels")
    background = bytes((0xEC, 0xE7, 0xDA))
    covered = sum(rgba[index:index + 3] != background for index in range(0, len(rgba), 4))
    if covered == 0:
        raise AssertionError(f"{name}: blank canvas")
    return covered


class ObservedFrame(_Py5Frame):
    """Forward real frame work while recording completed batches only."""

    def __init__(self, sketch):
        super().__init__(sketch)
        self._observed_commands = 0

    def batch(self, commands):
        size = len(commands)
        result = super().batch(commands)
        self._observed_commands += size
        return result

    def end(self):
        completed = super().end()
        FRAME_OBSERVATIONS.append({"commands": self._observed_commands, "state": self.state})
        return completed


# The starter resolves Py5Frame from its own module global.  This observer preserves that
# class's begin/batch/end behavior and only records after successful forwarding.
starter.Py5Frame = ObservedFrame
starter.OUTPUT = OUTPUT


class CheckPathMarks(starter.PathMarksSketch):
    def _state_record(self, expected: dict[str, object], prior_model=None):
        ordinal = int(expected["ordinal"])
        assert self._instance.sketchPixelDensity() == 1
        assert (self.width, self.height, self.pixel_width, self.pixel_height) == (640, 640, 640, 640)
        assert self.shown_revision == ordinal
        assert len(FRAME_OBSERVATIONS) == ordinal
        raw_commands = sum(path.steps if self.trace else (path.steps + 3) // 4 for path in self.model.paths)
        assert raw_commands == expected["raw_commands"]
        assert FRAME_OBSERVATIONS[-1] == {"commands": expected["submitted_commands"], "state": "completed"}
        assert self.trace is expected["trace"]
        assert self.mark_length == expected["length"]
        assert self.palette_index == (1 if expected["alternate"] else 0)
        assert self.steps == expected["steps"]
        assert self.distance == expected["distance"]
        assert self.model.path_count == 24
        path_ids = tuple(id(self.model.path_at(index)) for index in range(self.model.path_count))
        rgba = rgba_from_canvas(self)
        coverage = opaque_nonbackground(rgba, str(expected["id"]))
        record = {
            "ordinal": ordinal,
            "id": expected["id"],
            "raw_commands": raw_commands,
            "submitted_commands": expected["submitted_commands"],
            "omitted_commands": raw_commands - expected["submitted_commands"],
            "rgba_sha256": sha256(rgba),
            "nonbackground_pixels": coverage,
        }
        if prior_model is not None:
            record["same_model_as_previous"] = self.model is prior_model
            record["same_paths_as_previous"] = path_ids == tuple(
                id(prior_model.path_at(index)) for index in range(prior_model.path_count)
            )
        return record, rgba

    def _key(self, value: str):
        self._instance.key = JChar(value)
        self.key_pressed()

    def _write_visual(self, identifier: str, displayed: bytes) -> dict[str, object]:
        """Capture this actual displayed canvas without composing another frame."""
        before_revision, before_frames = self.shown_revision, len(FRAME_OBSERVATIONS)
        destination = OUTPUT / f"{identifier}.png"
        self.save(str(destination), drop_alpha=False, use_thread=False)
        assert self.shown_revision == before_revision and len(FRAME_OBSERVATIONS) == before_frames
        with Image.open(destination) as image:
            assert image.size == (640, 640)
            saved = image.convert("RGBA").tobytes()
        assert saved == displayed, f"{identifier}: saved visual differs from displayed canvas"
        return {"png_sha256": sha256(destination.read_bytes()), "rgba_sha256": sha256(saved),
                "nonbackground_pixels": opaque_nonbackground(saved, identifier)}

    @staticmethod
    def _bits(value: float) -> bytes:
        return struct.pack(">d", value)

    def setup(self):
        try:
            super().setup()
            OUTPUT.mkdir(parents=True, exist_ok=True)
            expected = PLAN["states"]
            records: list[dict[str, object]] = []
            canvases: dict[str, bytes] = {}
            models: dict[str, object] = {}
            images: dict[str, dict[str, object]] = {}

            record, rgba = self._state_record(expected[0])
            records.append(record)
            canvases["marks"] = rgba
            models["marks"] = self.model
            images["marks.png"] = self._write_visual("marks", rgba)

            for position, trigger in enumerate(("m", "m", "l", "c", "n", "d"), start=1):
                previous = self.model
                self._key(trigger)
                record, rgba = self._state_record(expected[position], previous)
                records.append(record)
                identifier = str(expected[position]["id"])
                canvases[identifier] = rgba
                models[identifier] = self.model
                if identifier in ("trace", "long-marks"):
                    images[f"{identifier}.png"] = self._write_visual(identifier, rgba)

            # Style-only callbacks retain the exact 24 immutable paths.  Movement controls
            # construct replacement movement, as the starter deliberately promises.
            for index in (1, 2, 3, 4):
                assert records[index]["same_model_as_previous"] is True
                assert records[index]["same_paths_as_previous"] is True
            for index in (5, 6):
                assert records[index]["same_model_as_previous"] is False
                assert records[index]["same_paths_as_previous"] is False
            assert records[2]["rgba_sha256"] == records[0]["rgba_sha256"], "marks replay differs"

            # The count control adds the terminal advance while preserving the former trace
            # exactly.  The distance control samples the same starting point first, then
            # must affect feedback after that first heading.
            for path_index in range(24):
                before, after = models["palette"].path_at(path_index), models["count"].path_at(path_index)
                for point_index in range(2001):
                    assert self._bits(before.point_at(point_index)[0]) == self._bits(after.point_at(point_index)[0])
                    assert self._bits(before.point_at(point_index)[1]) == self._bits(after.point_at(point_index)[1])
                for heading_index in range(2000):
                    assert self._bits(before.heading_at(heading_index)) == self._bits(after.heading_at(heading_index))
            changed_later = False
            for path_index in range(24):
                count_path, distance_path = models["count"].path_at(path_index), models["distance"].path_at(path_index)
                assert self._bits(count_path.heading_at(0)) == self._bits(distance_path.heading_at(0))
                changed_later |= self._bits(count_path.heading_at(1)) != self._bits(distance_path.heading_at(1))
            assert changed_later, "distance edit did not feed back after heading zero"

            before_save_revision, before_save_frames = self.shown_revision, len(FRAME_OBSERVATIONS)
            self._key("s")
            assert self.shown_revision == before_save_revision == 7
            assert len(FRAME_OBSERVATIONS) == before_save_frames == 7
            saved_path = OUTPUT / "path-marks.png"
            with Image.open(saved_path) as image:
                assert image.size == (640, 640)
                saved_rgba = image.convert("RGBA").tobytes()
            assert saved_rgba == canvases["distance"], "S did not save the shown distance composition"
            quiet_started = time.monotonic()
            native = {
                "passed": True,
                "scope": "Actual py5 PathMarks starter setup/key_pressed callback route; not physical keyboard or cross-host raster identity",
                "states": records,
                "images": images,
                "save": {"path": "path-marks.png", "png_sha256": sha256(saved_path.read_bytes()),
                         "rgba_sha256": sha256(saved_rgba), "pixels_equal_displayed": True},
                "retained_style_edits": True,
                "movement_rebuilt": True,
                "count_prefix": True,
                "distance_feedback": True,
                "marks_replay_pixels": True,
                "compositions": len(FRAME_OBSERVATIONS),
            }
            def finish_after_quiet():
                try:
                    quiet_ms = (time.monotonic() - quiet_started) * 1000
                    assert quiet_ms >= 300
                    assert self.shown_revision == 7 and len(FRAME_OBSERVATIONS) == 7, "S caused a quiet composition"
                    native["save"]["quiet_ms"] = quiet_ms
                    RESULT.update(passed=True, native=native)
                except BaseException:
                    RESULT["passed"] = False
                    RESULT["traceback"] = traceback.format_exc()
                finally:
                    self.exit_sketch()
            # Return from setup while observing: do not block the animation thread and
            # then claim it was free to process queued work during the quiet interval.
            threading.Timer(0.3, finish_after_quiet).start()
            self._quiet_pending = True
        except BaseException:
            RESULT["traceback"] = traceback.format_exc()
        finally:
            if not getattr(self, "_quiet_pending", False):
                self.exit_sketch()


def main():
    try:
        CheckPathMarks().run_sketch(block=True)
    except BaseException:
        RESULT["passed"] = False
        RESULT["traceback"] = traceback.format_exc()
    print("PROCEDURALS_RESULT=" + json.dumps(RESULT, sort_keys=True))
    return 0 if RESULT.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
