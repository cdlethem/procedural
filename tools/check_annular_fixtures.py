#!/usr/bin/env python3
"""Structural validation for closed-annular-solid fixture records.

This checker binds catalog and oracle inputs, then checks the fixed four-ring washer
topology.  Its raw cross product is a structural direction check for finite reference
fixtures, not a replacement for the contract's scaled-normal arithmetic or a general
all-finite robustness proof.  It deliberately does not generate a second numeric fixture
oracle.
"""
from __future__ import annotations

import math
from collections import Counter
from pathlib import Path
from typing import Any

from tools.check_profile_fixtures import (
    DYNAMIC_STAGES,
    HEX64,
    SHA256,
    _bits,
    _canonical,
    _comparison_arrays,
    _error,
    _finite,
    _integer,
    _safe_path,
    _schema_errors,
    _sha256,
    _unwrap_output,
)

OPERATION_ID = "mesh.annular-solid-3d"
FIXTURE_FORMAT = "annular-solid-3d-output"
SUCCESS_KEYS = {"id", "input", "output", "comparison"}
ERROR_CODES = {"INVALID_INPUT", "FACE_LIMIT_EXCEEDED", "MESH_ARITHMETIC_INVALID"}
REQUIRED_BINDINGS = {
    "tools/diagnostics/annular/build_fixture_draft.py",
    "tools/diagnostics/cp7/profile_fixture_cases.py",
    "tools/diagnostics/cp7/profile_intervals.py",
}
KINDS = ("outer-wall", "inner-wall", "top-annulus", "bottom-annulus")
MAX_SLICES = 89_478_485
MAX_FACES = 715_827_881


def _catalog_path(root: Path, op: dict[str, Any]) -> Path | None:
    """Resolve a staged annular catalog path without inheriting the profile fallback."""
    staged = op.get("_catalog_path")
    if staged is not None:
        return _safe_path(root, staged)
    name = op.get("_file")
    if isinstance(name, str) and name and not Path(name).is_absolute() and "/" not in name and "\\" not in name:
        return root / "catalog" / "operations" / name
    return root / "catalog" / "operations" / "annular-solid-3d.json"


def _input_semantic_errors(value: Any) -> list[str]:
    """Check cross-field annular requirements outside JSON Schema."""
    if not isinstance(value, dict):
        return []
    errors: list[str] = []
    outer, inner = value.get("outerRadius"), value.get("innerRadius")
    bottom, top = value.get("bottomZ"), value.get("topZ")
    if _finite(outer) and _finite(inner) and not (float(outer) > float(inner) > 0.0):
        errors.append("outerRadius must exceed positive innerRadius")
    if _finite(bottom) and _finite(top) and not float(bottom) < float(top):
        errors.append("bottomZ must be less than topZ")
    return errors


def _counts(input_data: Any) -> tuple[int, int] | None:
    if not isinstance(input_data, dict):
        return None
    slices = input_data.get("slices")
    if not _integer(slices, 3, MAX_SLICES):
        return None
    value = int(slices)
    return 4 * value, 8 * value


def _expected_faces(slices: int) -> list[tuple[tuple[int, int, int], str, int]]:
    """Return the declared cell-major, kind-major triangle sequence."""
    faces: list[tuple[tuple[int, int, int], str, int]] = []
    for cell in range(slices):
        next_cell = (cell + 1) % slices
        outer_bottom, outer_bottom_next = cell, next_cell
        outer_top, outer_top_next = slices + cell, slices + next_cell
        inner_bottom, inner_bottom_next = 2 * slices + cell, 2 * slices + next_cell
        inner_top, inner_top_next = 3 * slices + cell, 3 * slices + next_cell
        quads = (
            ((outer_bottom, outer_bottom_next, outer_top_next, outer_top), "outer-wall"),
            ((inner_bottom, inner_top, inner_top_next, inner_bottom_next), "inner-wall"),
            ((outer_top, outer_top_next, inner_top_next, inner_top), "top-annulus"),
            ((outer_bottom, inner_bottom, inner_bottom_next, outer_bottom_next), "bottom-annulus"),
        )
        for (a, b, c, d), kind in quads:
            faces.extend((((a, b, c), kind, cell), ((a, c, d), kind, cell)))
    return faces


