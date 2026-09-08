#!/usr/bin/env python3
"""Statically validate a bounded Procedurals recipe draft; this does not execute it."""

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
MAX_BYTES = 2 * 1024 * 1024
MAX_DEPTH = 64
MAX_VALUES = 20_000
PENDING_CHECKS = [
    "dynamic values and types, including instance-port matching",
    "target capabilities",
    "operation input validation",
    "execution budgets",
    "drawing commands and native output",
]


class RecipeError(Exception):
    def __init__(self, code, path, message):
        super().__init__(message)
        self.code = code
        self.path = path
        self.message = message


def pointer(parts):
    return "".join("/" + str(part).replace("~", "~0").replace("/", "~1") for part in parts)


def load_json(path):
    with path.open("rb") as handle:
        raw = handle.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise RecipeError("INPUT_TOO_LARGE", "", "recipe exceeds 2 MiB")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as error:
        raise RecipeError("INVALID_JSON", "", "recipe must be UTF-8") from error

    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise RecipeError("DUPLICATE_KEY", "", "duplicate JSON key: " + key)
            result[key] = value
        return result

    def constant(value):
        raise RecipeError("NONFINITE_NUMBER", "", "nonfinite JSON number: " + value)

    try:
        document = json.loads(text, object_pairs_hook=pairs, parse_int=float,
                              parse_float=float, parse_constant=constant)
    except RecipeError:
        raise
    except (json.JSONDecodeError, RecursionError) as error:
        raise RecipeError("INVALID_JSON", "", "malformed JSON") from error
    check_json_limits(document)
    return document


def check_json_limits(value, path=(), depth=0, count=None):
    if count is None:
        count = [0]
    if depth > MAX_DEPTH:
        raise RecipeError("AST_DEPTH_LIMIT", pointer(path), "JSON depth exceeds 64")
    count[0] += 1
    if count[0] > MAX_VALUES:
        raise RecipeError("AST_SIZE_LIMIT", pointer(path), "JSON value count exceeds 20000")
    if isinstance(value, float) and not math.isfinite(value):
        raise RecipeError("NONFINITE_NUMBER", pointer(path), "JSON numbers must be finite binary64")
    if isinstance(value, dict):
        for key, child in value.items():
            check_json_limits(child, path + (key,), depth + 1, count)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            check_json_limits(child, path + (index,), depth + 1, count)


def read_json(path):
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise RecipeError("BINDING_INVALID", "", "cannot read draft binding metadata") from error


def resolve_pointer(document, value):
    if not value.startswith("/"):
        raise KeyError(value)
    current = document
    for token in value[1:].split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        current = current[int(token)] if isinstance(current, list) else current[token]
    return current


def load_bindings(root):
    metadata = read_json(root / "design/recipes/execution-bindings.json")
    bindings = {}
    for record in metadata.get("operations", []):
        operation_id = record.get("id")
        if operation_id in bindings:
            raise RecipeError("BINDING_INVALID", "", "duplicate execution binding ID")
        contract_path = root / record.get("contract", "")
        if not contract_path.is_file():
            raise RecipeError("BINDING_INVALID", "", "binding contract is missing")
        actual_sha = hashlib.sha256(contract_path.read_bytes()).hexdigest()
        if actual_sha != record.get("contract_sha256"):
            raise RecipeError("BINDING_STALE", "", "binding contract hash changed: " + operation_id)
        contract = read_json(contract_path)
        if contract.get("id") != operation_id or contract.get("version") != record.get("version"):
            raise RecipeError("BINDING_STALE", "", "binding contract identity changed: " + operation_id)
        try:
            resolve_pointer(contract, record["construct_input"])
            resolve_pointer(contract, record["values_output"])
            for port in record.get("ports", {}).values():
                resolve_pointer(contract, port["input_schema"])
                resolve_pointer(contract, port["output_schema"])
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise RecipeError("BINDING_STALE", "", "binding schema pointer changed: " + operation_id) from error
        bindings[operation_id] = record
    if len(bindings) != 4:
        raise RecipeError("BINDING_INVALID", "", "expected four draft operation bindings")
    return bindings


def drawing_declarations(root):
    declarations = {}
    for path in (root / "catalog/drawing").glob("*.json"):
        document = read_json(path)
        declarations[document.get("id")] = document.get("version")
    return declarations


def schema_validate(document, root):
    schema = read_json(root / "design/recipes/recipe.schema.json")
    error = next(Draft202012Validator(schema).iter_errors(document), None)
    if error is not None:
        raise RecipeError("SCHEMA_INVALID", pointer(error.absolute_path), error.message)


def validate_declarations(document, bindings, drawings):
    declared = set()
    for index, record in enumerate(document["operations"]):
        operation_id = record["id"]
        if operation_id in declared:
            raise RecipeError("DUPLICATE_OPERATION", pointer(("operations", index, "id")), "operation IDs must be unique")
        declared.add(operation_id)
        binding = bindings.get(operation_id)
        if binding is None:
            raise RecipeError("UNKNOWN_OPERATION", pointer(("operations", index, "id")), "operation has no draft execution binding")
        if record["version"] != binding["version"]:
            raise RecipeError("OPERATION_VERSION", pointer(("operations", index, "version")), "operation version differs from draft binding")
    drawing = document["drawing"]
    if drawings.get(drawing["id"]) is None:
        raise RecipeError("UNKNOWN_DRAWING", "/drawing/id", "drawing declaration is unknown")
    if drawing["version"] != drawings[drawing["id"]]:
        raise RecipeError("DRAWING_VERSION", "/drawing/version", "drawing version differs from catalog")
    return declared


