import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "tools/generate_recipe_java_grammar.py"
OUTPUT = ROOT / "packages/java-recipe-prototype/src/main/java/org/procedurals/recipe/RecipeGrammar.java"
CONTRACTS = tuple({
    record["contract"] for record in json.loads(
        (ROOT / "catalog/recipes/execution-bindings.json").read_text())['operations']
})


class RecipeJavaGrammarTest(unittest.TestCase):
    def run_generator(self, *args):
        return subprocess.run([sys.executable, str(GENERATOR), *map(str, args)], cwd=ROOT,
                              capture_output=True, text=True)

    def copy_inputs(self, scratch):
        for relative in ("catalog/recipes/recipe.schema.json",
                         "catalog/recipes/execution-bindings.json", *CONTRACTS):
            target = scratch / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((ROOT / relative).read_bytes())

    def test_deterministic_checked_in_surface_and_hashes(self):
        result = self.run_generator("--check")
        self.assertEqual(result.returncode, 0, result.stderr)
        text = OUTPUT.read_text()
        for relative in ("catalog/recipes/recipe.schema.json", "catalog/recipes/execution-bindings.json"):
            self.assertIn(hashlib.sha256((ROOT / relative).read_bytes()).hexdigest(), text)
        self.assertIn("static Object schema()", text)
        self.assertIn("static Map<String,String> declarations()", text)

    def test_generated_surface_preserves_schema_and_ports(self):
        text = OUTPUT.read_text()
        schema = json.loads((ROOT / "catalog/recipes/recipe.schema.json").read_text())
        bindings = json.loads((ROOT / "catalog/recipes/execution-bindings.json").read_text())
        for marker in (schema["$id"], "layout.regular-grid", "field.gradient-noise-2d-01",
                       "color.cyclic-palette", "path.gradient-trace-2d", "sample", "point"):
            self.assertIn(marker, text)
        sys.path.insert(0, str(ROOT))
        from tools.run_grid_conformance import java_value
        self.assertIn("freeze(" + java_value(schema) + ");", text)

    def test_unknown_keyword_and_unresolved_ref_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            self.copy_inputs(scratch)
            schema_path = scratch / "catalog/recipes/recipe.schema.json"
            schema = json.loads(schema_path.read_text())
            schema["$defs"]["name"]["unevaluatedProperties"] = False
            schema_path.write_text(json.dumps(schema))
            result = self.run_generator("--root", scratch, "--output", scratch / "RecipeGrammar.java")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("unknown schema keyword", result.stderr)

            schema = json.loads((ROOT / "catalog/recipes/recipe.schema.json").read_text())
            schema["properties"]["environment"] = {"$ref": "#/$defs/missing"}
            schema_path.write_text(json.dumps(schema))
            result = self.run_generator("--root", scratch, "--output", scratch / "RecipeGrammar.java")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("unresolved local schema ref", result.stderr)

    def test_binding_identity_and_duplicate_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            self.copy_inputs(scratch)
            path = scratch / "catalog/recipes/execution-bindings.json"
            bindings = json.loads(path.read_text())
            bindings["operations"][1]["id"] = bindings["operations"][0]["id"]
            path.write_text(json.dumps(bindings))
            result = self.run_generator("--root", scratch, "--output", scratch / "RecipeGrammar.java")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("duplicate binding id", result.stderr)

    def test_binding_contract_hash_drift_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            self.copy_inputs(scratch)
            contract = scratch / CONTRACTS[0]
            contract.write_text(contract.read_text() + "\n")
            result = self.run_generator("--root", scratch, "--output", scratch / "RecipeGrammar.java")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("contract hash drift", result.stderr)


if __name__ == "__main__":
    unittest.main()
