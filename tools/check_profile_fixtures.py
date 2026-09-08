#!/usr/bin/env python3
"""Structural validation for radial-profile surface fixture records.

This module intentionally does not reconstruct rings, compute normals, or evaluate
trigonometry.  It binds a fixture to the catalog and its oracle inputs, then checks
schema projections, declared layout/count facts, reference bits, and allowances.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import struct
from collections import Counter
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

OPERATION_ID = "mesh.radial-profile-surface-3d"
FIXTURE_FORMAT = "radial-profile-surface-output"
SUCCESS_KEYS = {"id", "input", "output", "comparison"}
ERROR_CODES = {"INVALID_INPUT", "FACE_LIMIT_EXCEEDED", "MESH_ARITHMETIC_INVALID"}
DYNAMIC_STAGES = {"edge", "edge_scale", "cross_scale"}
REQUIRED_BINDINGS = {
    "tools/build_profile_fixtures.py",
    "tools/diagnostics/cp7/profile_fixture_cases.py",
    "tools/diagnostics/cp7/profile_intervals.py",
    "design/operations/cp7-profile-fixture-policy.md",
}
SHA256 = re.compile(r"^[0-9a-f]{64}$")
HEX64 = re.compile(r"^[0-9a-f]{16}$")


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
    return _finite(value) and (value != 0 or math.copysign(1.0, float(value)) > 0)


def _integer(value: Any, minimum: int | None = None, maximum: int | None = None) -> bool:
    if not _finite(value):
        return False
    try:
        if not float(value).is_integer():
            return False
    except OverflowError:
        return False
    return (minimum is None or value >= minimum) and (maximum is None or value <= maximum)


def _bits(value: Any) -> str | None:
    if not _canonical(value):
        return None
    return struct.pack(">d", float(value)).hex()


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _safe_path(root: Path, raw: Any) -> Path | None:
    if not isinstance(raw, str) or not raw.strip() or Path(raw).is_absolute():
        return None
    path = (root / raw).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        return None
    return path


def _catalog_path(root: Path, op: dict[str, Any]) -> Path | None:
    """Resolve a staged catalog path without accepting an arbitrary absolute path."""
    staged = op.get("_catalog_path")
    if staged is not None:
        return _safe_path(root, staged)
    name = op.get("_file")
    if isinstance(name, str) and name and not Path(name).is_absolute() and "/" not in name and "\\" not in name:
        return root / "catalog" / "operations" / name
    return root / "catalog" / "operations" / "radial-profile-surface.json"


def _schema_errors(schema: Any, value: Any) -> list[str]:
    if not isinstance(schema, dict):
        return ["operation lacks a schema"]
    try:
        return [error.message for error in Draft202012Validator(schema).iter_errors(value)]
    except Exception as exc:
        return [f"invalid schema: {exc}"]


def _recursively_finite(value: Any) -> bool:
    if isinstance(value, dict):
        return all(_recursively_finite(item) for item in value.values())
    if isinstance(value, list):
        return all(_recursively_finite(item) for item in value)
    return not isinstance(value, (int, float)) or isinstance(value, bool) or _finite(value)


def _input_semantic_errors(value: Any) -> list[str]:
    """Check only cross-field static rules that JSON Schema cannot express."""
    if not isinstance(value, dict):
        return []
    errors: list[str] = []
    if not _recursively_finite(value):
        errors.append("input contains a nonfinite number")
    profile = value.get("profile")
    if not isinstance(profile, list):
        return errors
    parsed: list[tuple[float, float]] = []
    for index, row in enumerate(profile):
        if not isinstance(row, list) or len(row) != 2 or not all(_finite(item) for item in row):
            continue
        z, radius = row
        parsed.append((float(z), float(radius)))
        if index and len(parsed) == index + 1 and not (parsed[-2][0] < float(z)):
            errors.append(f"profile[{index}] axial coordinate must strictly increase")
        if index in {0, len(profile) - 1}:
            if radius < 0:
                errors.append(f"profile[{index}] endpoint radius must be nonnegative")
        elif radius <= 0:
            errors.append(f"profile[{index}] interior radius must be positive")
    if (len(profile) == 2 and len(parsed) == 2
            and parsed[0][1] == 0 and parsed[1][1] == 0):
        errors.append("two-point profile cannot have both endpoint radii zero")
    return errors


def _unwrap_scalar(value: Any, label: str, errors: list[str]) -> Any:
    if not isinstance(value, dict) or set(value) != {"value", "bits_hex"}:
        errors.append(f"{label}: wrapped scalar must contain exactly value,bits_hex")
        return None
    number, bits = value.get("value"), value.get("bits_hex")
    if not _canonical(number):
        errors.append(f"{label}: wrapped value must be finite with canonical +0")
    if not isinstance(bits, str) or not HEX64.fullmatch(bits):
        errors.append(f"{label}: bits_hex must be 16 lowercase hex digits")
    elif _bits(number) != bits:
        errors.append(f"{label}: bits_hex differs from wrapped value")
    return number


def _unwrap_output(output: Any, label: str, errors: list[str]) -> tuple[Any, dict[str, list[list[Any]]]]:
    """Project wrapped numeric references into the catalog's primitive schema."""
    if not isinstance(output, dict):
        errors.append(f"{label}: output must be an object")
        return output, {}
    projected = dict(output)
    wrapped: dict[str, list[list[Any]]] = {}
    for field in ("positions", "normals"):
        rows = output.get(field)
        if not isinstance(rows, list):
            continue
        raw_rows: list[list[Any]] = []
        for row_index, row in enumerate(rows):
            if not isinstance(row, list):
                errors.append(f"{label}.{field}[{row_index}]: must be a triple")
                raw_rows.append([])
                continue
            raw_rows.append([_unwrap_scalar(component, f"{label}.{field}[{row_index}][{column}]", errors)
                             for column, component in enumerate(row)])
        projected[field] = raw_rows
        wrapped[field] = raw_rows
    return projected, wrapped


