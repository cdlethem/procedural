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


def binding_contracts():
    bindings = json.loads((ROOT / "catalog/recipes/execution-bindings.json").read_text())
    return tuple(record["contract"] for record in bindings["operations"])


class RecipeJavaSchemasTest(unittest.TestCase):
    def run_generator(self, *args):
        return subprocess.run([sys.executable, str(GENERATOR), *map(str, args)], cwd=ROOT,
                              capture_output=True, text=True)

    def test_checked_in_output_is_current(self):
        result = self.run_generator("--check")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_output_contains_current_contract_hashes_and_bindings(self):
        text = OUTPUT.read_text()
        bindings = json.loads((ROOT / "catalog/recipes/execution-bindings.json").read_text())
        for binding in bindings["operations"]:
            contract = ROOT / binding["contract"]
            self.assertEqual(hashlib.sha256(contract.read_bytes()).hexdigest(), binding["contract_sha256"])
            self.assertIn(binding["id"], text)
        self.assertIn("sample", text)

    def test_generated_constructor_schemas_are_expanded(self):
        text = OUTPUT.read_text()
        self.assertNotIn('"$ref"', text)
        self.assertNotIn('"$defs"', text)

    def test_unknown_schema_keyword_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            for relative in ("catalog/recipes/execution-bindings.json",) + binding_contracts():
                target = scratch / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / relative).read_bytes())
            contract = scratch / "catalog/operations/regular-grid.json"
            value = json.loads(contract.read_text())
            value["input_schema"]["unevaluatedProperties"] = False
            contract.write_text(json.dumps(value))
            bindings = json.loads((scratch / "catalog/recipes/execution-bindings.json").read_text())
            binding = bindings["operations"][0]
            binding["contract_sha256"] = hashlib.sha256(contract.read_bytes()).hexdigest()
            (scratch / "catalog/recipes/execution-bindings.json").write_text(json.dumps(bindings))
            result = self.run_generator("--root", scratch, "--output", scratch / "RecipeSchemas.java")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("unknown schema keyword", result.stderr)

            triangle = scratch / "catalog/operations/seeded-triangle-points.json"
            value = json.loads(triangle.read_text())
            value["input_schema"]["$defs"]["unused"] = {"type": "number", "unevaluatedProperties": False}
            triangle.write_text(json.dumps(value))
            bindings = json.loads((scratch / "catalog/recipes/execution-bindings.json").read_text())
            binding = next(record for record in bindings["operations"]
                           if record["contract"] == "catalog/operations/seeded-triangle-points.json")
            binding["contract_sha256"] = hashlib.sha256(triangle.read_bytes()).hexdigest()
            (scratch / "catalog/recipes/execution-bindings.json").write_text(json.dumps(bindings))
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
            bindings = json.loads((ROOT / "catalog/recipes/execution-bindings.json").read_text())
            for relative in ("catalog/recipes/execution-bindings.json",) + binding_contracts():
                target = scratch / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / relative).read_bytes())
            path_binding = next(record for record in bindings["operations"]
                                if record["id"] == "path.gradient-trace-2d")
            path_binding["construct_input"] = "/output_schema"
            (scratch / "catalog/recipes/execution-bindings.json").write_text(json.dumps(bindings))
            output = scratch / "RecipeSchemas.java"
            result = self.run_generator("--root", scratch, "--output", output)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('"positions"', output.read_text())

    def test_binding_identity_drift_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            for relative in ("catalog/recipes/execution-bindings.json",) + binding_contracts():
                target = scratch / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / relative).read_bytes())
            bindings = json.loads((scratch / "catalog/recipes/execution-bindings.json").read_text())
            bindings["operations"][0]["id"] = "layout.changed"
            (scratch / "catalog/recipes/execution-bindings.json").write_text(json.dumps(bindings))
            result = self.run_generator("--root", scratch, "--output", scratch / "RecipeSchemas.java")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("binding identity drift", result.stderr)

    def test_local_definition_resolution_rejects_bad_reference_shapes(self):
        from tools.generate_recipe_java_schemas import resolve_schema
        nested = {
            "$defs": {"pair": {"type": "array", "prefixItems": [
                {"type": "number"}, {"type": "number"}], "items": False}},
            "type": "array", "items": {"$ref": "#/$defs/pair"}}
        resolved = resolve_schema(nested, nested)
        self.assertNotIn("$defs", resolved)
        self.assertEqual(resolved["items"]["prefixItems"][0]["type"], "number")
        cases = (
            ({"$defs": {"loop": {"$ref": "#/$defs/loop"}}, "type": "object",
              "properties": {"x": {"$ref": "#/$defs/loop"}}}, "cyclic"),
            ({"$ref": "#/$defs/missing"}, "unresolved"),
            ({"$ref": "https://example.test/schema"}, "only local"),
            ({"$defs": {"x": {"type": "number"}}, "$ref": "#/$defs/x", "type": "number"}, "semantic siblings"),
        )
        for schema, message in cases:
            with self.subTest(message=message), self.assertRaisesRegex(ValueError, message):
                resolve_schema(schema, schema)

    def test_generation_does_not_mutate_contract_json(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            for relative in ("catalog/recipes/execution-bindings.json",) + binding_contracts():
                target = scratch / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / relative).read_bytes())
            before = {relative: (scratch / relative).read_bytes()
                      for relative in binding_contracts()}
            result = self.run_generator("--root", scratch, "--output", scratch / "RecipeSchemas.java")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(before, {relative: (scratch / relative).read_bytes()
                                      for relative in binding_contracts()})


if __name__ == "__main__":
    unittest.main()
