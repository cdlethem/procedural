import copy
import json
import tempfile
import unittest
from pathlib import Path

from tools import validate_recipe_draft as validator


ROOT = Path(__file__).resolve().parents[1]


def recipe(name):
    return json.loads((ROOT / "design/recipes/examples" / (name + ".draft.json")).read_text())


class RecipeDraftValidationTests(unittest.TestCase):
    def setUp(self):
        parent = ROOT / ".work" / "tmp"
        parent.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=parent)
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)

    def assert_error(self, document, code):
        with self.assertRaises(validator.RecipeError) as caught:
            validator.validate(document)
        self.assertEqual(caught.exception.code, code)

    def test_actual_field_and_path_drafts_are_static_valid(self):
        for name in ("field-marks", "path-marks"):
            with self.subTest(recipe=name):
                self.assertEqual(validator.validate(recipe(name))["status"], "static-valid-draft")

    def test_unknown_duplicate_and_wrong_version_operations_fail(self):
        document = recipe("field-marks")
        document["operations"].append(copy.deepcopy(document["operations"][0]))
        self.assert_error(document, "DUPLICATE_OPERATION")
        document = recipe("field-marks")
        document["operations"][0]["id"] = "unknown.operation"
        self.assert_error(document, "UNKNOWN_OPERATION")
        document = recipe("field-marks")
        document["operations"][0]["version"] = "9.9.9"
        self.assert_error(document, "OPERATION_VERSION")

    def test_stale_binding_is_reported(self):
        metadata_path = Path("catalog/recipes/execution-bindings.json")
        metadata = json.loads((ROOT / metadata_path).read_text())
        target = self.base / metadata_path
        target.parent.mkdir(parents=True)
        target.write_text(json.dumps(metadata))
        for row in metadata["operations"]:
            contract = self.base / row["contract"]
            contract.parent.mkdir(parents=True, exist_ok=True)
            contract.write_bytes((ROOT / row["contract"]).read_bytes())
        changed = self.base / metadata["operations"][0]["contract"]
        changed.write_bytes(changed.read_bytes() + b"\n")
        with self.assertRaises(validator.RecipeError) as caught:
            validator.load_bindings(self.base)
        self.assertEqual(caught.exception.code, "BINDING_STALE")

    def test_scope_forward_dead_branch_and_shadowing_fail(self):
        document = recipe("field-marks")
        document["retain"][0]["value"] = {"kind": "ref", "name": "later"}
        self.assert_error(document, "UNBOUND_NAME")
        document = recipe("field-marks")
        document["environment"] = {
            "kind": "if", "condition": {"kind": "literal", "value": True},
            "then": {"kind": "literal", "value": 1},
            "else": {"kind": "ref", "name": "missing"},
        }
        self.assert_error(document, "UNBOUND_NAME")
        document = recipe("field-marks")
        document["frame"].insert(0, {"kind": "bind", "name": "grid", "value": {"kind": "literal", "value": 1}})
        self.assert_error(document, "SHADOWED_NAME")

    def test_query_port_must_belong_to_a_declared_operation(self):
        document = recipe("path-marks")
        document["operations"] = [operation for operation in document["operations"]
                                  if operation["id"] != "color.cyclic-palette"]
        document["environment"] = {
            "kind": "query", "instance": {"kind": "literal", "value": None},
            "port": "sample", "input": {"kind": "literal", "value": 0},
        }
        self.assert_error(document, "UNKNOWN_PORT")

    def test_malformed_nonfinite_and_duplicate_json_are_rejected(self):
        cases = [("{", "INVALID_JSON"), ("{\"value\":NaN}", "NONFINITE_NUMBER"),
                 ("{\"a\":1,\"a\":2}", "DUPLICATE_KEY"),
                 ("{\"value\":1e9999}", "NONFINITE_NUMBER")]
        for index, (text, code) in enumerate(cases):
            with self.subTest(code=code):
                path = self.base / (str(index) + ".json")
                path.write_text(text)
                with self.assertRaises(validator.RecipeError) as caught:
                    validator.load_json(path)
                self.assertEqual(caught.exception.code, code)

    def test_depth_and_value_limits_are_rejected(self):
        deep = self.base / "deep.json"
        deep.write_text("[" * 65 + "0" + "]" * 65)
        with self.assertRaises(validator.RecipeError) as caught:
            validator.load_json(deep)
        self.assertEqual(caught.exception.code, "AST_DEPTH_LIMIT")
        large = self.base / "large.json"
        large.write_text("[" + ",".join("0" for _ in range(20_000)) + "]")
        with self.assertRaises(validator.RecipeError) as caught:
            validator.load_json(large)
        self.assertEqual(caught.exception.code, "AST_SIZE_LIMIT")

    def test_byte_limit_is_enforced_before_parsing(self):
        path = self.base / "oversized.json"
        path.write_bytes(b" " * (validator.MAX_BYTES + 1))
        with self.assertRaises(validator.RecipeError) as caught:
            validator.load_json(path)
        self.assertEqual(caught.exception.code, "INPUT_TOO_LARGE")