def _position(row: Any) -> tuple[float, float, float] | None:
    if not isinstance(row, list) or len(row) != 3 or not all(_canonical(item) for item in row):
        return None
    return float(row[0]), float(row[1]), float(row[2])


def _cross(positions: list[Any], triangle: tuple[int, int, int]) -> tuple[float, float, float] | None:
    a, b, c = (_position(positions[index]) for index in triangle)
    if a is None or b is None or c is None:
        return None
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    return (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)


def _validate_ring_layout(input_data: dict[str, Any], positions: list[Any],
                          allowances: Any, label: str, errors: list[str]) -> None:
    """Check the forced Z/ring identity fields without making a trig oracle."""
    slices = int(input_data["slices"])
    rings = (
        ("outerBottom", input_data["outerRadius"], input_data["bottomZ"]),
        ("outerTop", input_data["outerRadius"], input_data["topZ"]),
        ("innerBottom", input_data["innerRadius"], input_data["bottomZ"]),
        ("innerTop", input_data["innerRadius"], input_data["topZ"]),
    )
    for ring_index, (name, radius, z_value) in enumerate(rings):
        base = ring_index * slices
        first = _position(positions[base]) if base < len(positions) else None
        if first is not None:
            if _bits(first[0]) != _bits(radius) or _bits(first[1]) != _bits(0.0):
                errors.append(f"{label}: {name} cell0 must begin at (+radius,+0)")
        for cell in range(slices):
            index = base + cell
            point = _position(positions[index]) if index < len(positions) else None
            if point is None:
                continue
            if _bits(point[2]) != _bits(z_value):
                errors.append(f"{label}: {name}[{cell}].z must exactly equal its axial input")
            if isinstance(allowances, list) and index < len(allowances):
                row = allowances[index]
                if isinstance(row, list) and len(row) == 3 and row[2] != 0:
                    errors.append(f"{label}: {name}[{cell}].z must have zero allowance")


def _validate_output_structure(input_data: dict[str, Any], output: Any, positions: Any,
                               normals: Any, position_allowances: Any, label: str,
                               errors: list[str]) -> None:
    if not isinstance(output, dict) or not isinstance(positions, list) or not isinstance(normals, list):
        return
    arrays = {name: output.get(name) for name in ("positions", "triangles", "normals", "faceKinds", "cells")}
    if not all(isinstance(value, list) for value in arrays.values()):
        return
    expected_counts = _counts(input_data)
    if expected_counts is None:
        return
    vertices, faces = expected_counts
    if len(arrays["positions"]) != vertices:
        errors.append(f"{label}: positions count must equal 4*slices")
    for name in ("triangles", "normals", "faceKinds", "cells"):
        if len(arrays[name]) != faces:
            errors.append(f"{label}: {name} count must equal 8*slices")
    if len(positions) != vertices or len(normals) != faces:
        return
    _validate_ring_layout(input_data, positions, position_allowances, label, errors)
    expected = _expected_faces(int(input_data["slices"]))
    directed: Counter[tuple[int, int]] = Counter()
    undirected: Counter[tuple[int, int]] = Counter()
    for index, (triangle, expected_kind, expected_cell) in enumerate(expected):
        if index >= len(arrays["triangles"]) or index >= len(arrays["faceKinds"]) or index >= len(arrays["cells"]):
            break
        recorded = arrays["triangles"][index]
        if (not isinstance(recorded, list) or len(recorded) != 3
                or not all(_integer(item, 0, vertices - 1) for item in recorded)):
            errors.append(f"{label}: triangles[{index}] must use three in-range non-boolean integer indices")
            continue
        actual = tuple(int(item) for item in recorded)
        if actual != triangle:
            errors.append(f"{label}: triangles[{index}] violates annular ring/cell traversal")
            continue
        if arrays["faceKinds"][index] != expected_kind:
            errors.append(f"{label}: faceKinds[{index}] must be {expected_kind}")
        if arrays["cells"][index] != expected_cell:
            errors.append(f"{label}: cells[{index}] must be {expected_cell}")
        normal = _position(normals[index])
        cross = _cross(positions, actual)
        if normal is None or cross is None:
            continue
        normal_length = math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2])
        if not math.isfinite(normal_length) or abs(normal_length - 1.0) > 2.0 ** -48:
            errors.append(f"{label}: normals[{index}] must be a finite unit flat normal")
        if cross[0] == 0 and cross[1] == 0 and cross[2] == 0:
            errors.append(f"{label}: triangles[{index}] has zero geometric area")
        alignment = normal[0] * cross[0] + normal[1] * cross[1] + normal[2] * cross[2]
        if not math.isfinite(alignment) or alignment <= 0:
            errors.append(f"{label}: normals[{index}] must align with triangle winding")
        cx = sum(_position(positions[vertex])[0] for vertex in actual) / 3.0  # type: ignore[index]
        cy = sum(_position(positions[vertex])[1] for vertex in actual) / 3.0  # type: ignore[index]
        kind = expected_kind
        if ((kind == "outer-wall" and normal[0] * cx + normal[1] * cy <= 0)
                or (kind == "inner-wall" and normal[0] * cx + normal[1] * cy >= 0)
                or (kind == "top-annulus" and normal[2] <= 0)
                or (kind == "bottom-annulus" and normal[2] >= 0)):
            errors.append(f"{label}: normals[{index}] points inward for {kind}")
        for first, second in ((actual[0], actual[1]), (actual[1], actual[2]), (actual[2], actual[0])):
            directed[(first, second)] += 1
            undirected[(min(first, second), max(first, second))] += 1
    if len(undirected) != 12 * int(input_data["slices"]):
        errors.append(f"{label}: annular mesh must have 12*slices undirected edges")
    for edge, count in undirected.items():
        if count != 2 or directed[(edge[0], edge[1])] != 1 or directed[(edge[1], edge[0])] != 1:
            errors.append(f"{label}: edge {edge} must occur twice with opposite directions")
    if vertices - len(undirected) + faces != 0:
        errors.append(f"{label}: annular mesh Euler characteristic must be zero")


