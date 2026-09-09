import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path

from PIL import Image

from tools import extract_palette

ROOT = Path(__file__).resolve().parents[1]


class ExtractPaletteTests(unittest.TestCase):
    def setUp(self):
        parent = ROOT / ".work" / "tmp"
        parent.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=parent)
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)

    def image(self, name, size, color, mode="RGB"):
        path = self.base / name
        Image.new(mode, size, color).save(path)
        return path

    def call(self, image, output, *extra):
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            extract_palette.main([str(image), "--colors", "8", "--output", str(output), *extra])
        return stdout.getvalue(), json.loads(output.read_text())

    def test_two_and_three_solid_colors_are_exact_and_counted(self):
        path = self.base / "three.png"
        image = Image.new("RGB", (3, 2))
        image.putdata([(255, 0, 0), (0, 255, 0), (0, 0, 255)] * 2)
        image.save(path)
        text, data = self.call(path, self.base / "palette.json")
        self.assertEqual(data["colors"], [0x0000FF, 0x00FF00, 0xFF0000])
        self.assertEqual(data["counts"], [2, 2, 2])
        self.assertEqual(sum(data["counts"]), 6)
        self.assertIn("0xFF0000", text)

    def test_uneven_two_color_counts_sort_by_count_then_rgb(self):
        path = self.base / "uneven.png"
        image = Image.new("RGB", (5, 1))
        image.putdata([(0, 0, 255), (0, 0, 255), (255, 0, 0), (0, 0, 255), (255, 0, 0)])
        image.save(path)
        _, data = self.call(path, self.base / "palette.json")
        self.assertEqual(data["colors"], [0x0000FF, 0xFF0000])
        self.assertEqual(data["counts"], [3, 2])

    def test_downsample_counts_conserve_sample_pixels(self):
        path = self.image("large.png", (513, 257), (12, 34, 56))
        _, data = self.call(path, self.base / "palette.json")
        self.assertEqual(data["sample_dimensions"], [256, 128])
        self.assertEqual(sum(data["counts"]), 256 * 128)

    def test_uniform_allows_fewer_colors(self):
        _, data = self.call(self.image("uniform.png", (10, 10), (12, 34, 56)), self.base / "palette.json")
        self.assertEqual(data["colors"], [0x0C2238])
        self.assertEqual(data["counts"], [100])

    def test_alpha_requires_matte_and_composites(self):
        path = self.image("alpha.png", (2, 1), (255, 0, 0, 128), "RGBA")
        with self.assertRaises(SystemExit):
            self.call(path, self.base / "missing.json")
        _, data = self.call(path, self.base / "matted.json", "--matte", "0000FF")
        self.assertEqual(data["colors"], [0x80007F])
        self.assertEqual(data["counts"], [2])
        self.assertEqual(data["matte"], 0x0000FF)

    def test_invalid_count_format_output_and_existing_preserved(self):
        source = self.image("source.png", (2, 2), (1, 2, 3))
        for value in ("0", "33"):
            with self.assertRaises(SystemExit):
                extract_palette.main([str(source), "--colors", value, "--output", str(self.base / (value + ".json"))])
        with self.assertRaises(SystemExit):
            extract_palette.main([str(source), "--colors", "2", "--matte", "#000000", "--output", str(self.base / "bad.json")])
        output = self.base / "existing.json"
        output.write_text("keep")
        with self.assertRaises(SystemExit):
            extract_palette.main([str(source), "--colors", "2", "--output", str(output)])
        self.assertEqual(output.read_text(), "keep")

    def test_gif_and_output_outside_work_are_rejected(self):
        gif = self.base / "source.gif"
        Image.new("RGB", (2, 2), (1, 2, 3)).save(gif, "GIF")
        with self.assertRaises(SystemExit):
            extract_palette.main([str(gif), "--colors", "2", "--output", str(self.base / "gif.json")])
        with self.assertRaises(SystemExit):
            extract_palette.main([str(self.image("outside.png", (2, 2), "red")), "--colors", "2", "--output", str(ROOT / "palette.json")])

    def test_replaced_source_is_revalidated_before_decode_or_publish(self):
        source = self.image("race.png", (2, 2), (10, 20, 30))
        replacement = self.base / "replacement.gif"
        Image.new("RGB", (2, 2), (1, 2, 3)).save(replacement, "GIF")
        output = self.base / "race.json"

        def check_then_replace(paths):
            source.write_bytes(replacement.read_bytes())
            return [(source, 2, 2)]

        with mock.patch.object(extract_palette, "source_images", check_then_replace):
            with self.assertRaises(SystemExit):
                extract_palette.main([str(source), "--colors", "2", "--output", str(output)])
        self.assertFalse(output.exists())

    def test_direct_cli_smoke(self):
        source = self.image("cli.png", (2, 2), (10, 20, 30))
        output = self.base / "cli.json"
        result = subprocess.run([sys.executable, str(ROOT / "tools" / "extract_palette.py"), str(source), "--colors", "2", "--output", str(output)], capture_output=True, text=True, check=True)
        self.assertIn("int[] colors = {0x0A141E};", result.stdout)
        self.assertEqual(json.loads(output.read_text())["colors"], [0x0A141E])


if __name__ == "__main__":
    unittest.main()
