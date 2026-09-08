"""Validation for current implementation attestations outside immutable contracts."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

KIND = "operation-implementation-attestation"
SCHEMA_VERSION = 1
DIMENSIONS = ("core", "native", "technique")
UNVALIDATED = "unvalidated"
# Historical acceptance records use Sol; the current root-directed sprint permits root.
APPROVED_REVIEWERS = frozenset(("Sol", "root"))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def strict_json(path: Path) -> Any:
    """Load JSON with duplicate keys and non-finite constants rejected."""
    def object_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        value: dict[str, Any] = {}
        for key, item in pairs:
            if key in value:
                raise ValueError(f"duplicate JSON object key: {key}")
            value[key] = item
        return value

    def constant(value: str) -> None:
        raise ValueError(f"non-finite JSON constant: {value}")

    def finite_float(value: str) -> float:
        result = float(value)
        if not math.isfinite(result):
            raise ValueError(f"non-finite JSON number: {value}")
        return result

    return json.loads(path.read_text(), object_pairs_hook=object_pairs,
                      parse_constant=constant, parse_float=finite_float)


def json_equal(left: Any, right: Any) -> bool:
    """JSON equality with numbers interoperable but booleans distinct from numbers."""
    if type(left) in (int, float) and type(right) in (int, float):
        return left == right
    if type(left) is not type(right):
        return False
    if isinstance(left, list):
        return len(left) == len(right) and all(json_equal(one, two) for one, two in zip(left, right))
    if isinstance(left, dict):
        return set(left) == set(right) and all(json_equal(left[key], right[key]) for key in left)
    return left == right


def safe_file(root: Path, value: object) -> Path | None:
    if not isinstance(value, str) or not value or value.startswith("/"):
        return None
    try:
        candidate = (root / value).resolve()
        candidate.relative_to(root.resolve())
    except (OSError, ValueError):
        return None
    return candidate if candidate.is_file() else None


def nonempty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def resolve_pointer(document: Any, pointer: object) -> tuple[bool, Any]:
    """Resolve an RFC 6901 pointer without supporting the mutation-only '-' token."""
    if not isinstance(pointer, str) or (pointer and not pointer.startswith("/")):
        return False, None
    current = document
    if not pointer:
        return True, current
    for raw in pointer[1:].split("/"):
        token = ""
        index = 0
        while index < len(raw):
            character = raw[index]
            if character != "~":
                token += character
                index += 1
                continue
            if index + 1 >= len(raw) or raw[index + 1] not in "01":
                return False, None
            token += "/" if raw[index + 1] == "1" else "~"
            index += 2
        if isinstance(current, dict):
            if token not in current:
                return False, None
            current = current[token]
        elif isinstance(current, list):
            if not token.isascii() or not token.isdecimal() or (len(token) > 1 and token.startswith("0")):
                return False, None
            position = int(token)
            if position >= len(current):
                return False, None
            current = current[position]
        else:
            return False, None
    return True, current


def _map_errors(root: Path, value: object, label: str) -> list[str]:
    if not isinstance(value, dict) or not value:
        return [f"{label}: requires a nonempty sha256 map"]
    errors: list[str] = []
    for relative, expected in value.items():
        path = safe_file(root, relative)
        if path is None:
            errors.append(f"{label}: unsafe or missing path {relative!r}")
        elif not isinstance(expected, str) or digest(path) != expected:
            errors.append(f"{label}: stale hash for {relative}")
    return errors


def _review_errors(root: Path, value: object, label: str) -> tuple[list[str], dict[str, Any] | None]:
    if not isinstance(value, dict) or set(value) != {"path", "sha256"}:
        return [f"{label}: acceptance_review must contain exactly path and sha256"], None
    path = safe_file(root, value.get("path"))
    if path is None:
        return [f"{label}: acceptance review path is unsafe or missing"], None
    if not isinstance(value.get("sha256"), str) or digest(path) != value["sha256"]:
        return [f"{label}: acceptance review hash is stale"], None
    try:
        review = strict_json(path)
    except (OSError, ValueError, json.JSONDecodeError):
        return [f"{label}: acceptance review is not JSON"], None
    if (not isinstance(review, dict) or review.get("status") != "accepted"
            or review.get("owner") != "root" or review.get("reviewer") not in APPROVED_REVIEWERS):
        return [f"{label}: acceptance review lacks accepted root review approved by Sol or root"], None
    errors = _map_errors(root, review.get("implementation_sha256"), f"{label}: acceptance review implementation")
    errors.extend(_map_errors(root, review.get("evidence_sha256"), f"{label}: acceptance review evidence"))
    return errors, review


def _predicates_errors(root: Path, evidence: dict[str, str], value: object, label: str,
                       *, required: bool) -> list[str]:
    if not isinstance(value, list) or (required and not value):
        return [f"{label}: evidence_predicates must be {'nonempty ' if required else ''}a list"]
    errors: list[str] = []
    for ordinal, predicate in enumerate(value):
        item_label = f"{label}: evidence_predicates[{ordinal}]"
        if not isinstance(predicate, dict) or set(predicate) != {"path", "pointer", "equals"}:
            errors.append(f"{item_label}: requires exactly path, pointer and equals")
            continue
        relative = predicate["path"]
        if not isinstance(relative, str):
            errors.append(f"{item_label}: path must be a string")
            continue
        if relative not in evidence:
            errors.append(f"{item_label}: path is not bound by evidence_sha256")
            continue
        path = safe_file(root, relative)
        if path is None:
            errors.append(f"{item_label}: evidence path is unsafe or missing")
            continue
        try:
            document = strict_json(path)
        except (OSError, ValueError, json.JSONDecodeError):
            errors.append(f"{item_label}: evidence is not JSON")
            continue
        found, actual = resolve_pointer(document, predicate["pointer"])
        if not found:
            errors.append(f"{item_label}: JSON pointer does not resolve")
        elif not json_equal(actual, predicate["equals"]):
            errors.append(f"{item_label}: JSON predicate differs")
    return errors


def _dimension_errors(root: Path, value: object, label: str) -> list[str]:
    if not isinstance(value, dict) or "status" not in value or not nonempty_string(value.get("status")):
        return [f"{label}: requires a nonempty status"]
    if value["status"] == UNVALIDATED:
        return [] if set(value) == {"status"} else [f"{label}: unvalidated must contain only status"]
    dimension = label.rsplit("/", 1)[-1]
    expected_status = "conformant" if dimension == "core" else "validated-scoped"
    if value["status"] != expected_status:
        return [f"{label}: unknown status for {dimension}; expected {expected_status} or unvalidated"]
    required = {"status", "implementation_sha256", "evidence_sha256", "evidence_predicates", "acceptance_review", "runtime_profile"}
    if set(value) != required:
        return [f"{label}: claimed status fields differ from required schema"]
    errors = _map_errors(root, value["implementation_sha256"], f"{label}: implementation")
    errors.extend(_map_errors(root, value["evidence_sha256"], f"{label}: evidence"))
    review_errors, _ = _review_errors(root, value["acceptance_review"], label)
    errors.extend(review_errors)
    runtime = value["runtime_profile"]
    if not isinstance(runtime, dict) or set(runtime) != {"name", "scope"} or not all(nonempty_string(runtime.get(key)) for key in ("name", "scope")):
        errors.append(f"{label}: runtime_profile requires nonempty name and scope")
    evidence = value["evidence_sha256"] if isinstance(value["evidence_sha256"], dict) else {}
    errors.extend(_predicates_errors(root, evidence, value["evidence_predicates"], label,
                                     required=True))
    return errors


def _attestation_errors(root: Path, operation: dict[str, Any], catalog_path: Path,
                        attestation_path: Path, selected_target: str | None = None
                        ) -> tuple[list[str], dict[str, Any] | None]:
    label = str(attestation_path.relative_to(root)).replace("\\", "/")
    try:
        value = strict_json(attestation_path)
    except (OSError, ValueError, json.JSONDecodeError):
        return [f"{label}: invalid JSON"], None
    required = {"kind", "schema_version", "status", "owner", "reviewer", "operation", "targets"}
    if not isinstance(value, dict) or set(value) != required:
        return [f"{label}: top-level schema differs"], None
    if (type(value["schema_version"]) is not int or value["kind"] != KIND
            or value["schema_version"] != SCHEMA_VERSION or value["status"] != "accepted"
            or value["owner"] != "root" or value["reviewer"] not in APPROVED_REVIEWERS):
        return [f"{label}: requires accepted root attestation review approved by Sol or root"], None
    operation_binding = value["operation"]
    expected_operation = {"id": operation["id"], "version": operation["version"],
                          "catalog_path": str(catalog_path.relative_to(root)).replace("\\", "/"),
                          "catalog_sha256": digest(catalog_path)}
    if operation_binding != expected_operation:
        return [f"{label}: operation contract binding differs"], None
    targets = value["targets"]
    expected_targets = set(operation.get("targets", {}))
    if not isinstance(targets, dict) or set(targets) != expected_targets:
        return [f"{label}: target set differs from contract targets"], None
    if selected_target is not None and selected_target not in expected_targets:
        return [f"{label}: unknown contract target {selected_target!r}"], None
    errors: list[str] = []
    targets_to_check = (selected_target,) if selected_target is not None else tuple(targets)
    for target in targets_to_check:
        dimensions = targets[target]
        target_label = f"{label}/{target}"
        if not isinstance(dimensions, dict) or set(dimensions) != set(DIMENSIONS):
            errors.append(f"{target_label}: requires exactly core, native and technique blocks")
            continue
        for dimension in DIMENSIONS:
            errors.extend(_dimension_errors(root, dimensions[dimension], f"{target_label}/{dimension}"))
    return errors, value


def validate_target_attestation(root: Path, operation: dict[str, Any], target: str
                                ) -> tuple[list[str], dict[str, Any] | None]:
    """Validate one operation target without treating other targets as scoped-valid.

    The attestation envelope and contract binding are always checked.  Only the selected
    target's three dimensions are checked.  A successful result is deliberately a small
    scoped record: it identifies the target, repeats the validated operation binding, and
    contains only that target's dimensions.
    """
    root = root.resolve()
    if not isinstance(target, str) or not target:
        return ["target: requires a nonempty target name"], None
    filename = operation.get("_file")
    if (not isinstance(filename, str) or not filename or Path(filename).name != filename
            or not filename.endswith(".json")):
        return ["operation: missing catalog filename"], None
    catalog_directory = root / "catalog/operations"
    validation_directory = root / "catalog/validation"
    try:
        catalog_directory.resolve().relative_to(root.resolve())
        validation_directory.resolve().relative_to(root.resolve())
    except (OSError, ValueError):
        return ["catalog: operation or validation directory resolves outside repository"], None
    catalog_path = (catalog_directory / filename).resolve()
    attestation_path = (validation_directory / filename).resolve()
    try:
        catalog_path.relative_to(catalog_directory.resolve())
        attestation_path.relative_to(validation_directory.resolve())
    except (OSError, ValueError):
        return [f"catalog/validation/{filename}: path resolves outside catalog directory"], None
    if not catalog_path.is_file():
        return [f"catalog/operations/{filename}: missing operation contract"], None
    if not attestation_path.is_file():
        return [f"catalog/validation/{filename}: missing target attestation for {target}"], None
    errors, record = _attestation_errors(root, operation, catalog_path, attestation_path, target)
    if errors or record is None:
        return errors, None
    scoped = {
        "target": target,
        "operation": record["operation"],
        "dimensions": record["targets"][target],
    }
    return [], scoped


def load_attestations(root: Path, operations: list[dict[str, Any]]) -> tuple[list[str], dict[str, dict[str, Any]]]:
    """Return validation errors and accepted records keyed by catalog filename.

    A missing deterministic record intentionally means ``not attested``.  Any other
    file under catalog/validation is a governance error rather than hidden metadata.
    """
    directory = root / "catalog/validation"
    if not directory.exists():
        return [], {}
    try:
        directory.resolve().relative_to(root.resolve())
    except (OSError, ValueError):
        return ["catalog/validation: directory resolves outside repository"], {}
    known = {operation["_file"] for operation in operations}
    paths = [path for path in directory.rglob("*") if path.is_file()]
    errors: list[str] = []
    values: dict[str, dict[str, Any]] = {}
    by_file = {operation["_file"]: operation for operation in operations}
    for path in paths:
        relative = str(path.relative_to(directory)).replace("\\", "/")
        try:
            path.resolve().relative_to(directory.resolve())
        except (OSError, ValueError):
            errors.append(f"catalog/validation/{relative}: validation file resolves outside validation directory")
            continue
        if "/" in relative or path.name not in known:
            errors.append(f"catalog/validation/{relative}: unknown validation file")
            continue
        operation = by_file[path.name]
        catalog_path = root / "catalog/operations" / path.name
        item_errors, value = _attestation_errors(root, operation, catalog_path, path)
        errors.extend(item_errors)
        if not item_errors and value is not None:
            values[path.name] = value
    return errors, values


def display_dimension(value: dict[str, Any] | None) -> tuple[str, str | None]:
    """Return a label and acceptance-review link for generated reference tables."""
    if value is None:
        return "not attested", None
    status = value["status"]
    if status == UNVALIDATED:
        return status, None
    return status, value["acceptance_review"]["path"]
