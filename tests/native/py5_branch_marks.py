#!/usr/bin/env python3
"""Run the preregistered BranchMarks sequence through the actual py5 starter."""
from __future__ import annotations
import argparse, hashlib, json, struct, sys, time, traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
OUTPUT = args.output.resolve()
if not OUTPUT.is_relative_to(ROOT / ".work") or OUTPUT.exists():
    raise ValueError("output must be fresh under .work")
OUTPUT.mkdir(parents=True)
sys.path[:0] = [str(ROOT / "packages/python/examples/branch_marks"), str(ROOT / "packages/python")]
import py5
from jpype import JChar, JClass
from PIL import Image
import sketch as starter
starter.OUTPUT = OUTPUT

FILES = (
    "packages/python/procedurals/branch_tree.py",
    "packages/python/procedurals/placements.py",
    "packages/python/examples/branch_marks/branch_composition.py",
    "packages/python/examples/branch_marks/sketch.py",
    "tests/native/py5_branch_marks.py",
    "design/capabilities/branch-marks-py5-acceptance.md",
    "catalog/operations/seeded-endpoint-branches.json",
    "fixtures/operations/seeded-endpoint-branches.json",
    "catalog/operations/seeded-circle-placement.json",
    "fixtures/operations/seeded-circle-placement.json",
)
REPORT = {"status": "failed", "scope": "Actual py5 BranchMarks callbacks; no package or source-recreation acceptance", "states": []}
sha = lambda data: hashlib.sha256(data).hexdigest()

def hashes():
    paths = [ROOT / name for name in FILES]
    package = Path(py5.__file__).parent
    paths += [package / name for name in ("__init__.py", "sketch.py", "base.py", "jars/core.jar", "jars/py5.jar")]
    java = Path(str(JClass("java.lang.System").getProperty("java.home")))
    paths += [java / "release", java / "lib/modules"]
    return {str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path): sha(path.read_bytes()) for path in paths}

def rgba(sketch):
    sketch.load_np_pixels()
    if sketch.np_pixels.shape != (640, 640, 4):
        raise AssertionError("canvas dimensions")
    return sketch.np_pixels[:, :, [1, 2, 3, 0]].tobytes()

def geometry(composition):
    digest = hashlib.sha256()
    for tree_index in range(composition.size):
        tree = composition.tree_at(tree_index)
        values = tree.to_values()
        digest.update(struct.pack(">q", len(values["segments"])))
        for segment, heading, length, parent, generation, children in zip(
                values["segments"], values["headings"], values["lengths"], values["parents"],
                values["generations"], values["childCounts"]):
            digest.update(struct.pack(">ddddddqqq", *segment, heading, length, parent, generation, children))
    return digest.hexdigest()

def terminal_count(composition):
    return sum(sum(child == 0 for child in tree.to_values()["childCounts"]) for tree in
               (composition.tree_at(i) for i in range(composition.size)))

def prefix(short, extended):
    assert short.size == extended.size
    assert extended.total_segments > short.total_segments
    for tree_index in range(short.size):
        a, b = short.tree_at(tree_index).to_values(), extended.tree_at(tree_index).to_values()
        for key in ("segments", "headings", "lengths", "parents", "generations"):
            assert a[key] == b[key][:len(a[key])], f"prefix {tree_index}/{key}"

