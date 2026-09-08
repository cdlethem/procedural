import contextlib
import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from tools import contact_sheet


ROOT = Path(__file__).resolve().parents[1]


class ContactSheetTests(unittest.TestCase):
    def setUp(self):
        parent = ROOT / ".work" / "tmp"
        parent.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=parent)
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)

    def image(self, name, size, color, mode="RGBA"):
        path = self.base / name
        Image.new(mode, size, color).save(path)
        return path

    def call_cli(self, *arguments):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            contact_sheet.main(arguments)
        return output.getvalue()

    def test_order_aspect_and_alpha_are_preserved(self):
        first = self.image("first.png", (64, 32), (0, 255, 0, 128))
        second = self.image("second.png", (16, 48), (0, 0, 255, 255))
        output = self.base / "sheet.png"
        self.call_cli(str(first), str(second), "--output", str(output), "--columns", "2", "--cell-size", "64")
        sheet = Image.open(output).convert("RGB")
        self.assertEqual(sheet.size, (128, 64))
        self.assertEqual(sheet.getpixel((32, 24)), (127, 255, 127))
        self.assertEqual(sheet.getpixel((96, 24)), (0, 0, 255))
        self.assertEqual(sheet.getpixel((80, 24)), (255, 255, 255))

    def test_corrupt_input_leaves_no_output(self):
        corrupt = self.base / "bad.png"
        corrupt.write_bytes(b"not a PNG")
        output = self.base / "sheet.png"
        with self.assertRaises(SystemExit):
            self.call_cli(str(corrupt), "--output", str(output))
        self.assertFalse(output.exists())

    def test_output_must_be_fresh_and_under_work(self):
        source = self.image("source.png", (8, 8), "red")
        output = self.base / "sheet.png"
        output.write_bytes(b"existing")
        with self.assertRaises(SystemExit):
            self.call_cli(str(source), "--output", str(output))
        outside = ROOT / "sheet.png"
        with self.assertRaises(SystemExit):
            contact_sheet.main([str(source), "--output", str(outside)])

    def test_bounds_reject_invalid_columns_cell_size_and_many_images(self):
        source = self.image("source.png", (8, 8), "red")
        for arguments in (("--columns", "0"), ("--cell-size", "63")):
            with self.assertRaises(SystemExit):
                self.call_cli(str(source), "--output", str(self.base / (arguments[0][2:] + ".png")), *arguments)
        with self.assertRaises(SystemExit):
            self.call_cli(*([str(source)] * 65), "--output", str(self.base / "many.png"))

    def test_jpeg_is_accepted_and_output_is_png(self):
        jpeg = self.base / "source.jpg"
        Image.new("RGB", (10, 10), "red").save(jpeg, "JPEG")
        output = self.base / "sheet.png"
        message = self.call_cli(str(jpeg), "--output", str(output))
        self.assertIn(str(output), message)
        self.assertIn("1", message)
        with Image.open(output) as sheet:
            self.assertEqual(sheet.format, "PNG")
