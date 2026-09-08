#!/usr/bin/env python3
"""Generate the Java recipe prototype's catalog-bound schema data."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.run_grid_conformance import java_value

ALLOWED = {
    "$schema", "description", "title", "type", "properties", "required",
    "additionalProperties", "prefixItems", "items", "minItems", "maxItems",
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
}
ANNOTATIONS = {"$schema", "description", "title"}
SCHEMA_KEYS = ALLOWED - ANNOTATIONS


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_schema(value, path=""):
    if not isinstance(value, dict):
        raise ValueError(f"schema at {path or '/'} is not an object")
    try:
        Draft202012Validator.check_schema(value)
    except Exception as exc:
        raise ValueError(f"invalid JSON Schema at {path or '/'}: {exc}") from exc
    if "type" not in value:
        raise ValueError(f"schema type is required at {path or '/'}")
    unknown = set(value) - ALLOWED
    if unknown:
        raise ValueError(f"unknown schema keyword(s) at {path or '/'}: {sorted(unknown)}")
    if "type" in value and value["type"] not in {"object", "array", "number", "integer"}:
        raise ValueError(f"unsupported schema type at {path or '/'}")
    if value.get("additionalProperties") is not False and "additionalProperties" in value:
        raise ValueError(f"additionalProperties must be false at {path or '/'}")
    for key in ("properties",):
        if key in value:
            if not isinstance(value[key], dict):
                raise ValueError(f"{key} must be an object at {path or '/'}")
            for name, child in value[key].items():
                validate_schema(child, f"{path}/properties/{name}")
    if "prefixItems" in value:
        if not isinstance(value["prefixItems"], list):
            raise ValueError(f"prefixItems must be an array at {path or '/'}")
        for i, child in enumerate(value["prefixItems"]):
            validate_schema(child, f"{path}/prefixItems/{i}")
    if "items" in value and value["items"] is not False:
        validate_schema(value["items"], f"{path}/items")
    for key in ("required",):
        if key in value and not isinstance(value[key], list) or key in value and not all(isinstance(x, str) for x in value[key]):
            raise ValueError(f"{key} must be a string array at {path or '/'}")


def load(root: Path):
    bindings_path = root / "design/recipes/execution-bindings.json"
    bindings = json.loads(bindings_path.read_text())
    schemas = {}
    metadata = []
    for binding in bindings["operations"]:
        if any(previous[0] == binding["id"] for previous in metadata):
            raise ValueError(f"duplicate binding id: {binding['id']}")
        contract_path = root / binding["contract"]
        actual_hash = digest(contract_path)
        if actual_hash != binding["contract_sha256"]:
            raise ValueError(f"contract hash drift for {binding['id']}: {actual_hash}")
        contract = json.loads(contract_path.read_text())
        if contract.get("id") != binding["id"] or contract.get("version") != binding["version"]:
            raise ValueError(f"binding identity drift for {binding['id']}")
        for pointer in [binding["construct_input"], binding["values_output"]]:
            schema = contract
            for part in pointer.strip("/").split("/"):
                schema = schema[part]
            validate_schema(schema, f"{binding['contract']}{pointer}")
        schema = contract
        for part in binding["construct_input"].strip("/").split("/"):
            schema = schema[part]
        schemas[(binding["id"], None)] = schema
        for port, port_binding in binding.get("ports", {}).items():
            pointer = port_binding["input_schema"]
            schema = contract
            for part in pointer.strip("/").split("/"):
                schema = schema[part]
            validate_schema(schema, f"{binding['contract']}{pointer}")
            schemas[(binding["id"], port)] = schema
        metadata.append((binding["id"], binding["version"], binding["contract"], actual_hash))
    return schemas, metadata


def generate(root: Path) -> str:
    schemas, metadata = load(root)
    lines = [
        "package org.procedurals.recipe;",
        "",
        "import java.util.*;",
        "",
        "/** Generated from design/recipes/execution-bindings.json and catalog contracts. */",
        "final class RecipeSchemas {",
        "    private RecipeSchemas() {",
        "    }",
        "",
        "    private static Map<String,Object> map(Object... values) {",
        "        Map<String,Object> result = new LinkedHashMap<String,Object>();",
        "        for (int i = 0; i < values.length; i += 2) result.put((String)values[i], values[i + 1]);",
        "        return result;",
        "    }",
        "    private static List<Object> list(Object... values) {",
        "        return new ArrayList<Object>(Arrays.asList(values));",
        "    }",
        "    private static Object freeze(Object value) {",
        "        if (value instanceof Map) {",
        "            Map<String,Object> copy = new LinkedHashMap<String,Object>();",
        "            for (Map.Entry<?,?> entry : ((Map<?,?>)value).entrySet()) copy.put((String)entry.getKey(), freeze(entry.getValue()));",
        "            return Collections.unmodifiableMap(copy);",
        "        }",
        "        if (value instanceof List) {",
        "            List<Object> copy = new ArrayList<Object>();",
        "            for (Object item : (List<?>)value) copy.add(freeze(item));",
        "            return Collections.unmodifiableList(copy);",
        "        }",
        "        return value;",
        "    }",
        "",
    ]
    for index, (op_id, _, contract, contract_hash) in enumerate(metadata):
        lines += [f"    // source: {contract} id={op_id} version=0.1.0 sha256={contract_hash}",
                   f"    private static final Object CONSTRUCT_{index} = freeze({java_value(schemas[(op_id, None)])});"]
    for index, ((op_id, port), schema) in enumerate((item for item in schemas.items() if item[0][1] is not None)):
        lines += [f"    private static final Object QUERY_{index} = freeze({java_value(schema)});"]
    lines += [
        "",
        "",
        "    static Object construct(String id) {",
        "        if (id == null) return null;",
        "        switch (id) {",
    ]
    for index, (op_id, _, _, _) in enumerate(metadata):
        lines += [f'            case {json.dumps(op_id)}:', f'                return CONSTRUCT_{index};']
    lines += [
        "            default:",
        "                return null;",
        "        }",
        "    }",
        "",
        "    static Object query(String id, String port) {",
        "        if (id == null || port == null) return null;",
        "        if (" + " || ".join(f'{json.dumps(op_id)}.equals(id)' for op_id, _, _, _ in metadata) + ") {",
        "            String key = id + \"\\u0000\" + port;",
        "            switch (key) {",
    ]
    query_index = 0
    for (op_id, port), schema in schemas.items():
        if port is not None:
            lines += [f'                case {json.dumps(op_id + chr(0) + port)}:', f'                    return QUERY_{query_index};']
            query_index += 1
    lines += [
        "                default:",
        "                    return null;",
        "            }",
        "        }",
        "        return null;",
        "    }",
        "}",
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path, default=ROOT / "packages/java-recipe-prototype/src/main/java/org/procedurals/recipe/RecipeSchemas.java")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = generate(args.root.resolve())
    if args.check:
        if not args.output.is_file() or args.output.read_text() != content:
            raise SystemExit("generated RecipeSchemas.java is stale")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content)


if __name__ == "__main__":
    main()