class CheckBranchMarks(starter.BranchMarksSketch):
    def settings(self):
        super().settings()

    def paint_shown_composition(self):
        self.paint_calls += 1
        self.line_calls = self.ellipse_calls = 0
        super().paint_shown_composition()

    def line(self, *args):
        self.line_calls += 1
        return super().line(*args)

    def ellipse(self, *args):
        self.ellipse_calls += 1
        return super().ellipse(*args)

    def setup(self):
        self.paint_calls = 0
        try:
            super().setup()
            canvases, compositions = {}, {}
            prior = None
            # id, key, expected settings, retained identity, expected pixels, save image
            base = dict(seed=42, more=False, narrowing=False, binary=False,
                        wider=False, forest=False, taper=True, alternate=False)
            steps = (
                ("initial", None, base, None, None, 101, 1, 53),
                ("extended", "n", {**base, "more": True}, False, None, 192, 1, 99),
                ("extended-restored", "n", base, False, "initial", 101, 1, 53),
                ("narrowing", "g", {**base, "narrowing": True}, False, None, 101, 1, 53),
                ("reset-1", "0", base, False, "initial", 101, 1, 53),
                ("wide", "w", {**base, "wider": True}, False, None, 101, 1, 53),
                ("reset-2", "0", base, False, "initial", 101, 1, 53),
                ("binary", "b", {**base, "binary": True}, False, None, 38, 1, 16),
                ("reset-3", "0", base, False, "initial", 101, 1, 53),
                ("recolour", "c", {**base, "alternate": True}, True, None, 101, 1, 53),
                ("thin", "m", {**base, "alternate": True, "taper": False}, True, None, 101, 1, 0),
                ("forest", "x", {**base, "forest": True, "alternate": True, "taper": False}, False, None, 288, 7, 0),
                ("forest-taper", "m", {**base, "forest": True, "taper": True, "alternate": True}, True, None, 288, 7, 145),
                ("forest-palette", "c", {**base, "forest": True, "taper": True, "alternate": False}, True, None, 288, 7, 145),
                ("forest-extended", "n", {**base, "forest": True, "taper": True, "alternate": False, "more": True}, False, None, 560, 7, 280),
                ("forest-seed", "r", {**base, "forest": True, "taper": True, "alternate": False, "more": True, "seed": 43}, False, None, 634, 8, 313),
                ("final-reset", "0", base, False, "initial", 101, 1, 53),
            )
            def press(value):
                self._instance.key = JChar(value)
                self.key_pressed()
            def setting_values():
                return {key: getattr(self, key) for key in base}
            def capture(identifier, expected, retained, equal_to, expected_segments, expected_trees, expected_dots):
                nonlocal prior
                assert (self.width, self.height, self.pixel_width, self.pixel_height) == (640, 640, 640, 640)
                assert self.shown_revision == len(REPORT["states"]) + 1
                assert self.paint_calls == self.shown_revision
                assert setting_values() == expected, f"{identifier}: settings"
                composition = self.composition
                assert composition.size == expected_trees, f"{identifier}: tree count"
                assert composition.total_segments == expected_segments, f"{identifier}: segment count"
                assert composition.total_segments == sum(composition.tree_at(i).size for i in range(composition.size))
                expected_dots_actual = terminal_count(composition)
                assert (expected_dots_actual if self.taper else 0) == expected_dots, f"{identifier}: terminal count"
                assert self.line_calls == composition.total_segments, f"{identifier}: line count"
                assert self.ellipse_calls == (expected_dots if self.taper else 0), f"{identifier}: tip count"
                current_geometry = geometry(composition)
                if prior is not None:
                    assert (composition is prior[0]) == retained, f"{identifier}: identity"
                    assert (current_geometry == prior[1]) == retained, f"{identifier}: geometry retention"
                image = rgba(self)
                if equal_to is not None:
                    assert image == canvases[equal_to], f"{identifier}: pixels differ from {equal_to}"
                elif prior is not None:
                    assert image != canvases[prior[2]], f"{identifier}: edit did not change pixels"
                destination = OUTPUT / f"{identifier}.png"
                self.save(str(destination), drop_alpha=False, use_thread=False)
                with Image.open(destination) as saved:
                    assert saved.size == (640, 640) and saved.convert("RGBA").tobytes() == image
                REPORT["states"].append({"id": identifier, "revision": self.shown_revision,
                    "trees": composition.size, "segments": composition.total_segments,
                    "settings": setting_values(), "actual_terminals": expected_dots_actual,
                    "terminal_dots": expected_dots, "line_calls": self.line_calls,
                    "ellipse_calls": self.ellipse_calls, "retained_identity": retained,
                    "rgba_sha256": sha(image), "png_sha256": sha(destination.read_bytes())})
                canvases[identifier], compositions[identifier] = image, composition
                prior = (composition, current_geometry, identifier)
            for identifier, trigger, expected, retained, equal_to, expected_segments, expected_trees, expected_dots in steps:
                if trigger is not None:
                    press(trigger)
                capture(identifier, expected, retained, equal_to, expected_segments, expected_trees, expected_dots)
            prefix(compositions["initial"], compositions["extended"])
            prefix(compositions["forest"], compositions["forest-extended"])
            before = rgba(self), self.shown_revision, self.paint_calls, self.composition
            press("q")
            time.sleep(.25)
            assert (rgba(self), self.shown_revision, self.paint_calls, self.composition) == before
            press("s")
            time.sleep(.25)
            saved_path = OUTPUT / "branch-marks.png"
            assert saved_path.is_file()
            with Image.open(saved_path) as saved:
                assert saved.convert("RGBA").tobytes() == before[0]
            assert (rgba(self), self.shown_revision, self.paint_calls) == before[:3]
            assert self.composition is before[3]
            assert self.paint_calls == 17
            REPORT.update(status="passed", paint_calls=self.paint_calls, saved_png_sha256=sha(saved_path.read_bytes()))
        except BaseException:
            REPORT["failure"] = traceback.format_exc()
        finally:
            self.exit_sketch()

REPORT.update(py5=str(py5.__version__), python=sys.version, java=str(JClass("java.lang.System").getProperty("java.version")))
REPORT["input_sha256_before"] = hashes()
try:
    CheckBranchMarks().run_sketch(block=True)
except BaseException:
    REPORT["failure"] = traceback.format_exc()
REPORT["input_sha256_after"] = hashes()
if REPORT["input_sha256_before"] != REPORT["input_sha256_after"]:
    REPORT.update(status="failed", failure="source/runtime changed during attempt")
(OUTPUT / "result.json").write_text(json.dumps(REPORT, indent=2) + "\n")
print(json.dumps({"status": REPORT["status"], "output": str(OUTPUT), "failure": REPORT.get("failure")}))
raise SystemExit(0 if REPORT["status"] == "passed" else 1)
