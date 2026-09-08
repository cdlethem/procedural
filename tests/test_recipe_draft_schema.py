import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / "design/recipes/recipe.schema.json").read_text())
Draft202012Validator.check_schema(SCHEMA)
VALIDATOR = Draft202012Validator(SCHEMA)


def literal(value):
    return {"kind": "literal", "value": value}


def grammar_example():
    """Grammar-only example; deliberately not operation/type/capability-valid."""
    return {
        "format": "procedurals.recipe",
        "version": "0.1.0",
        "status": "draft",
        "parameters": {"seed": 42},
        "operations": [{"id": "layout.regular-grid", "version": "0.1.0"}],
        "drawing": {"id": "drawing.fresh-raster-2d", "version": "0.1.0"},
        "environment": {"kind": "record", "fields": [{"name": "width", "value": literal(64)}]},
        "retain": [{"name": "grid", "value": {"kind": "construct", "operation": "layout.regular-grid", "input": literal({})}}],
        "frame": [{
            "kind": "for", "items": {"kind": "values", "instance": {"kind": "ref", "name": "grid"}},
            "as": "point", "indexAs": "i", "body": [{
                "kind": "when", "condition": {"kind": "math", "op": "lt", "args": [{"kind": "ref", "name": "i"}, literal(3)]},
                "body": [{"kind": "emit", "value": {"kind": "query", "instance": {"kind": "ref", "name": "grid"}, "port": "point", "input": {"kind": "ref", "name": "point"}}}]
            }]
        }]
    }


class RecipeDraftSchemaTests(unittest.TestCase):
    def assert_valid(self, document):
        self.assertEqual(list(VALIDATOR.iter_errors(document)), [])

    def assert_invalid(self, document):
        self.assertTrue(list(VALIDATOR.iter_errors(document)))

    def test_nested_retain_construct_query_for_and_when_are_grammar_valid(self):
        self.assert_valid(grammar_example())

    def test_complete_composition_drafts_remain_grammar_valid(self):
        for name in ("field-marks", "path-marks"):
            with self.subTest(composition=name):
                document = json.loads((ROOT / "design/recipes/examples" / (name + ".draft.json")).read_text())
                self.assert_valid(document)

    def test_math_requires_exact_documented_arities(self):
        document = grammar_example()
        document["environment"] = {"kind": "math", "op": "add", "args": [literal(1)]}
        self.assert_invalid(document)
        document["environment"] = {"kind": "math", "op": "length", "args": [literal([]), literal([])]}
        self.assert_invalid(document)

    def test_unknown_kind_and_extra_keys_are_rejected(self):
        document = grammar_example()
        document["environment"] = {"kind": "hostCall", "name": "nope"}
        self.assert_invalid(document)
        document = grammar_example()
        document["retain"][0]["extra"] = True
        self.assert_invalid(document)

    def test_expression_children_cannot_be_plain_json_values(self):
        document = grammar_example()
        document["environment"] = {"kind": "array", "items": [7]}
        self.assert_invalid(document)
        document = grammar_example()
        document["frame"][0]["body"][0]["body"][0]["value"] = {"kind": "record", "fields": [{"name": "x", "value": 1}]}
        self.assert_invalid(document)
