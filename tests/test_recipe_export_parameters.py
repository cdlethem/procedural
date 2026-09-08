import json
from pathlib import Path
import runpy
import tempfile
import unittest

from tools.export_recipe_java_prototype import build_script


class RecipeExportParametersTest(unittest.TestCase):
    def module(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "build.py"
            path.write_text(build_script(), encoding="utf-8")
            namespace = runpy.run_path(str(path), run_name="recipe_export_test")
            return (namespace["read_parameters"], namespace["read_contexts"], namespace["bounds"],
                    namespace["MAX_BYTES"], namespace["MAX_CONTEXTS"])

    def write_and_read(self, read_parameters, text):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "parameters.json"
            path.write_text(text, encoding="utf-8")
            return read_parameters(path)

    def test_valid_finite_numbers_and_integer_binary64(self):
        read_parameters, _, _, _, _ = self.module()
        raw, value = self.write_and_read(read_parameters, '{"integer":1,"fraction":1.25}')
        self.assertEqual(value, {"integer": 1.0, "fraction": 1.25})
        self.assertEqual(raw, b'{"integer":1,"fraction":1.25}')

    def test_rejects_duplicate_nonfinite_overflow_and_root_type(self):
        read_parameters, _, _, _, _ = self.module()
        for text in ('{"x":1,"x":2}', '{"x":NaN}', '{"x":1e400}', '[]', 'null', '1'):
            with self.subTest(text=text):
                with self.assertRaises(ValueError):
                    self.write_and_read(read_parameters, text)

    def test_depth_value_and_byte_limits(self):
        read_parameters, _, bounds, max_bytes, _ = self.module()
        deep = "{}"
        for _ in range(65):
            deep = '{"x":' + deep + '}'
        with self.assertRaises(ValueError):
            self.write_and_read(read_parameters, deep)
        with self.assertRaises(ValueError):
            bounds(list(range(20001)))
        with self.assertRaises(ValueError):
            self.write_and_read(read_parameters, '{"x":"' + ('a' * max_bytes) + '"}')

    def test_context_reader_accepts_empty_repeats_and_maximum(self):
        _, read_contexts, _, _, max_contexts = self.module()
        for contexts in ([], [{"index": 2, "timeSeconds": 1.5}] * 2,
                         [{"index": 0, "timeSeconds": 0}] * max_contexts):
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "contexts.json"
                path.write_text(json.dumps({"contexts": contexts}), encoding="utf-8")
                _, actual = read_contexts(path)
                self.assertEqual(actual, contexts)

    def test_context_reader_rejects_bad_envelope_type_count_and_values(self):
        _, read_contexts, _, _, max_contexts = self.module()
        cases = [
            "[]", '{"contexts":{}}', '{"contexts":[' + ','.join('{}' for _ in range(max_contexts + 1)) + ']}',
            '{"contexts":[],"extra":1}', '{"contexts":[NaN]}', '{"contexts":[{"x":1,"x":2}]}'
        ]
        for text in cases:
            with self.subTest(text=text):
                with self.assertRaises(ValueError):
                    self.write_and_read(read_contexts, text)



ROOT = Path(__file__).resolve().parents[1]


if __name__ == "__main__":
    unittest.main()