def _validate_success(case: dict[str, Any], op: dict[str, Any], label: str, errors: list[str]) -> None:
    if set(case) != SUCCESS_KEYS:
        errors.append(f"{label}: successful case must contain exactly id,input,output,comparison")
    input_data = case.get("input")
    input_errors = _schema_errors(op.get("input_schema"), input_data) + _input_semantic_errors(input_data)
    if input_errors:
        errors.extend(f"{label}: successful input invalid: {message}" for message in input_errors)
        return
    output, wrapped = _unwrap_output(case.get("output"), f"{label}.output", errors)
    output_errors = _schema_errors(op.get("output_schema"), output)
    if output_errors:
        errors.extend(f"{label}: output schema: {message}" for message in output_errors)
        return
    counts = _counts(input_data)
    if counts is None or counts[1] > int(input_data["maxFaces"]):
        errors.append(f"{label}: success must fit maxFaces")
        return
    positions, normals = wrapped.get("positions"), wrapped.get("normals")
    position_allowances, _ = _comparison_arrays(case, positions, normals, label, errors)
    if isinstance(input_data, dict):
        _validate_output_structure(input_data, output, positions, normals, position_allowances, label, errors)


def _validate_error(case: dict[str, Any], op: dict[str, Any], label: str, errors: list[str]) -> None:
    code = case.get("error")
    expected_keys = {"id", "input", "error"}
    if code == "MESH_ARITHMETIC_INVALID":
        expected_keys.add("error_detail")
    if set(case) != expected_keys:
        errors.append(f"{label}: error case has wrong fields")
    if code not in ERROR_CODES:
        errors.append(f"{label}: error must be a declared constructor error")
        return
    input_data = case.get("input")
    schema_errors = _schema_errors(op.get("input_schema"), input_data)
    semantic_errors = _input_semantic_errors(input_data)
    if code == "INVALID_INPUT":
        if not schema_errors and not semantic_errors:
            errors.append(f"{label}: INVALID_INPUT requires schema or semantic invalidity")
        return
    if schema_errors or semantic_errors:
        errors.append(f"{label}: {code} requires complete static input validity")
        return
    counts = _counts(input_data)
    if counts is None:
        return
    if code == "FACE_LIMIT_EXCEEDED":
        if counts[1] <= int(input_data["maxFaces"]):
            errors.append(f"{label}: FACE_LIMIT_EXCEEDED must exceed maxFaces")
        return
    if counts[1] > int(input_data["maxFaces"]):
        errors.append(f"{label}: face budget must fail before mesh arithmetic")
    detail = case.get("error_detail")
    if not isinstance(detail, dict) or set(detail) != {"faceIndex", "stage"}:
        errors.append(f"{label}: MESH_ARITHMETIC_INVALID needs exactly faceIndex,stage")
        return
    if not _integer(detail.get("faceIndex"), 0, counts[1] - 1):
        errors.append(f"{label}: dynamic faceIndex must be an in-range non-boolean integer")
    stages = op.get("dynamic_error_stages")
    allowed = set(stages) if isinstance(stages, list) else DYNAMIC_STAGES
    if detail.get("stage") not in allowed:
        errors.append(f"{label}: dynamic stage is not declared by operation")