def require_new(name, scope, path):
    if name in scope:
        raise RecipeError("SHADOWED_NAME", path, "binding name is already visible: " + name)


def walk_expression(expression, scope, path, declared, ports):
    kind = expression["kind"]
    if kind == "ref":
        if expression["name"] not in scope:
            raise RecipeError("UNBOUND_NAME", pointer(path + ("name",)), "name is not visible: " + expression["name"])
    elif kind == "array":
        for index, child in enumerate(expression["items"]):
            walk_expression(child, scope, path + ("items", index), declared, ports)
    elif kind == "record":
        fields = set()
        for index, field in enumerate(expression["fields"]):
            if field["name"] in fields:
                raise RecipeError("DUPLICATE_FIELD", pointer(path + ("fields", index, "name")), "record field is duplicated")
            fields.add(field["name"])
            walk_expression(field["value"], scope, path + ("fields", index, "value"), declared, ports)
    elif kind in ("get", "values"):
        walk_expression(expression["value"] if kind == "get" else expression["instance"], scope,
                        path + (("value",) if kind == "get" else ("instance",)), declared, ports)
    elif kind == "index":
        walk_expression(expression["value"], scope, path + ("value",), declared, ports)
        walk_expression(expression["index"], scope, path + ("index",), declared, ports)
    elif kind == "math":
        for index, child in enumerate(expression["args"]):
            walk_expression(child, scope, path + ("args", index), declared, ports)
    elif kind == "if":
        for key in ("condition", "then", "else"):
            walk_expression(expression[key], scope, path + (key,), declared, ports)
    elif kind == "range":
        for key in ("start", "stop", "step"):
            walk_expression(expression[key], scope, path + (key,), declared, ports)
    elif kind == "map":
        walk_expression(expression["items"], scope, path + ("items",), declared, ports)
        if expression["as"] == expression["indexAs"]:
            raise RecipeError("DUPLICATE_LOCAL", pointer(path + ("indexAs",)), "map locals must differ")
        require_new(expression["as"], scope, pointer(path + ("as",)))
        require_new(expression["indexAs"], scope, pointer(path + ("indexAs",)))
        walk_expression(expression["value"], scope | {expression["as"], expression["indexAs"]},
                        path + ("value",), declared, ports)
    elif kind == "construct":
        if expression["operation"] not in declared:
            raise RecipeError("UNDECLARED_CONSTRUCT", pointer(path + ("operation",)), "construct operation is not declared")
        walk_expression(expression["input"], scope, path + ("input",), declared, ports)
    elif kind == "query":
        if expression["port"] not in ports:
            raise RecipeError("UNKNOWN_PORT", pointer(path + ("port",)), "query port has no draft binding")
        walk_expression(expression["instance"], scope, path + ("instance",), declared, ports)
        walk_expression(expression["input"], scope, path + ("input",), declared, ports)


def walk_statements(statements, scope, path, declared, ports):
    local_scope = set(scope)
    for index, statement in enumerate(statements):
        statement_path = path + (index,)
        kind = statement["kind"]
        if kind == "bind":
            walk_expression(statement["value"], local_scope, statement_path + ("value",), declared, ports)
            require_new(statement["name"], local_scope, pointer(statement_path + ("name",)))
            local_scope.add(statement["name"])
        elif kind == "emit":
            walk_expression(statement["value"], local_scope, statement_path + ("value",), declared, ports)
        elif kind == "for":
            walk_expression(statement["items"], local_scope, statement_path + ("items",), declared, ports)
            if statement["as"] == statement["indexAs"]:
                raise RecipeError("DUPLICATE_LOCAL", pointer(statement_path + ("indexAs",)), "for locals must differ")
            require_new(statement["as"], local_scope, pointer(statement_path + ("as",)))
            require_new(statement["indexAs"], local_scope, pointer(statement_path + ("indexAs",)))
            walk_statements(statement["body"], local_scope | {statement["as"], statement["indexAs"]},
                            statement_path + ("body",), declared, ports)
        elif kind == "when":
            walk_expression(statement["condition"], local_scope, statement_path + ("condition",), declared, ports)
            walk_statements(statement["body"], local_scope, statement_path + ("body",), declared, ports)


def lexical_validate(document, declared, bindings):
    ports = {port for operation_id in declared for port in bindings[operation_id].get("ports", {})}
    scope = {"params"}
    for index, binding in enumerate(document["retain"]):
        walk_expression(binding["value"], scope, ("retain", index, "value"), declared, ports)
        require_new(binding["name"], scope, pointer(("retain", index, "name")))
        scope.add(binding["name"])
    walk_expression(document["environment"], scope, ("environment",), declared, ports)
    walk_statements(document["frame"], scope, ("frame",), declared, ports)


def validate(document, root=ROOT):
    check_json_limits(document)
    schema_validate(document, root)
    bindings = load_bindings(root)
    declared = validate_declarations(document, bindings, drawing_declarations(root))
    lexical_validate(document, declared, bindings)
    return {"status": "static-valid-draft", "pending_checks": PENDING_CHECKS}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recipe", type=Path)
    args = parser.parse_args(argv)
    try:
        result = validate(load_json(args.recipe))
    except (OSError, RecipeError) as error:
        if isinstance(error, RecipeError):
            detail = {"code": error.code, "path": error.path, "message": error.message}
        else:
            detail = {"code": "INPUT_ERROR", "path": "", "message": "cannot read recipe"}
        print(json.dumps({"status": "static-invalid-draft", "error": detail}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
