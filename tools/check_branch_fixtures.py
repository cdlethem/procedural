#!/usr/bin/env python3
"""Structural validation for seeded endpoint-branch fixture records.

This deliberately does not reproduce tree expansion, random-state transitions, or
trigonometry.  It verifies the fixture's schema, retained-tree invariants, exact
attributes, and provenance before a runtime conformance runner consumes it.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import struct
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

OPERATION_ID = "topology.seeded-endpoint-branches-2d"
FIXTURE_FORMAT = "branch-tree-output"
UINT32_MAX = (1 << 32) - 1
SHA256 = re.compile(r"^[0-9a-f]{64}$")
HEX64 = re.compile(r"^[0-9a-f]{16}$")
DYNAMIC_ERRORS = {"BRANCH_ARITHMETIC_INVALID", "SEGMENT_LIMIT_EXCEEDED"}
CONSTRUCTOR_ERRORS = {"INVALID_INPUT", *DYNAMIC_ERRORS}
TRACE_ROLES = {"scale", "gate", "turn"}


def _error(prefix: str, message: str) -> str:
    return f"{prefix}: {message}" if prefix else message


def _finite(value: Any) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _canonical(value: Any) -> bool:
    if not _finite(value):
        return False
    if value != 0:
        return True
    return math.copysign(1.0, float(value)) > 0


def _integer(value: Any, low: int | None = None, high: int | None = None) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not _finite(value):
        return False
    try:
        if not float(value).is_integer():
            return False
    except OverflowError:
        return False
    return (low is None or value >= low) and (high is None or value <= high)


def _uint32(value: Any) -> bool:
    return _integer(value, 0, UINT32_MAX)


def _bits(value: Any) -> str | None:
    if not _canonical(value):
        return None
    return struct.pack(">d", float(value)).hex()


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _schema_errors(schema: Any, value: Any) -> list[str]:
    if not isinstance(schema, dict):
        return ["operation lacks a schema"]
    try:
        return [error.message for error in Draft202012Validator(schema).iter_errors(value)]
    except Exception as exc:  # malformed draft operation must be diagnosable
        return [f"invalid schema: {exc}"]


def _recursively_finite(value: Any) -> bool:
    if isinstance(value, dict):
        return all(_recursively_finite(item) for item in value.values())
    if isinstance(value, list):
        return all(_recursively_finite(item) for item in value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return _finite(value)
    return True


def _input_semantic_errors(value: Any) -> list[str]:
    """Only static cross-field checks specified by the branch draft."""
    if not isinstance(value, dict):
        return []
    errors: list[str] = []
    if not _recursively_finite(value):
        errors.append("input contains a nonfinite number")
    rules = value.get("rules")
    if not isinstance(rules, list):
        return errors
    for rule_index, rule in enumerate(rules):
        if not isinstance(rule, dict):
            continue
        scale = rule.get("lengthScale")
        if (isinstance(scale, list) and len(scale) == 2 and
                all(_finite(item) for item in scale) and scale[0] > scale[1]):
            errors.append(f"rules[{rule_index}].lengthScale lower exceeds upper")
        slots = rule.get("slots")
        if not isinstance(slots, list):
            continue
        for slot_index, slot in enumerate(slots):
            if not isinstance(slot, dict):
                continue
            turn = slot.get("turn")
            if (isinstance(turn, list) and len(turn) == 2 and
                    all(_finite(item) for item in turn) and turn[0] > turn[1]):
                errors.append(f"rules[{rule_index}].slots[{slot_index}].turn lower exceeds upper")
    return errors


def _relative_path(root: Path, raw: Any) -> Path | None:
    if not isinstance(raw, str) or not raw or Path(raw).is_absolute():
        return None
    path = root / raw
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError:
        return None
    return path


def _canonical_op_hash(root: Path, op: dict[str, Any]) -> str | None:
    """Bind fixture catalog hash to the canonical catalog source when available."""
    source = root / "catalog/operations/seeded-endpoint-branches.json"
    if source.is_file():
        try:
            if json.loads(source.read_text(encoding="utf-8")) == op:
                return _sha256(source)
        except (OSError, json.JSONDecodeError):
            pass
    # Helpful for isolated unit fixtures; catalog fixtures use the raw source above.
    try:
        payload = json.dumps(op, sort_keys=True, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError):
        return None
    return hashlib.sha256(payload).hexdigest()


def _frozen_seed_vectors(root: Path) -> Any:
    path = root / "fixtures/operations/seeded-triangle-points.json"
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("seed_vectors")
    except (OSError, json.JSONDecodeError):
        return None


def _validate_seed_vectors(value: Any, prefix: str, errors: list[str]) -> None:
    if not isinstance(value, list) or len(value) != 5:
        errors.append(_error(prefix, "seed_vectors must contain the frozen five vectors"))
        return
    for vector_index, vector in enumerate(value):
        item_prefix = f"{prefix}.seed_vectors[{vector_index}]"
        if not isinstance(vector, dict):
            errors.append(_error(item_prefix, "must be an object"))
            continue
        if not _uint32(vector.get("seed")):
            errors.append(_error(item_prefix, "seed must be uint32"))
        for name, expected in (("initial_state", 4), ("first_10", 10)):
            if not isinstance(vector.get(name), list) or len(vector[name]) != expected:
                errors.append(_error(item_prefix, f"{name} must have {expected} entries"))
        state = vector.get("initial_state")
        if isinstance(state, list) and (len(state) != 4 or not all(_uint32(word) for word in state)):
            errors.append(_error(item_prefix, "initial_state must be four uint32 words"))
        samples = vector.get("first_10")
        if isinstance(samples, list):
            for index, sample in enumerate(samples):
                sample_prefix = f"{item_prefix}.first_10[{index}]"
                if not isinstance(sample, dict):
                    errors.append(_error(sample_prefix, "must be an object"))
                    continue
                if not _integer(sample.get("index"), index, index):
                    errors.append(_error(sample_prefix, "index must be the canonical expected ordinal"))
                word = sample.get("output_u32")
                if not _uint32(word):
                    errors.append(_error(sample_prefix, "output_u32 must be uint32"))
                unit = sample.get("unit")
                if not _canonical(unit) or not (0 <= unit < 1) or (
                        _uint32(word) and float(unit) != int(word) / 4294967296.0):
                    errors.append(_error(sample_prefix, "unit must equal output_u32 / 2^32"))
                post = sample.get("post_state")
                if not isinstance(post, list) or len(post) != 4 or not all(_uint32(item) for item in post):
                    errors.append(_error(sample_prefix, "post_state must be four uint32 words"))


def _validate_trace(trace: Any, prefix: str, errors: list[str], node_count: int | None = None) -> None:
    if not isinstance(trace, list):
        errors.append(_error(prefix, "rng_trace must be an array"))
        return
    for index, record in enumerate(trace):
        item_prefix = f"{prefix}.rng_trace[{index}]"
        if not isinstance(record, dict):
            errors.append(_error(item_prefix, "must be an object"))
            continue
        if set(record) != {"parentIndex", "slotIndex", "role", "word", "state"}:
            errors.append(_error(item_prefix, "must contain exactly parentIndex,slotIndex,role,word,state"))
        parent, slot, role = record.get("parentIndex"), record.get("slotIndex"), record.get("role")
        if not _integer(parent, -1):
            errors.append(_error(item_prefix, "parentIndex must be an integer >= -1"))
        elif node_count is not None and not _integer(parent, 0, node_count - 1):
            errors.append(_error(item_prefix, "success trace parentIndex must name a retained segment"))
        if not _integer(slot, -1):
            errors.append(_error(item_prefix, "slotIndex must be an integer >= -1"))
        if role not in TRACE_ROLES:
            errors.append(_error(item_prefix, "role must be scale, gate, or turn"))
        if role == "scale" and slot != -1:
            errors.append(_error(item_prefix, "scale trace must use slotIndex -1"))
        if role != "scale" and not _integer(slot, 0):
            errors.append(_error(item_prefix, "gate/turn trace must use nonnegative slotIndex"))
        if not _uint32(record.get("word")):
            errors.append(_error(item_prefix, "word must be uint32"))
        state = record.get("state")
        if not isinstance(state, list) or len(state) != 4 or not all(_uint32(word) for word in state):
            errors.append(_error(item_prefix, "state must be four uint32 words"))


def _validate_output(case: dict[str, Any], op: dict[str, Any], prefix: str, errors: list[str]) -> None:
    output = case.get("output")
    schema_errors = _schema_errors(op.get("output_schema"), output)
    if schema_errors:
        errors.extend(_error(prefix, f"output schema: {message}") for message in schema_errors)
        return
    if not isinstance(output, dict):
        return
    names = ("segments", "headings", "lengths", "parents", "generations", "childCounts")
    arrays = {name: output.get(name) for name in names}
    if not all(isinstance(array, list) for array in arrays.values()):
        return
    size = len(arrays["segments"])
    if size < 1 or any(len(array) != size for array in arrays.values()):
        errors.append(_error(prefix, "six output arrays must have equal positive length"))
        return
    source = case.get("input", {})
    max_segments = source.get("maxSegments") if isinstance(source, dict) else None
    if _integer(max_segments, 1) and size > int(max_segments):
        errors.append(_error(prefix, "output exceeds input maxSegments"))
    segments = arrays["segments"]
    for index, segment in enumerate(segments):
        if not isinstance(segment, list) or len(segment) != 4 or not all(_canonical(value) for value in segment):
            errors.append(_error(prefix, f"segments[{index}] must be four finite canonical numbers"))
    for name in ("headings", "lengths"):
        for index, value in enumerate(arrays[name]):
            if not _canonical(value) or (name == "lengths" and value < 0):
                errors.append(_error(prefix, f"{name}[{index}] must be finite canonical" + (" nonnegative" if name == "lengths" else "")))
    for name in ("parents", "generations", "childCounts"):
        for index, value in enumerate(arrays[name]):
            low = -1 if name == "parents" else 0
            if not _integer(value, low) or not _canonical(value):
                errors.append(_error(prefix, f"{name}[{index}] must be a canonical integer"))
    if not isinstance(source, dict) or not isinstance(source.get("root"), dict):
        return
    root = source["root"]
    origin = root.get("origin")
    if (isinstance(origin, list) and len(origin) == 2 and len(segments) and
            all(_finite(value) for value in [*origin, root.get("heading"), root.get("length")])):
        if (_bits(segments[0][0]) != _bits(0.0 if origin[0] == 0 else origin[0]) or
                _bits(segments[0][1]) != _bits(0.0 if origin[1] == 0 else origin[1])):
            errors.append(_error(prefix, "root segment start must exactly equal root origin"))
        if _bits(arrays["headings"][0]) != _bits(0.0 if root["heading"] == 0 else root["heading"]):
            errors.append(_error(prefix, "root heading must exactly equal input root.heading"))
        if _bits(arrays["lengths"][0]) != _bits(0.0 if root["length"] == 0 else root["length"]):
            errors.append(_error(prefix, "root length must exactly equal input root.length"))
    parents, generations, child_counts = arrays["parents"], arrays["generations"], arrays["childCounts"]
    if parents[0] != -1 or generations[0] != 0:
        errors.append(_error(prefix, "root must have parent -1 and generation 0"))
    actual_children = [0] * size
    for index in range(1, size):
        parent = parents[index]
        if not _integer(parent, 0, index - 1):
            errors.append(_error(prefix, f"parents[{index}] must refer to an earlier segment"))
            continue
        actual_children[int(parent)] += 1
        if generations[index] != generations[int(parent)] + 1:
            errors.append(_error(prefix, f"generations[{index}] must equal parent generation + 1"))
        if generations[index] < generations[index - 1]:
            errors.append(_error(prefix, "generations must be nondecreasing in BFS order"))
        if (isinstance(segments[index], list) and isinstance(segments[int(parent)], list) and
                len(segments[index]) == len(segments[int(parent)]) == 4 and
                (_bits(segments[index][0]) != _bits(segments[int(parent)][2]) or
                 _bits(segments[index][1]) != _bits(segments[int(parent)][3]))):
            errors.append(_error(prefix, f"segments[{index}] start must exactly equal parent endpoint"))
    if child_counts != actual_children:
        errors.append(_error(prefix, "childCounts must equal actual direct child references"))
    if any(_integer(value) and value > size - 1 for value in child_counts):
        errors.append(_error(prefix, "childCounts cannot exceed N-1"))
    bits = case.get("exact_attribute_bits")
    if not isinstance(bits, dict) or set(bits) != {"headings", "lengths"}:
        errors.append(_error(prefix, "exact_attribute_bits must contain headings and lengths"))
    else:
        for name in ("headings", "lengths"):
            values, hexes = arrays[name], bits.get(name)
            if not isinstance(hexes, list) or len(hexes) != size:
                errors.append(_error(prefix, f"exact_attribute_bits.{name} must align with output"))
                continue
            for index, expected in enumerate(hexes):
                if not isinstance(expected, str) or not HEX64.fullmatch(expected) or _bits(values[index]) != expected:
                    errors.append(_error(prefix, f"exact_attribute_bits.{name}[{index}] must equal output bits"))
    comparison = case.get("comparison")
    if not isinstance(comparison, dict):
        errors.append(_error(prefix, "success must provide comparison"))
        return
    mode = comparison.get("mode")
    if mode == "binary64-exact":
        if set(comparison) != {"mode"}:
            errors.append(_error(prefix, "binary64-exact comparison has unexpected fields"))
    elif mode == "bounded-trig":
        if set(comparison) != {"mode", "segments_abs", "rationale"} or not isinstance(comparison.get("rationale"), str) or not comparison["rationale"].strip():
            errors.append(_error(prefix, "bounded-trig requires explicit tolerance rationale and exact comparison fields"))
        tolerances = comparison.get("segments_abs")
        if not isinstance(tolerances, list) or len(tolerances) != size:
            errors.append(_error(prefix, "bounded-trig segments_abs must align with segments"))
        else:
            for index, row in enumerate(tolerances):
                if not isinstance(row, list) or len(row) != 4 or not all(_canonical(value) and value >= 0 for value in row):
                    errors.append(_error(prefix, f"bounded-trig segments_abs[{index}] must be four finite canonical nonnegative values"))
    else:
        errors.append(_error(prefix, "comparison mode must be binary64-exact or bounded-trig"))


def _validate_error(case: dict[str, Any], op: dict[str, Any], prefix: str, errors: list[str]) -> None:
    forbidden = {"output", "comparison", "exact_attribute_bits"} & set(case)
    if forbidden:
        errors.append(_error(prefix, f"error case must not include {','.join(sorted(forbidden))}"))
    error = case.get("error")
    if error not in CONSTRUCTOR_ERRORS:
        errors.append(_error(prefix, "error must be a constructor error code"))
        return
    schema_errors = _schema_errors(op.get("input_schema"), case.get("input"))
    semantic_errors = _input_semantic_errors(case.get("input"))
    detail = case.get("error_detail")
    if error == "INVALID_INPUT":
        if not schema_errors and not semantic_errors:
            errors.append(_error(prefix, "INVALID_INPUT requires invalid schema or ordered interval"))
        if detail is not None:
            errors.append(_error(prefix, "INVALID_INPUT must not include error_detail"))
        if "rng_trace" in case:
            errors.append(_error(prefix, "INVALID_INPUT must not include a generated RNG trace"))
    else:
        if schema_errors or semantic_errors:
            errors.append(_error(prefix, f"{error} requires statically valid input"))
        if not isinstance(detail, dict):
            errors.append(_error(prefix, f"{error} requires error_detail"))
            return
        allowed = {"parentIndex", "slotIndex"}
        if error == "BRANCH_ARITHMETIC_INVALID":
            allowed.add("stage")
        if set(detail) != allowed:
            errors.append(_error(prefix, f"{error} error_detail has wrong fields"))
        parent, slot = detail.get("parentIndex"), detail.get("slotIndex")
        if not _integer(parent, -1) or not _integer(slot, -1):
            errors.append(_error(prefix, "dynamic error indexes must be integers >= -1"))
        if (parent == -1) != (slot == -1):
            errors.append(_error(prefix, "root error must use both indexes -1"))
        if error == "SEGMENT_LIMIT_EXCEEDED" and (parent == -1 or slot == -1):
            errors.append(_error(prefix, "capacity error must name a child parent and slot"))
        if error == "BRANCH_ARITHMETIC_INVALID":
            stages = set(op.get("dynamic_error_stages", []))
            if detail.get("stage") not in stages:
                errors.append(_error(prefix, "arithmetic error stage is not declared by operation"))
            if parent == -1 and detail.get("stage") in {"length", "heading"}:
                errors.append(_error(prefix, "root length/heading failures belong to static validation"))
        if "rng_trace" not in case:
            errors.append(_error(prefix, "dynamic error requires its pre-failure RNG trace"))
    if "rng_trace" in case:
        _validate_trace(case["rng_trace"], prefix, errors)


def validate(root: Path | str, prefix: str, op: dict[str, Any], fixture: dict[str, Any]) -> list[str]:
    """Return fixture-integrity errors without executing the branch algorithm."""
    root = Path(root)
    errors: list[str] = []
    if not isinstance(fixture, dict):
        return [_error(prefix, "fixture must be an object")]
    if not isinstance(op, dict):
        return [_error(prefix, "operation must be an object")]
    if fixture.get("operation") != op.get("id") or fixture.get("operation") != OPERATION_ID:
        errors.append(_error(prefix, "operation does not identify seeded endpoint branches"))
    if fixture.get("version") != op.get("version"):
        errors.append(_error(prefix, "fixture version must equal operation version"))
    if fixture.get("fixture_format") != FIXTURE_FORMAT:
        errors.append(_error(prefix, "fixture_format must be branch-tree-output"))
    if not isinstance(fixture.get("fixture_status"), str) or not fixture["fixture_status"].strip():
        errors.append(_error(prefix, "fixture_status must be nonempty"))
    catalog_hash = fixture.get("catalog_sha256")
    expected_catalog_hash = _canonical_op_hash(root, op)
    if not isinstance(catalog_hash, str) or not SHA256.fullmatch(catalog_hash):
        errors.append(_error(prefix, "catalog_sha256 must be lowercase sha256"))
    elif expected_catalog_hash is None or catalog_hash != expected_catalog_hash:
        errors.append(_error(prefix, "catalog_sha256 does not bind the current operation source"))
    bindings = fixture.get("source_bindings")
    if not isinstance(bindings, dict) or not bindings:
        errors.append(_error(prefix, "source_bindings must be a nonempty object"))
    else:
        required_bindings = {"tools/generate_branch_tree_fixtures.py", "tools/generate_triangle_points_fixtures.py", "evidence/investigations/cp6-numeric-cases.json"}
        if not required_bindings <= bindings.keys():
            errors.append(_error(prefix, "source_bindings must include generator, shared helper and numeric evidence"))
        for raw_path, bound_hash in bindings.items():
            path = _relative_path(root, raw_path)
            if not isinstance(bound_hash, str) or not SHA256.fullmatch(bound_hash):
                errors.append(_error(prefix, f"source binding {raw_path!r} has invalid sha256"))
            elif path is None or not path.is_file():
                errors.append(_error(prefix, f"source binding {raw_path!r} does not name a project file"))
            elif _sha256(path) != bound_hash:
                errors.append(_error(prefix, f"source binding {raw_path!r} is stale"))
    vectors = fixture.get("seed_vectors")
    _validate_seed_vectors(vectors, prefix, errors)
    frozen = _frozen_seed_vectors(root)
    if frozen is None or vectors != frozen:
        errors.append(_error(prefix, "seed_vectors must equal frozen CP3 vectors"))
    limitations = fixture.get("limitations")
    if not isinstance(limitations, list) or not all(isinstance(item, str) and item for item in limitations):
        errors.append(_error(prefix, "limitations must be a list of nonempty strings"))
    cases = fixture.get("cases")
    if not isinstance(cases, list) or not cases:
        errors.append(_error(prefix, "cases must be a nonempty list"))
        return errors
    identifiers: set[str] = set()
    for case_index, case in enumerate(cases):
        case_prefix = f"{prefix}.cases[{case_index}]"
        if not isinstance(case, dict):
            errors.append(_error(case_prefix, "case must be an object"))
            continue
        identifier = case.get("id")
        if not isinstance(identifier, str) or not identifier or identifier in identifiers:
            errors.append(_error(case_prefix, "id must be a unique nonempty string"))
        else:
            identifiers.add(identifier)
        has_output, has_error = "output" in case, "error" in case
        if has_output == has_error:
            errors.append(_error(case_prefix, "case must be exactly success or error"))
            continue
        if "input" not in case:
            errors.append(_error(case_prefix, "case must provide input"))
            continue
        if has_output:
            input_errors = _schema_errors(op.get("input_schema"), case["input"])
            input_errors += _input_semantic_errors(case["input"])
            if input_errors:
                errors.extend(_error(case_prefix, f"success input invalid: {message}") for message in input_errors)
            output = case.get("output")
            trace_nodes = len(output.get("segments", [])) if isinstance(output, dict) and isinstance(output.get("segments"), list) else None
            _validate_trace(case.get("rng_trace"), case_prefix, errors, trace_nodes)
            _validate_output(case, op, case_prefix, errors)
        else:
            _validate_error(case, op, case_prefix, errors)
    return errors
