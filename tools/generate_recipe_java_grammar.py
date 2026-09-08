#!/usr/bin/env python3
"""Generate the Java prototype's catalog-owned recipe grammar surface."""
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
from tools.generate_recipe_java_schemas import load as load_binding_contracts

ALLOWED = {"$schema", "$id", "title", "$defs", "$ref", "type",
           "additionalProperties", "required", "properties", "items",
           "oneOf", "allOf", "const", "enum", "pattern", "minLength",
           "minItems", "maxItems"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pointer(document, reference):
    if not isinstance(reference, str) or not reference.startswith("#/"):
        raise ValueError(f"only local schema refs are supported: {reference!r}")
    value = document
    for token in reference[2:].split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        if not isinstance(value, dict) or token not in value:
            raise ValueError(f"unresolved local schema ref: {reference}")
        value = value[token]
    return value


def validate_subset(schema, root_schema, path="/"):
    if not isinstance(schema, dict):
        raise ValueError(f"schema at {path} is not an object")
    unknown = set(schema) - ALLOWED
    if unknown:
        raise ValueError(f"unknown schema keyword(s) at {path}: {sorted(unknown)}")
    if "type" in schema and (not isinstance(schema["type"], str) or schema["type"] not in {"object", "array", "string", "boolean", "null", "number", "integer"}):
        raise ValueError(f"unsupported schema type at {path}")
    if "$ref" in schema:
        pointer(root_schema, schema["$ref"])
    if "properties" in schema:
        if not isinstance(schema["properties"], dict):
            raise ValueError(f"properties must be an object at {path}")
        for name, child in schema["properties"].items():
            validate_subset(child, root_schema, f"{path}properties/{name}/")
    if "$defs" in schema:
        if not isinstance(schema["$defs"], dict):
            raise ValueError(f"$defs must be an object at {path}")
        for name, child in schema["$defs"].items():
            validate_subset(child, root_schema, f"{path}$defs/{name}/")
    for key in ("oneOf", "allOf"):
        if key in schema:
            if not isinstance(schema[key], list):
                raise ValueError(f"{key} must be an array at {path}")
            for index, child in enumerate(schema[key]):
                validate_subset(child, root_schema, f"{path}{key}/{index}/")
    if "items" in schema and schema["items"] is not False:
        validate_subset(schema["items"], root_schema, f"{path}items/")
    if "additionalProperties" in schema and schema["additionalProperties"] is not False:
        validate_subset(schema["additionalProperties"], root_schema, f"{path}additionalProperties/")


def load(root: Path):
    schema_path = root / "catalog/recipes/recipe.schema.json"
    bindings_path = root / "catalog/recipes/execution-bindings.json"
    schema = json.loads(schema_path.read_text())
    try:
        Draft202012Validator.check_schema(schema)
    except Exception as exc:
        raise ValueError(f"invalid recipe schema: {exc}") from exc
    validate_subset(schema, schema)
    # Reuse the catalog contract admission used by RecipeSchemas.  This keeps
    # the grammar metadata bound to the same hashes, identities, and pointers.
    _, contract_metadata = load_binding_contracts(root)
    contract_by_id = {operation_id: (version, contract, contract_hash)
                      for operation_id, version, contract, contract_hash in contract_metadata}
    bindings = json.loads(bindings_path.read_text())
    operations = bindings.get("operations")
    if not isinstance(operations, list):
        raise ValueError("execution bindings operations must be an array")
    declarations = {}
    ports = {}
    for binding in operations:
        operation_id = binding.get("id")
        version = binding.get("version")
        if not isinstance(operation_id, str) or not isinstance(version, str):
            raise ValueError("binding id/version must be strings")
        if operation_id in declarations:
            raise ValueError(f"duplicate binding id: {operation_id}")
        expected = contract_by_id.get(operation_id)
        if expected is None or expected[0] != version:
            raise ValueError(f"binding identity drift for {operation_id}")
        declarations[operation_id] = version
        ports[operation_id] = sorted(binding.get("ports", {}).keys())
    return schema, declarations, ports, digest(schema_path), digest(bindings_path)


def generate(root: Path) -> str:
    schema, declarations, ports, schema_hash, bindings_hash = load(root)
    lines = [
        "package org.procedurals.recipe;", "", "import java.util.*;", "",
        "/** Generated from catalog/recipes/recipe.schema.json and execution-bindings.json. */",
        "final class RecipeGrammar {",
        "    static final String SCHEMA_SHA256 = \"" + schema_hash + "\";",
        "    static final String BINDINGS_SHA256 = \"" + bindings_hash + "\";",
        "    private static final Object SCHEMA = freeze(" + java_value(schema) + ");",
        "    private static final Map<String,String> DECLARATIONS = freezeMap(map(",
    ]
    declaration_args = []
    for operation_id, version in declarations.items():
        declaration_args.extend((json.dumps(operation_id), json.dumps(version)))
    lines[-1] += ",".join(declaration_args) + "));"
    lines += ["    private static final Map<String,Set<String>> PORTS = freezePorts(map("]
    port_args = []
    for operation_id, names in ports.items():
        port_args.extend((json.dumps(operation_id), "set(" + ",".join(json.dumps(name) for name in names) + ")"))
    lines[-1] += ",".join(port_args) + "));"
    lines += [
        "    private RecipeGrammar() { }", "",
        "    static Object schema() { return SCHEMA; }",
        "    static Map<String,String> declarations() { return DECLARATIONS; }",
        "    static Set<String> ports(String id) { return PORTS.get(id); }", "",
        "    private static Map<String,Object> map(Object... values) {",
        "        Map<String,Object> result = new LinkedHashMap<String,Object>();",
        "        for (int i = 0; i < values.length; i += 2) result.put((String)values[i], values[i + 1]);",
        "        return result;", "    }",
        "    private static List<Object> list(Object... values) {",
        "        return new ArrayList<Object>(Arrays.asList(values));",
        "    }",
        "    private static Set<String> set(Object... values) {",
        "        Set<String> result = new LinkedHashSet<String>();",
        "        for (Object value : values) result.add((String)value);",
        "        return result;", "    }",
        "    private static Map<String,String> freezeMap(Map<String,Object> value) {",
        "        Map<String,String> result = new LinkedHashMap<String,String>();",
        "        for (Map.Entry<String,Object> entry : value.entrySet()) result.put(entry.getKey(), (String)entry.getValue());",
        "        return Collections.unmodifiableMap(result);", "    }",
        "    private static Map<String,Set<String>> freezePorts(Map<String,Object> value) {",
        "        Map<String,Set<String>> result = new LinkedHashMap<String,Set<String>>();",
        "        for (Map.Entry<String,Object> entry : value.entrySet()) result.put(entry.getKey(), Collections.unmodifiableSet((Set<String>)entry.getValue()));",
        "        return Collections.unmodifiableMap(result);", "    }",
        "    private static Object freeze(Object value) {",
        "        if (value instanceof Map) { Map<String,Object> copy = new LinkedHashMap<String,Object>();",
        "            for (Map.Entry<?,?> entry : ((Map<?,?>)value).entrySet()) copy.put((String)entry.getKey(), freeze(entry.getValue()));",
        "            return Collections.unmodifiableMap(copy); }",
        "        if (value instanceof List) { List<Object> copy = new ArrayList<Object>();",
        "            for (Object item : (List<?>)value) copy.add(freeze(item));",
        "            return Collections.unmodifiableList(copy); }",
        "        return value;", "    }", "}", "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path, default=ROOT / "packages/java-recipe-prototype/src/main/java/org/procedurals/recipe/RecipeGrammar.java")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = generate(args.root.resolve())
    if args.check:
        if not args.output.is_file() or args.output.read_text() != content:
            raise SystemExit("generated RecipeGrammar.java is stale")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content)


if __name__ == "__main__":
    main()