def validate(root: Path | str, prefix: str, op: dict[str, Any], fixture: dict[str, Any]) -> list[str]:
    """Return annular-fixture integrity failures; never run a mesh oracle."""
    root = Path(root)
    errors: list[str] = []
    required = {"operation", "version", "fixture_format", "fixture_status", "catalog_sha256", "scope", "source_bindings", "cases"}
    if not isinstance(op, dict):
        return [_error(prefix, "operation must be an object")]
    if not isinstance(fixture, dict):
        return [_error(prefix, "fixture must be an object")]
    if set(fixture) != required:
        errors.append(_error(prefix, "fixture top-level shape differs"))
    if fixture.get("operation") != OPERATION_ID or fixture.get("operation") != op.get("id"):
        errors.append(_error(prefix, "operation must identify annular solid"))
    if fixture.get("version") != op.get("version"):
        errors.append(_error(prefix, "fixture version must equal operation version"))
    if fixture.get("fixture_format") != FIXTURE_FORMAT:
        errors.append(_error(prefix, "fixture_format must be annular-solid-3d-output"))
    allowed_fixture_status = {"reviewed"} if op.get("status") == "reviewed" else {"review_pending", "reviewed"}
    if fixture.get("fixture_status") not in allowed_fixture_status:
        errors.append(_error(prefix, "fixture_status must be review_pending or reviewed"))
    if not isinstance(fixture.get("scope"), str) or not fixture["scope"].strip():
        errors.append(_error(prefix, "scope must be a nonempty draft-scope description"))
    catalog = _catalog_path(root, op)
    digest = fixture.get("catalog_sha256")
    if not isinstance(digest, str) or not SHA256.fullmatch(digest):
        errors.append(_error(prefix, "catalog_sha256 must be lowercase sha256"))
    elif catalog is None or not catalog.is_file():
        errors.append(_error(prefix, "catalog source is unavailable for hash binding"))
    elif _sha256(catalog) != digest:
        errors.append(_error(prefix, "catalog_sha256 does not bind current operation source"))
    bindings = fixture.get("source_bindings")
    if not isinstance(bindings, dict) or set(bindings) != REQUIRED_BINDINGS:
        errors.append(_error(prefix, "source_bindings must contain exactly annular generator and numeric oracle inputs"))
    elif all(isinstance(raw, str) for raw in bindings):
        for raw, bound_hash in bindings.items():
            path = _safe_path(root, raw)
            if not isinstance(bound_hash, str) or not SHA256.fullmatch(bound_hash):
                errors.append(_error(prefix, f"source binding {raw!r} must have lowercase sha256"))
            elif path is None or not path.is_file():
                errors.append(_error(prefix, f"source binding {raw!r} is missing or outside repository"))
            elif _sha256(path) != bound_hash:
                errors.append(_error(prefix, f"source binding {raw!r} is stale"))
    cases = fixture.get("cases")
    if not isinstance(cases, list) or not cases:
        return errors + [_error(prefix, "cases must be a nonempty list")]
    identifiers: set[str] = set()
    for ordinal, case in enumerate(cases):
        label = f"{prefix}.cases[{ordinal}]"
        if not isinstance(case, dict):
            errors.append(_error(label, "case must be an object"))
            continue
        identifier = case.get("id")
        if not isinstance(identifier, str) or not identifier.strip() or identifier in identifiers:
            errors.append(_error(label, "case id must be unique and nonempty"))
        else:
            identifiers.add(identifier)
            label = f"{prefix}/{identifier}"
        has_output, has_error = "output" in case, "error" in case
        if has_output == has_error or "input" not in case:
            errors.append(_error(label, "case must provide input and exactly one of output,error"))
        elif has_output:
            _validate_success(case, op, label, errors)
        else:
            _validate_error(case, op, label, errors)
    return errors
