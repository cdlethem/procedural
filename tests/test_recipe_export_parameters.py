import json
from pathlib import Path
import runpy
import tempfile
import unittest

from tools.export_recipe_java_prototype import build_script
from tools.run_grid_conformance import java_value


class RecipeExportParametersTest(unittest.TestCase):
    def module(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "build.py"
            path.write_text(build_script(), encoding="utf-8")
            namespace = runpy.run_path(str(path), run_name="recipe_export_test")
            return (namespace["read_parameters"], namespace["bounds"],
                    namespace["MAX_BYTES"], namespace["java_value"])

    def write_and_read(self, read_parameters, text):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "parameters.json"
            path.write_text(text, encoding="utf-8")
            return read_parameters(path)

    def test_valid_finite_numbers_and_integer_binary64(self):
        read_parameters, _, _, _ = self.module()
        raw, value = self.write_and_read(read_parameters, '{"integer":1,"fraction":1.25}')
        self.assertEqual(value, {"integer": 1.0, "fraction": 1.25})
        self.assertEqual(raw, b'{"integer":1,"fraction":1.25}')

    def test_rejects_duplicate_nonfinite_overflow_and_root_type(self):
        read_parameters, _, _, _ = self.module()
        for text in ('{"x":1,"x":2}', '{"x":NaN}', '{"x":1e400}', '[]', 'null', '1'):
            with self.subTest(text=text):
                with self.assertRaises(ValueError):
                    self.write_and_read(read_parameters, text)

    def test_depth_value_and_byte_limits(self):
        read_parameters, bounds, max_bytes, _ = self.module()
        deep = "{}"
        for _ in range(65):
            deep = '{"x":' + deep + '}'
        with self.assertRaises(ValueError):
            self.write_and_read(read_parameters, deep)
        with self.assertRaises(ValueError):
            bounds(list(range(20001)))
        with self.assertRaises(ValueError):
            self.write_and_read(read_parameters, '{"x":"' + ('a' * max_bytes) + '"}')

    def test_java_value_matches_established_emitter(self):
        _, _, _, generated_java_value = self.module()
        values = [{"seed": 1.0}, [1, 2.5, False], "literal"]
        for value in values:
            with self.subTest(value=value):
                self.assertEqual(generated_java_value(value), java_value(value))


ROOT = Path(__file__).resolve().parents[1]


if __name__ == "__main__":
    unittest.main()