def _comparison_arrays(case: dict[str, Any], positions: Any, normals: Any,
                       label: str, errors: list[str]) -> tuple[Any, Any]:
    comparison = case.get("comparison")
    if not isinstance(comparison, dict) or set(comparison) != {"positions_abs", "normals_abs"}:
        errors.append(f"{label}: comparison must contain exactly positions_abs,normals_abs")
        return None, None
    rows_by_name = (("positions_abs", positions), ("normals_abs", normals))
    found: list[Any] = []
    for name, expected_rows in rows_by_name:
        values = comparison.get(name)
        found.append(values)
        if not isinstance(values, list) or not isinstance(expected_rows, list) or len(values) != len(expected_rows):
            errors.append(f"{label}: {name} must align with output")
            continue
        for row_index, (allowances, reference) in enumerate(zip(values, expected_rows)):
            if not isinstance(allowances, list) or not isinstance(reference, list) or len(allowances) != len(reference):
                errors.append(f"{label}: {name}[{row_index}] must align with its triple")
                continue
            for column, allowance in enumerate(allowances):
                if not _canonical(allowance) or allowance < 0:
                    errors.append(f"{label}: {name}[{row_index}][{column}] must be finite canonical nonnegative")
    return tuple(found)  # type: ignore[return-value]


def _normalised_zero(value: Any) -> float:
    return 0.0 if value == 0 else float(value)


