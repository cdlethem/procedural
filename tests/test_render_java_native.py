"""Opt-in actual Processing lifecycle check: PROCEDURALS_TEST_JAR=/path/to.jar."""
import os
from pathlib import Path
import tempfile
import unittest
import json
from PIL import Image
from tools import render_java

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.environ.get("PROCEDURALS_TEST_JAR"), "requires accepted Java JAR and pinned native runtime")
class FrameSelectionNativeTests(unittest.TestCase):
    def test_accumulation_default_and_repeat(self):
        parent = ROOT / ".work" / "tmp"
        parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as temporary:
            pixels = []
            for label, extra, count in (("first", [], 1), ("fifth", ["--frame", "5"], 5),
                                        ("repeat", ["--frame", "5"], 5)):
                output = Path(temporary) / label
                render_java.main([
                    str(ROOT / "tests/native/FrameSelection/FrameSelection.pde"),
                    "--library", os.environ["PROCEDURALS_TEST_JAR"], "--seed", "42",
                    "--output", str(output), *extra,
                ])
                report = json.loads((output / "report.json").read_text())
                self.assertEqual(report["status"], "passed")
                native = report["variants"][0]["native"]
                self.assertEqual((native["draws"], native["selected_frame"], native["frames"]),
                                 (count, count, 1))
                with Image.open(report["variants"][0]["image"]) as image:
                    actual = image.convert("RGB")
                    # Every intermediate draw leaves its own color in a separate column.
                    for y in range(16):
                        for x in range(32):
                            self.assertEqual(actual.getpixel((x, y)),
                                             (42, x + 1, 0) if x < count else (0, 0, 0))
                    pixels.append(actual.tobytes())
            self.assertNotEqual(pixels[0], pixels[1])
            self.assertEqual(pixels[1], pixels[2])
