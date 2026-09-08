import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "tools/generate_recipe_java_schemas.py"
OUTPUT = ROOT / "packages/java-recipe-prototype/src/main/java/org/procedurals/recipe/RecipeSchemas.java"


class RecipeJavaSchemasTest(unittest.TestCase):
    def run_generator(self, *args):
        return subprocess.run([sys.executable, str(GENERATOR), *map(str, args)], cwd=ROOT,
                              capture_output=True, text=True)

    def test_checked_in_output_is_current(self):
        result = self.run_generator("--check")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_output_contains_current_contract_hashes_and_bindings(self):
        text = OUTPUT.read_text()
        bindings = json.loads((ROOT / "design/recipes/execution-bindings.json").read_text())
        for binding in bindings["operations"]:
            contract = ROOT / binding["contract"]
            self.assertEqual(hashlib.sha256(contract.read_bytes()).hexdigest(), binding["contract_sha256"])
            self.assertIn(binding["id"], text)
        self.assertIn("sample", text)

    def test_unknown_schema_keyword_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            for relative in ("design/recipes/execution-bindings.json", "catalog/operations/regular-grid.json"):
                target = scratch / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / relative).read_bytes())
            contract = scratch / "catalog/operations/regular-grid.json"
            value = json.loads(contract.read_text())
            value["input_schema"]["unevaluatedProperties"] = False
            contract.write_text(json.dumps(value))
            bindings = json.loads((scratch / "design/recipes/execution-bindings.json").read_text())
            binding = bindings["operations"][0]
            binding["contract_sha256"] = hashlib.sha256(contract.read_bytes()).hexdigest()
            (scratch / "design/recipes/execution-bindings.json").write_text(json.dumps(bindings))
            result = self.run_generator("--root", scratch, "--output", scratch / "RecipeSchemas.java")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("unknown schema keyword", result.stderr)

    def test_stale_output_and_invalid_schema_shapes_are_rejected(self):
        from tools.generate_recipe_java_schemas import validate_schema
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "RecipeSchemas.java"
            output.write_text(OUTPUT.read_text() + "// drift\n")
            result = self.run_generator("--check", "--output", output)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("stale", result.stderr)
        for schema in ({"minimum": 0}, {"type": "array", "minItems": -1},
                       {"type": "array", "items": {"const": 1}}):
            with self.subTest(schema=schema), self.assertRaises(ValueError):
                validate_schema(schema)

    def test_constructor_pointer_is_resolved(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            bindings = json.loads((ROOT / "design/recipes/execution-bindings.json").read_text())
            for relative in ("design/recipes/execution-bindings.json",) + tuple(
                    "catalog/operations/" + name + ".json"
                    for name in ("regular-grid", "gradient-noise-2d-01", "cyclic-palette", "gradient-path")):
                target = scratch / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / relative).read_bytes())
            bindings["operations"][3]["construct_input"] = "/output_schema"
            (scratch / "design/recipes/execution-bindings.json").write_text(json.dumps(bindings))
            output = scratch / "RecipeSchemas.java"
            result = self.run_generator("--root", scratch, "--output", output)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('"positions"', output.read_text())

    def test_binding_identity_drift_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            for relative in ("design/recipes/execution-bindings.json", "catalog/operations/regular-grid.json"):
                target = scratch / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / relative).read_bytes())
            bindings = json.loads((scratch / "design/recipes/execution-bindings.json").read_text())
            bindings["operations"][0]["id"] = "layout.changed"
            (scratch / "design/recipes/execution-bindings.json").write_text(json.dumps(bindings))
            result = self.run_generator("--root", scratch, "--output", scratch / "RecipeSchemas.java")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("binding identity drift", result.stderr)


if __name__ == "__main__":
    unittest.main()