def _validate_forced_position_components(input_data: dict[str, Any], positions: Any,
                                         position_allowances: Any, label: str,
                                         errors: list[str]) -> None:
    """Validate copied z/pole/cap-centre facts without rebuilding any faces."""
    profile, slices = input_data.get("profile"), input_data.get("slices")
    if not isinstance(profile, list) or not _integer(slices, 3) or not isinstance(positions, list):
        return
    if not isinstance(position_allowances, list):
        return
    cursor = 0

    def require_component(index: int, component: int, expected: float, description: str) -> None:
        if index >= len(positions) or index >= len(position_allowances):
            return
        row, allowance_row = positions[index], position_allowances[index]
        if not isinstance(row, list) or not isinstance(allowance_row, list) or component >= len(row) or component >= len(allowance_row):
            return
        if _bits(row[component]) != _bits(expected):
            errors.append(f"{label}: {description} must exactly equal its forced value")
        if allowance_row[component] != 0:
            errors.append(f"{label}: {description} must have zero allowance")

    for row_index, row in enumerate(profile):
        if not isinstance(row, list) or len(row) != 2 or not all(_finite(item) for item in row):
            return
        z, radius = _normalised_zero(row[0]), float(row[1])
        repeats = 1 if radius == 0 else int(slices)
        for _ in range(repeats):
            require_component(cursor, 2, z, f"positions[{cursor}].z copied from profile[{row_index}]")
            if radius == 0:
                require_component(cursor, 0, 0.0, f"positions[{cursor}].x pole")
                require_component(cursor, 1, 0.0, f"positions[{cursor}].y pole")
            cursor += 1
    for requested, profile_index, name in ((input_data.get("capStart"), 0, "start cap centre"),
                                           (input_data.get("capEnd"), len(profile) - 1, "end cap centre")):
        radius = profile[profile_index][1]
        if requested is True and _finite(radius) and radius > 0:
            z = _normalised_zero(profile[profile_index][0])
            require_component(cursor, 0, 0.0, f"positions[{cursor}].x {name}")
            require_component(cursor, 1, 0.0, f"positions[{cursor}].y {name}")
            require_component(cursor, 2, z, f"positions[{cursor}].z {name}")
            cursor += 1


def _expected_counts(input_data: dict[str, Any]) -> tuple[int, int, dict[int, int], int, int] | None:
    profile, slices = input_data.get("profile"), input_data.get("slices")
    if not isinstance(profile, list) or not _integer(slices, 3):
        return None
    if any(not isinstance(row, list) or len(row) != 2 or not all(_finite(item) for item in row) for row in profile):
        return None
    s = int(slices)
    radii = [float(row[1]) for row in profile]
    poles = int(radii[0] == 0) + int(radii[-1] == 0)
    cap_start = int(input_data.get("capStart") is True and radii[0] > 0)
    cap_end = int(input_data.get("capEnd") is True and radii[-1] > 0)
    vertices = (len(profile) - poles) * s + poles + cap_start + cap_end
    side_by_band = {band: (1 if radii[band] == 0 or radii[band + 1] == 0 else 2)
                    for band in range(len(profile) - 1)}
    faces = sum(per_cell * s for per_cell in side_by_band.values()) + (cap_start + cap_end) * s
    return vertices, faces, side_by_band, cap_start, cap_end


