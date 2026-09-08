import runpy
import struct
import tempfile
import unittest
from pathlib import Path

from tools.export_recipe_java_prototype import build_script


class RecipeExportDataTest(unittest.TestCase):
    def test_known_binary_vector(self):
        value = {
            "n": None,
            "f": False,
            "t": True,
            "z": -0.0,
            "s": "é",
            "a": [1.5, {"k": "v"}],
        }
        expected = bytearray(b"PRD1")
        expected.extend(b"\x06" + struct.pack(">i", 6))
        expected.extend(struct.pack(">i", 1) + b"n" + b"\x00")
        expected.extend(struct.pack(">i", 1) + b"f" + b"\x01")
        expected.extend(struct.pack(">i", 1) + b"t" + b"\x02")
        expected.extend(struct.pack(">i", 1) + b"z" + b"\x03" + struct.pack(">d", -0.0))
        expected.extend(struct.pack(">i", 1) + b"s" + b"\x04" + struct.pack(">i", 2) + "é".encode("utf-8"))
        expected.extend(struct.pack(">i", 1) + b"a" + b"\x05" + struct.pack(">i", 2))
        expected.extend(b"\x03" + struct.pack(">d", 1.5))
        expected.extend(b"\x06" + struct.pack(">i", 1) + struct.pack(">i", 1) + b"k" + b"\x04" + struct.pack(">i", 1) + b"v")

        with tempfile.TemporaryDirectory() as directory:
            script = Path(directory) / "build.py"
            script.write_text(build_script(), encoding="utf-8")
            namespace = runpy.run_path(str(script))
            self.assertEqual(namespace["encode_recipe"](value), bytes(expected))


if __name__ == "__main__":
    unittest.main()