def _validate_output_structure(input_data: dict[str, Any], output: Any, positions: Any,
                               normals: Any, position_allowances: Any,
                               normal_allowances: Any, label: str,
                               errors: list[str]) -> None:
    if not isinstance(output, dict):
        return
    expected = _expected_counts(input_data)
    arrays = {name: output.get(name) for name in ("positions", "triangles", "normals", "faceKinds", "bands", "cells")}
    if not all(isinstance(value, list) for value in arrays.values()):
        return
    vertex_count, face_count, side_by_band, cap_start, cap_end = expected if expected is not None else (None,) * 5
    if vertex_count is not None and len(arrays["positions"]) != vertex_count:
        errors.append(f"{label}: positions count disagrees with profile/slices/poles/caps")
    for name in ("triangles", "normals", "faceKinds", "bands", "cells"):
        if face_count is not None and len(arrays[name]) != face_count:
            errors.append(f"{label}: {name} count disagrees with profile/slices/poles/caps")
    if not isinstance(positions, list) or not isinstance(normals, list):
        return
    _validate_forced_position_components(input_data, positions, position_allowances, label, errors)
    if face_count is None or vertex_count is None:
        return
    triangles, kinds, bands, cells = arrays["triangles"], arrays["faceKinds"], arrays["bands"], arrays["cells"]
    side_counts: Counter[tuple[int, int]] = Counter()
    start_cells: Counter[int] = Counter()
    end_cells: Counter[int] = Counter()
    seen_triangles: set[tuple[int, int, int]] = set()
    for face_index, triangle in enumerate(triangles):
        if not isinstance(triangle, list) or len(triangle) != 3:
            continue
        if not all(_integer(index, 0, vertex_count - 1) for index in triangle):
            errors.append(f"{label}: triangles[{face_index}] must use in-range non-boolean integer indices")
            continue
        record = tuple(int(index) for index in triangle)
        if len(set(record)) != 3:
            errors.append(f"{label}: triangles[{face_index}] must have three distinct indices")
        if record in seen_triangles:
            errors.append(f"{label}: triangles[{face_index}] duplicates an earlier triangle")
        seen_triangles.add(record)
        if face_index >= len(kinds) or face_index >= len(bands) or face_index >= len(cells):
            continue
        kind, band, cell = kinds[face_index], bands[face_index], cells[face_index]
        if not isinstance(kind, str) or kind not in {"side", "start-cap", "end-cap"}:
            errors.append(f"{label}: faceKinds[{face_index}] is not a declared kind")
            continue
        if not _integer(cell, 0, int(input_data["slices"]) - 1):
            errors.append(f"{label}: cells[{face_index}] must be a valid non-boolean cell index")
            continue
        cell_value = int(cell)
        if kind == "side":
            if not _integer(band, 0, len(input_data["profile"]) - 2):
                errors.append(f"{label}: side band must name a profile band")
            else:
                side_counts[(int(band), cell_value)] += 1
        elif not _integer(band, -1, -1):
            errors.append(f"{label}: cap band must equal -1")
        elif kind == "start-cap":
            start_cells[cell_value] += 1
        else:
            end_cells[cell_value] += 1
    for band, expected_per_cell in side_by_band.items():
        for cell in range(int(input_data["slices"])):
            if side_counts[(band, cell)] != expected_per_cell:
                errors.append(f"{label}: side metadata count for band {band}, cell {cell} is not declared count")
    expected_cap_cells = Counter(range(int(input_data["slices"])))
    if (start_cells != (expected_cap_cells if cap_start else Counter())):
        errors.append(f"{label}: start-cap metadata does not match requested positive-radius cap")
    if (end_cells != (expected_cap_cells if cap_end else Counter())):
        errors.append(f"{label}: end-cap metadata does not match requested positive-radius cap")


def _validate_success(case: dict[str, Any], op: dict[str, Any], label: str, errors: list[str]) -> None:
    if set(case) != SUCCESS_KEYS:
        errors.append(f"{label}: successful case must contain exactly id,input,output,comparison")
    input_errors = _schema_errors(op.get("input_schema"), case.get("input")) + _input_semantic_errors(case.get("input"))
    if input_errors:
        errors.extend(f"{label}: successful input invalid: {message}" for message in input_errors)
        return
    output, wrapped = _unwrap_output(case.get("output"), f"{label}.output", errors)
    output_errors = _schema_errors(op.get("output_schema"), output)
    if output_errors:
        errors.extend(f"{label}: output schema: {message}" for message in output_errors)
        return
    counts = _expected_counts(case['input'])
    if counts is None or counts[1] > case['input']['maxFaces']:
        errors.append(f"{label}: success must fit maxFaces")
        return
    if len(output['positions']) != counts[0] or any(len(output[field]) != counts[1] for field in ('triangles','normals','faceKinds','bands','cells')):
        errors.append(f"{label}: output counts disagree with input")
        return
    positions, normals = wrapped.get("positions"), wrapped.get("normals")
    position_allowances, normal_allowances = _comparison_arrays(case, positions, normals, label, errors)
    if isinstance(case.get("input"), dict):
        _validate_output_structure(case["input"], output, positions, normals,
                                   position_allowances, normal_allowances, label, errors)


def _validate_error(case: dict[str, Any], op: dict[str, Any], label: str, errors: list[str]) -> None:
    code = case.get("error")
    expected_keys = {"id", "input", "error"}
    if code == "MESH_ARITHMETIC_INVALID":
        expected_keys.add("error_detail")
    if set(case) != expected_keys:
        errors.append(f"{label}: error case has wrong fields")
    if not isinstance(code, str) or code not in ERROR_CODES:
        errors.append(f"{label}: error must be a declared constructor error")
        return
    schema_errors = _schema_errors(op.get("input_schema"), case.get("input"))
    semantic_errors = _input_semantic_errors(case.get("input"))
    if code == "INVALID_INPUT":
        if not schema_errors and not semantic_errors:
            errors.append(f"{label}: INVALID_INPUT requires schema or semantic invalidity")
        return
    if schema_errors or semantic_errors:
        errors.append(f"{label}: {code} requires complete static input validity")
        return
    if code == "FACE_LIMIT_EXCEEDED":
        expected = _expected_counts(case["input"])
        if expected is not None and expected[1] <= int(case["input"]["maxFaces"]):
            errors.append(f"{label}: FACE_LIMIT_EXCEEDED must exceed maxFaces")
        return
    detail = case.get("error_detail")
    if not isinstance(detail, dict) or set(detail) != {"faceIndex", "stage"}:
        errors.append(f"{label}: MESH_ARITHMETIC_INVALID needs exactly faceIndex,stage")
        return
    expected = _expected_counts(case["input"])
    if expected is not None and expected[1] > case['input']['maxFaces']:
        errors.append(f"{label}: face budget must fail before mesh arithmetic")
    upper = expected[1] - 1 if expected is not None else None
    if not _integer(detail.get("faceIndex"), 0, upper):
        errors.append(f"{label}: dynamic faceIndex must be an in-range non-boolean integer")
    stages = op.get("dynamic_error_stages")
    allowed_stages = set(stages) if isinstance(stages, list) else DYNAMIC_STAGES
    if not isinstance(detail.get('stage'), str) or detail.get("stage") not in allowed_stages:
        errors.append(f"{label}: dynamic stage is not declared by operation")


def validate(root: Path | str, prefix: str, op: dict[str, Any], fixture: dict[str, Any]) -> list[str]:
    """Return fixture-integrity failures; never run a mesh or normal oracle."""
    root = Path(root)
    errors: list[str] = []
    if not isinstance(op, dict):
        return [_error(prefix, "operation must be an object")]
    if not isinstance(fixture, dict):
        return [_error(prefix, "fixture must be an object")]
    required = {"operation", "version", "fixture_format", "fixture_status", "catalog_sha256", "source_bindings", "cases"}
    if set(fixture) != required:
        errors.append(_error(prefix, "fixture top-level shape differs"))
    if fixture.get("operation") != OPERATION_ID or fixture.get("operation") != op.get("id"):
        errors.append(_error(prefix, "operation must identify radial profile surface"))
    if fixture.get("version") != op.get("version"):
        errors.append(_error(prefix, "fixture version must equal operation version"))
    if fixture.get("fixture_format") != FIXTURE_FORMAT:
        errors.append(_error(prefix, "fixture_format must be radial-profile-surface-output"))
    if not isinstance(fixture.get('fixture_status'), str) or fixture.get("fixture_status") not in {"review_pending", "reviewed"}:
        errors.append(_error(prefix, "fixture_status must be review_pending or reviewed"))
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
        errors.append(_error(prefix, "source_bindings must contain exactly generator, oracle, interval, policy"))
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
        errors.append(_error(prefix, "cases must be a nonempty list"))
        return errors
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
            continue
        if has_output:
            _validate_success(case, op, label, errors)
        else:
            _validate_error(case, op, label, errors)
    return errors
