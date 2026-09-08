#!/usr/bin/env python3
"""Draft structural checker for ``delaunay-output`` fixture records.

This checker deliberately does not execute the CP9 insertion/legalization work
schedule.  ``workUsed`` and work-limit goldens remain bound to their authored
oracle evidence.  It does independently validate the serialized triangulation
against exact Fractions made from the supplied binary64 values.

``tools/check_catalog.py`` has a deferred hook for this format, but no CP9
catalog record is promoted yet; this tool validates the current draft directly.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import struct
import sys
from collections import defaultdict
from fractions import Fraction
from itertools import permutations
from pathlib import Path
from typing import Any, Iterable

from jsonschema import Draft202012Validator

OPERATION_ID = "topology.delaunay-2d"
FIXTURE_FORMAT = "delaunay-output"
MAX_VERTICES = 357_913_943
MAX_WORK = 9_007_199_254_740_991
SHA256 = re.compile(r"^[0-9a-f]{64}$")
WORK_STAGES = {"canonicalize", "hull_lower", "hull_upper", "locate", "legalize"}
SUCCESS_KEYS = {
    "points", "inputToVertex", "sourceIndices", "triangles", "edges", "edgeFaces", "workUsed"
}


def _error(prefix: str, message: str) -> str:
    return f"{prefix}: {message}" if prefix else message


def _finite(value: Any) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _integer(value: Any, low: int | None = None, high: int | None = None) -> bool:
    if not _finite(value):
        return False
    numeric = float(value)
    if not numeric.is_integer():
        return False
    return (low is None or value >= low) and (high is None or value <= high)


def _canonical(value: Any) -> bool:
    return _finite(value) and (value != 0 or math.copysign(1.0, float(value)) > 0)


def _bits(value: Any) -> str | None:
    if not _canonical(value):
        return None
    return struct.pack(">d", float(value)).hex()


def _normal_zero(value: float | int) -> float:
    return 0.0 if value == 0 else float(value)


def _fraction(value: float | int) -> Fraction:
    return Fraction.from_float(_normal_zero(value))


def _sha(path: Path) -> str:
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
    staged = op.get("_catalog_path")
    if staged is not None:
        return _safe_path(root, staged)
    name = op.get("_file")
    if isinstance(name, str) and name and "/" not in name and "\\" not in name and not Path(name).is_absolute():
        return root / "catalog" / "operations" / name
    return root / "catalog" / "operations" / "delaunay-2d.json"


def _schema_errors(schema: Any, value: Any) -> list[str]:
    if not isinstance(schema, dict):
        return ["operation lacks a schema"]
    try:
        return [item.message for item in Draft202012Validator(schema).iter_errors(value)]
    except Exception as exc:
        return [f"invalid schema: {exc}"]


def _recursive_finite(value: Any) -> bool:
    if isinstance(value, dict):
        return all(_recursive_finite(item) for item in value.values())
    if isinstance(value, list):
        return all(_recursive_finite(item) for item in value)
    return not isinstance(value, (int, float)) or isinstance(value, bool) or _finite(value)


def _input_semantic_errors(value: Any) -> list[str]:
    """Static rules whose JSON schema does not express finite binary64 values."""
    if not isinstance(value, dict):
        return []
    errors: list[str] = []
    if not _recursive_finite(value):
        errors.append("input contains a nonfinite number")
    points = value.get("points")
    if isinstance(points, list):
        for index, point in enumerate(points):
            if not isinstance(point, list) or len(point) != 2:
                continue
            for axis, coordinate in enumerate(point):
                if not _finite(coordinate):
                    errors.append(f"points[{index}][{axis}] must be a finite non-boolean number")
    max_work = value.get("maxWork")
    if max_work is not None and not _integer(max_work, 0, MAX_WORK):
        errors.append("maxWork must be a finite non-boolean safe integer")
    return errors


def _orient(points: list[tuple[Fraction, Fraction]], a: int, b: int, c: int) -> Fraction:
    ax, ay = points[a]
    bx, by = points[b]
    cx, cy = points[c]
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)


def _incircle(points: list[tuple[Fraction, Fraction]], a: int, b: int, c: int, d: int) -> Fraction:
    """Lifted 4x4 determinant, independently expanded by permutations.

    This intentionally differs from the schedule prototype's translated
    three-by-three expression.  For positive orientation ``a,b,c``, a positive
    result places ``d`` strictly inside their circumcircle.
    """
    matrix: list[list[Fraction]] = []
    for index in (a, b, c, d):
        x, y = points[index]
        matrix.append([x, y, x * x + y * y, Fraction(1)])
    total = Fraction(0)
    for order in permutations(range(4)):
        inversions = sum(order[left] > order[right] for left in range(4) for right in range(left + 1, 4))
        product = Fraction(1)
        for row, column in enumerate(order):
            product *= matrix[row][column]
        total += -product if inversions % 2 else product
    return total


def _hull(points: list[tuple[Fraction, Fraction]]) -> list[int]:
    """Strict convex hull through an exact gift-wrap, not the schedule's chain.

    Collinear intermediate sites are skipped by selecting the farthest candidate
    on a tied supporting line.  Returned order is counter-clockwise when the
    set is two-dimensional, and has one/two endpoints otherwise.
    """
    if len(points) < 2:
        return list(range(len(points)))
    start = min(range(len(points)), key=lambda index: points[index])
    hull = [start]
    current = start
    while True:
        candidate = next(index for index in range(len(points)) if index != current)
        for index in range(len(points)):
            if index == current or index == candidate:
                continue
            turn = _orient(points, current, candidate, index)
            if turn < 0:
                candidate = index
            elif turn == 0:
                cx, cy = points[candidate]
                ix, iy = points[index]
                px, py = points[current]
                if (ix - px) * (ix - px) + (iy - py) * (iy - py) > (cx - px) * (cx - px) + (cy - py) * (cy - py):
                    candidate = index
        if candidate == start:
            break
        hull.append(candidate)
        current = candidate
    return hull


def _area2(points: list[tuple[Fraction, Fraction]], polygon: Iterable[int]) -> Fraction:
    ordered = list(polygon)
    if len(ordered) < 3:
        return Fraction(0)
    return sum(
        points[ordered[index]][0] * points[ordered[(index + 1) % len(ordered)]][1]
        - points[ordered[index]][1] * points[ordered[(index + 1) % len(ordered)]][0]
        for index in range(len(ordered))
    )


def _segments_intersect(points: list[tuple[Fraction, Fraction]], a: int, b: int, c: int, d: int) -> bool:
    """Inclusive exact intersection for two edges with no shared endpoint."""
    o1, o2 = _orient(points, a, b, c), _orient(points, a, b, d)
    o3, o4 = _orient(points, c, d, a), _orient(points, c, d, b)

    def on_segment(left: int, right: int, site: int) -> bool:
        lx, ly = points[left]
        rx, ry = points[right]
        sx, sy = points[site]
        return min(lx, rx) <= sx <= max(lx, rx) and min(ly, ry) <= sy <= max(ly, ry)

    if o1 == 0 and on_segment(a, b, c):
        return True
    if o2 == 0 and on_segment(a, b, d):
        return True
    if o3 == 0 and on_segment(c, d, a):
        return True
    if o4 == 0 and on_segment(c, d, b):
        return True
    return (o1 > 0) != (o2 > 0) and (o3 > 0) != (o4 > 0)


def _valid_index(value: Any, upper: int) -> bool:
    return _integer(value, 0, upper - 1)


def _validate_input_output_mapping(case: dict[str, Any], label: str, errors: list[str]) -> tuple[list[tuple[Fraction, Fraction]], list[list[Any]]] | None:
    input_data, output = case.get("input"), case.get("output")
    if not isinstance(input_data, dict) or not isinstance(output, dict):
        return None
    input_points = input_data.get("points")
    output_points = output.get("points")
    if not isinstance(input_points, list) or not isinstance(output_points, list):
        return None
    parsed_input: list[tuple[float, float]] = []
    for point in input_points:
        if not isinstance(point, list) or len(point) != 2 or not all(_finite(v) for v in point):
            return None
        parsed_input.append((_normal_zero(point[0]), _normal_zero(point[1])))
    expected_points = sorted(set(parsed_input), key=lambda item: (item[0], item[1]))
    if len(output_points) != len(expected_points):
        errors.append(_error(label, "output points must contain every canonical unique input point exactly once"))
        return None
    for index, (actual, expected) in enumerate(zip(output_points, expected_points)):
        if not isinstance(actual, list) or len(actual) != 2 or not all(_canonical(item) for item in actual):
            errors.append(_error(label, f"output.points[{index}] must be a finite canonical pair"))
            continue
        if any(_bits(actual[axis]) != _bits(expected[axis]) for axis in range(2)):
            errors.append(_error(label, f"output.points[{index}] must exactly copy sorted canonical input coordinates"))
    lookup = {point: index for index, point in enumerate(expected_points)}
    expected_mapping = [lookup[point] for point in parsed_input]
    expected_sources: list[int] = []
    for point in expected_points:
        expected_sources.append(next(index for index, candidate in enumerate(parsed_input) if candidate == point))
    mapping, sources = output.get("inputToVertex"), output.get("sourceIndices")
    if mapping != expected_mapping:
        errors.append(_error(label, "inputToVertex must exactly map every input record to its canonical vertex"))
    if sources != expected_sources:
        errors.append(_error(label, "sourceIndices must identify each canonical vertex's first input record"))
    return [(_fraction(x), _fraction(y)) for x, y in expected_points], output_points


def _validate_topology(points: list[tuple[Fraction, Fraction]], output: dict[str, Any], label: str, errors: list[str]) -> None:
    triangles, edges, edge_faces = output.get("triangles"), output.get("edges"), output.get("edgeFaces")
    if not isinstance(triangles, list) or not isinstance(edges, list) or not isinstance(edge_faces, list):
        return
    vertex_count = len(points)
    parsed_triangles: list[tuple[int, int, int]] = []
    for index, triple in enumerate(triangles):
        if not isinstance(triple, list) or len(triple) != 3 or not all(_valid_index(item, vertex_count) for item in triple):
            errors.append(_error(label, f"triangles[{index}] must be an in-range non-boolean triple"))
            continue
        a, b, c = (int(item) for item in triple)
        if len({a, b, c}) != 3:
            errors.append(_error(label, f"triangles[{index}] must use three distinct vertices"))
            continue
        if a != min(a, b, c):
            errors.append(_error(label, f"triangles[{index}] must rotate its minimum vertex to index zero"))
        if _orient(points, a, b, c) <= 0:
            errors.append(_error(label, f"triangles[{index}] must be strictly positive orientation"))
        parsed_triangles.append((a, b, c))
    if parsed_triangles != sorted(parsed_triangles):
        errors.append(_error(label, "triangles must be lexicographically sorted after canonical rotation"))
    if len(set(parsed_triangles)) != len(parsed_triangles):
        errors.append(_error(label, "triangles must be unique"))

    hull = _hull(points)
    two_dimensional = len(hull) >= 3
    if not two_dimensional:
        if parsed_triangles or edges or edge_faces:
            errors.append(_error(label, "fewer than three hull corners must retain no triangles, edges, or incidence"))
        return
    if any(_orient(points, hull[0], hull[1], index) != 0 for index in range(vertex_count)) and len(parsed_triangles) == 0:
        errors.append(_error(label, "two-dimensional sites require faces"))
    used = {vertex for face in parsed_triangles for vertex in face}
    if used != set(range(vertex_count)):
        errors.append(_error(label, "every canonical vertex must participate in a two-dimensional triangulation"))

    incidence: dict[tuple[int, int], list[int]] = defaultdict(list)
    for face_index, (a, b, c) in enumerate(parsed_triangles):
        for left, right in ((a, b), (b, c), (c, a)):
            incidence[(min(left, right), max(left, right))].append(face_index)
    expected_edges = sorted(incidence)
    if edges != [list(edge) for edge in expected_edges]:
        errors.append(_error(label, "edges must be the unique lexicographically sorted face-edge pairs"))
    expected_edge_faces = [[*sorted(incidence[edge]), -1] if len(incidence[edge]) == 1 else sorted(incidence[edge])
                           for edge in expected_edges]
    # Boundary uses [face,-1]; internal has exactly two increasing face IDs.
    normalized_expected: list[list[int]] = []
    for incident in expected_edge_faces:
        normalized_expected.append(incident if len(incident) == 2 else [incident[0], -1])
    if edge_faces != normalized_expected:
        errors.append(_error(label, "edgeFaces must exactly parallel sorted edges with canonical final-face incidence"))
    for edge, faces in incidence.items():
        if len(faces) not in {1, 2}:
            errors.append(_error(label, f"edge {edge} must have one boundary or two internal incidences"))

    boundary = {edge for edge, faces in incidence.items() if len(faces) == 1}
    boundary_degree: dict[int, int] = defaultdict(int)
    for left, right in boundary:
        boundary_degree[left] += 1
        boundary_degree[right] += 1
    boundary_vertices = set(boundary_degree)
    if any(degree != 2 for degree in boundary_degree.values()):
        errors.append(_error(label, "each boundary vertex must have exactly two boundary incidences"))
    if boundary:
        pending = {next(iter(boundary_vertices))}
        visited: set[int] = set()
        adjacency: dict[int, set[int]] = defaultdict(set)
        for left, right in boundary:
            adjacency[left].add(right)
            adjacency[right].add(left)
        while pending:
            vertex = pending.pop()
            if vertex in visited:
                continue
            visited.add(vertex)
            pending.update(adjacency[vertex] - visited)
        if visited != boundary_vertices:
            errors.append(_error(label, "boundary edges must form one closed hull cycle"))

    def lies_on_hull_side(left_vertex: int, right_vertex: int) -> bool:
        """Both boundary-edge endpoints must share one supporting hull side."""
        for side in range(len(hull)):
            left, right = hull[side], hull[(side + 1) % len(hull)]
            if _orient(points, left, right, left_vertex) != 0 or _orient(points, left, right, right_vertex) != 0:
                continue
            lx, ly = points[left]
            rx, ry = points[right]
            first_x, first_y = points[left_vertex]
            second_x, second_y = points[right_vertex]
            if (min(lx, rx) <= first_x <= max(lx, rx) and min(ly, ry) <= first_y <= max(ly, ry)
                    and min(lx, rx) <= second_x <= max(lx, rx) and min(ly, ry) <= second_y <= max(ly, ry)):
                return True
        return False

    if not set(hull) <= boundary_vertices:
        errors.append(_error(label, "every strict convex-hull corner must occur on the boundary cycle"))
    for edge in boundary:
        if not lies_on_hull_side(edge[0], edge[1]):
            errors.append(_error(label, f"boundary edge {edge} is not supported by a strict hull side"))
    boundary_count = len(boundary_vertices)
    expected_faces = 2 * vertex_count - boundary_count - 2
    expected_edges_count = 3 * vertex_count - boundary_count - 3
    if len(parsed_triangles) != expected_faces or len(incidence) != expected_edges_count:
        errors.append(_error(label, "face/edge counts must satisfy the planar full-triangulation Euler relation"))
    face_area = sum((_orient(points, *face) for face in parsed_triangles), Fraction(0))
    hull_area = _area2(points, hull)
    if face_area != hull_area:
        errors.append(_error(label, "positive face areas must exactly cover the convex-hull area"))
    for edge_index, left in enumerate(expected_edges):
        for right in expected_edges[edge_index + 1:]:
            if set(left) & set(right):
                continue
            if _segments_intersect(points, left[0], left[1], right[0], right[1]):
                errors.append(_error(label, f"unrelated edges {left} and {right} intersect or touch"))

    def strictly_inside(vertex: int, face: tuple[int, int, int]) -> bool:
        return all(_orient(points, face[index], face[(index + 1) % 3], vertex) > 0 for index in range(3))

    for first_index, first in enumerate(parsed_triangles):
        for second in parsed_triangles[first_index + 1:]:
            # Edge crossings have already been rejected.  This separately catches
            # containment/overlap that can otherwise leave every edge disjoint.
            if any(strictly_inside(vertex, second) for vertex in first if vertex not in second) or any(strictly_inside(vertex, first) for vertex in second if vertex not in first):
                errors.append(_error(label, f"faces {first} and {second} have overlapping interiors"))

    for face in parsed_triangles:
        for vertex in range(vertex_count):
            if vertex not in face and _incircle(points, face[0], face[1], face[2], vertex) > 0:
                errors.append(_error(label, f"site {vertex} lies inside face {face}'s exact circumcircle"))
    for edge, faces in incidence.items():
        if len(faces) != 2:
            continue
        opposites = []
        for face_index in faces:
            opposites.append(next(vertex for vertex in parsed_triangles[face_index] if vertex not in edge))
        left, right = opposites
        sign_left = _orient(points, edge[0], edge[1], left)
        sign_right = _orient(points, edge[0], edge[1], right)
        if sign_left == 0 or sign_right == 0 or (sign_left > 0) == (sign_right > 0):
            errors.append(_error(label, f"internal edge {edge} must have opposite vertices on distinct sides"))
            continue
        if sign_left < 0:
            left, right = right, left
        determinant = _incircle(points, edge[0], edge[1], left, right)
        alternate = tuple(sorted((left, right)))
        if determinant > 0:
            errors.append(_error(label, f"internal edge {edge} violates exact empty-circle legality"))
        elif determinant == 0 and alternate < edge:
            errors.append(_error(label, f"cocircular internal edge {edge} loses the declared lexicographic tie"))


def _validate_success(case: dict[str, Any], op: dict[str, Any], label: str, errors: list[str]) -> None:
    if set(case) != {"id", "input", "output", "comparison"}:
        errors.append(_error(label, "success case must contain exactly id,input,output,comparison"))
    input_errors = _schema_errors(op.get("input_schema"), case.get("input"))
    input_errors += _input_semantic_errors(case.get("input"))
    if input_errors:
        errors.extend(_error(label, f"success input invalid: {item}") for item in input_errors)
    output = case.get("output")
    if not isinstance(output, dict):
        errors.append(_error(label, "output must be an object"))
        return
    if set(output) != SUCCESS_KEYS:
        errors.append(_error(label, "output must contain exactly the seven declared fields"))
    schema_errors = _schema_errors(op.get("output_schema"), output)
    errors.extend(_error(label, f"output schema: {item}") for item in schema_errors)
    comparison = case.get("comparison")
    if not isinstance(comparison, dict) or set(comparison) != {"mode", "points_bits_hex"} or comparison.get("mode") != "binary64-exact":
        errors.append(_error(label, "comparison must contain binary64-exact mode and points_bits_hex"))
    else:
        references = comparison["points_bits_hex"]
        points = output.get("points")
        if not isinstance(references, list) or not isinstance(points, list) or len(references) != len(points):
            errors.append(_error(label, "points_bits_hex must align with output.points"))
        else:
            for point_index, (reference, point) in enumerate(zip(references, points)):
                if not isinstance(reference, list) or len(reference) != 2 or not isinstance(point, list) or len(point) != 2:
                    errors.append(_error(label, f"points_bits_hex[{point_index}] must be a pair aligned with output.points"))
                    continue
                for axis, bits in enumerate(reference):
                    if not isinstance(bits, str) or not re.fullmatch(r"[0-9a-f]{16}", bits) or _bits(point[axis]) != bits:
                        errors.append(_error(label, f"points_bits_hex[{point_index}][{axis}] must exactly bind the output coordinate"))
    if not _integer(output.get("workUsed"), 0, MAX_WORK):
        errors.append(_error(label, "workUsed must be a finite non-boolean safe integer"))
    input_data = case.get("input")
    if isinstance(input_data, dict) and isinstance(input_data.get("points"), list) and _integer(output.get("workUsed"), 0, MAX_WORK):
        if output["workUsed"] < len(input_data["points"]):
            errors.append(_error(label, "workUsed must include the atomic canonicalization charge for every input point"))
        if _integer(input_data.get("maxWork"), 0, MAX_WORK) and output["workUsed"] > input_data["maxWork"]:
            errors.append(_error(label, "successful workUsed cannot exceed maxWork"))
    mapping = _validate_input_output_mapping(case, label, errors)
    if mapping is not None:
        points, _ = mapping
        _validate_topology(points, output, label, errors)


def _validate_error(case: dict[str, Any], op: dict[str, Any], label: str, errors: list[str]) -> None:
    code = case.get("error")
    if code == "INVALID_INPUT":
        if set(case) != {"id", "input", "error"}:
            errors.append(_error(label, "INVALID_INPUT case must contain exactly id,input,error"))
        static = _schema_errors(op.get("input_schema"), case.get("input"))
        static += _input_semantic_errors(case.get("input"))
        if not static:
            errors.append(_error(label, "INVALID_INPUT requires a statically invalid input"))
        return
    if code != "WORK_LIMIT_EXCEEDED":
        errors.append(_error(label, "error must be INVALID_INPUT or WORK_LIMIT_EXCEEDED"))
        return
    if set(case) != {"id", "input", "error", "error_detail"}:
        errors.append(_error(label, "WORK_LIMIT_EXCEEDED case must contain exactly id,input,error,error_detail"))
    static = _schema_errors(op.get("input_schema"), case.get("input"))
    static += _input_semantic_errors(case.get("input"))
    if static:
        errors.append(_error(label, "WORK_LIMIT_EXCEEDED requires complete static input validity"))
    detail = case.get("error_detail")
    if not isinstance(detail, dict) or set(detail) != {"workUsed", "stage"}:
        errors.append(_error(label, "WORK_LIMIT_EXCEEDED requires exactly error_detail.workUsed,stage"))
        return
    if not _integer(detail.get("workUsed"), 0, MAX_WORK):
        errors.append(_error(label, "error_detail.workUsed must be a finite non-boolean safe integer"))
    declared_stages = op.get("dynamic_error_stages")
    allowed_stages = set(declared_stages) if isinstance(declared_stages, list) and all(isinstance(item, str) for item in declared_stages) else WORK_STAGES
    if not isinstance(detail.get("stage"), str) or detail.get("stage") not in allowed_stages:
        errors.append(_error(label, "error_detail.stage must be a declared work stage"))
    input_data = case.get("input")
    if isinstance(input_data, dict) and _integer(input_data.get("maxWork"), 0, MAX_WORK) and _integer(detail.get("workUsed"), 0, MAX_WORK):
        if detail["workUsed"] > input_data["maxWork"]:
            errors.append(_error(label, "workUsed cannot exceed maxWork before the rejected charge"))
        elif detail.get("stage") == "canonicalize":
            points = input_data.get("points")
            if detail["workUsed"] != 0 or not isinstance(points, list) or input_data["maxWork"] >= len(points):
                errors.append(_error(label, "canonicalize failure must retain zero work and have a budget below the input count"))
        elif detail["workUsed"] != input_data["maxWork"]:
            errors.append(_error(label, "post-canonical unit-step failure must occur exactly at maxWork"))


def _validate_bindings(root: Path, fixture: dict[str, Any], prefix: str, errors: list[str]) -> None:
    bindings = fixture.get("source_bindings")
    if not isinstance(bindings, dict) or not bindings:
        errors.append(_error(prefix, "source_bindings must be a nonempty object"))
        return
    required = {
        "design/operations/cp9-triangulation-contract-decisions.md",
        "design/operations/cp9-fixture-policy.md",
        "design/operations/cp9-capacity-and-numeric-fixtures.md",
        "tools/diagnostics/cp9/contract_oracle.py",
        "tools/diagnostics/cp9/generate_contract_fixture_draft.py",
        "tools/diagnostics/cp9/topology_prototype.py",
    }
    if not required <= set(bindings):
        errors.append(_error(prefix, "source_bindings must include the CP9 decision and fixture-policy sources"))
    for raw, digest in bindings.items():
        path = _safe_path(root, raw)
        if isinstance(raw, str) and raw.startswith(".work/"):
            errors.append(_error(prefix, f"source binding {raw!r} must not depend on ignored working output"))
        elif not isinstance(digest, str) or not SHA256.fullmatch(digest):
            errors.append(_error(prefix, f"source binding {raw!r} must have a lowercase sha256"))
        elif path is None or not path.is_file():
            errors.append(_error(prefix, f"source binding {raw!r} is missing or outside repository"))
        elif _sha(path) != digest:
            errors.append(_error(prefix, f"source binding {raw!r} is stale"))


def _case_lookup(cases: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(cases, list):
        return {}
    return {case["id"]: case for case in cases if isinstance(case, dict) and isinstance(case.get("id"), str)}


def _coordinate_topology(case: dict[str, Any]) -> tuple[Any, ...] | None:
    """Compare topology in coordinate space, independent of source input order."""
    output = case.get("output")
    if not isinstance(output, dict) or not isinstance(output.get("points"), list):
        return None
    points = output["points"]
    faces = output.get("triangles")
    edges = output.get("edges")
    if not isinstance(faces, list) or not isinstance(edges, list):
        return None
    try:
        point_keys = tuple(tuple(_bits(component) for component in point) for point in points)
        face_keys = tuple(sorted(tuple(point_keys[index] for index in face) for face in faces))
        edge_keys = tuple(sorted(tuple(sorted((point_keys[left], point_keys[right]))) for left, right in edges))
    except (IndexError, TypeError):
        return None
    return point_keys, face_keys, edge_keys


def _validate_cross_case_checks(value: Any, cases: Any, prefix: str, errors: list[str]) -> None:
    """Check only declared references; work arithmetic remains authored evidence."""
    if not isinstance(value, list) or not value:
        errors.append(_error(prefix, "cross_case_checks must be a nonempty list"))
        return
    lookup = _case_lookup(cases)
    seen: set[str] = set()
    expected_kinds = {
        "same-coordinate-topology",
        "canonical-positive-zero",
        "exact-work-threshold",
        "one-short-stage-witnesses",
    }
    for ordinal, check in enumerate(value):
        label = f"{prefix}.cross_case_checks[{ordinal}]"
        if not isinstance(check, dict) or not isinstance(check.get("id"), str) or not check["id"] or check["id"] in seen:
            errors.append(_error(label, "cross-case check id must be unique and nonempty"))
            continue
        seen.add(check["id"])
        kind = check.get("kind")
        if not isinstance(kind, str) or kind not in expected_kinds:
            errors.append(_error(label, "cross-case check kind is not declared by the draft fixture policy"))
            continue
        if kind == "same-coordinate-topology":
            ids = check.get("cases")
            if not isinstance(ids, list) or len(ids) < 2 or not all(isinstance(identifier, str) and identifier in lookup for identifier in ids):
                errors.append(_error(label, "same-coordinate-topology requires at least two known case ids"))
                continue
            records = [_coordinate_topology(lookup[identifier]) for identifier in ids]
            if any(record is None for record in records) or any(record != records[0] for record in records[1:]):
                errors.append(_error(label, "referenced cases do not have identical coordinate topology"))
        elif kind == "canonical-positive-zero":
            identifier, indexes = check.get("case"), check.get("point_indices")
            case = lookup.get(identifier) if isinstance(identifier, str) else None
            output = case.get("output") if isinstance(case, dict) else None
            points = output.get("points") if isinstance(output, dict) else None
            if not isinstance(indexes, list) or not indexes or not isinstance(points, list):
                errors.append(_error(label, "canonical-positive-zero needs a successful case and nonempty point_indices"))
                continue
            for index in indexes:
                if not _integer(index, 0, len(points) - 1) or not isinstance(points[int(index)], list) or any(_bits(component) != "0000000000000000" for component in points[int(index)]):
                    errors.append(_error(label, "referenced point must be an all-component canonical +0 point"))
        elif kind == "exact-work-threshold":
            success_id, failure_id = check.get("success_case"), check.get("failure_case")
            success = lookup.get(success_id) if isinstance(success_id, str) else None
            failure = lookup.get(failure_id) if isinstance(failure_id, str) else None
            total = check.get("work_used")
            if not _integer(total, 0, MAX_WORK) or not isinstance(success, dict) or not isinstance(failure, dict):
                errors.append(_error(label, "exact-work-threshold requires known success/failure cases and safe total"))
                continue
            success_output, failure_input, failure_detail = success.get("output"), failure.get("input"), failure.get("error_detail")
            success_input = success.get("input")
            if (not isinstance(success_output, dict) or not isinstance(success_input, dict)
                    or success_output.get("workUsed") != total or success_input.get("maxWork") != total
                    or not isinstance(failure_input, dict) or failure_input.get("maxWork") != total - 1
                    or success_input.get("points") != failure_input.get("points")
                    or failure.get("error") != "WORK_LIMIT_EXCEEDED"
                    or not isinstance(failure_detail, dict) or failure_detail.get("workUsed") != total - 1):
                errors.append(_error(label, "threshold cases must consistently declare total success and one-short failure"))
        else:
            stages, thresholds = check.get("stages"), check.get("thresholds")
            if not isinstance(stages, dict) or set(stages) != WORK_STAGES or not isinstance(thresholds, dict) or set(thresholds) != {"exact_work_used", "first_charge_after", "one_short_max_work"}:
                errors.append(_error(label, "one-short-stage-witnesses needs all stages and declared threshold maps"))
                continue
            first, short = thresholds["first_charge_after"], thresholds["one_short_max_work"]
            if not isinstance(first, dict) or not isinstance(short, dict) or set(first) != WORK_STAGES or set(short) != WORK_STAGES:
                errors.append(_error(label, "one-short-stage-witnesses threshold maps must cover every stage"))
                continue
            for stage, identifier in stages.items():
                case = lookup.get(identifier) if isinstance(identifier, str) else None
                if not isinstance(case, dict) or case.get("error") != "WORK_LIMIT_EXCEEDED" or not isinstance(case.get("input"), dict) or not isinstance(case.get("error_detail"), dict):
                    errors.append(_error(label, f"{stage} must name a work-limit case"))
                    continue
                if not _integer(first.get(stage), 0, MAX_WORK) or not _integer(short.get(stage), 0, MAX_WORK) or short[stage] != first[stage] - 1 or case["input"].get("maxWork") != short[stage] or case["error_detail"].get("stage") != stage:
                    errors.append(_error(label, f"{stage} witness does not match its declared one-short threshold"))
    kinds = [check.get("kind") for check in value if isinstance(check, dict)]
    for required_kind in expected_kinds:
        if kinds.count(required_kind) != 1:
            errors.append(_error(prefix, f"cross_case_checks must contain exactly one {required_kind} record"))


def validate(root: Path | str, prefix: str, op: dict[str, Any], fixture: dict[str, Any]) -> list[str]:
    """Return draft fixture-integrity errors without evaluating a work schedule."""
    root = Path(root)
    errors: list[str] = []
    if not isinstance(op, dict):
        return [_error(prefix, "operation must be an object")]
    if not isinstance(fixture, dict):
        return [_error(prefix, "fixture must be an object")]
    required = {
        "operation", "version", "fixture_format", "fixture_status", "catalog_sha256",
        "draft_decision_sha256", "source_bindings", "cases", "cross_case_checks", "native_only_cases", "limitations",
    }
    if set(fixture) != required:
        errors.append(_error(prefix, "fixture top-level shape differs from the CP9 draft envelope"))
    if fixture.get("operation") != OPERATION_ID or fixture.get("operation") != op.get("id"):
        errors.append(_error(prefix, "operation must identify topology.delaunay-2d"))
    if fixture.get("version") != op.get("version"):
        errors.append(_error(prefix, "fixture version must equal operation version"))
    if fixture.get("fixture_format") != FIXTURE_FORMAT:
        errors.append(_error(prefix, "fixture_format must be delaunay-output"))
    status = fixture.get("fixture_status")
    draft = isinstance(status, str) and status.startswith("draft")
    reviewed = status == "reviewed"
    if not draft and not reviewed:
        errors.append(_error(prefix, "fixture_status must be draft prose or reviewed"))
    if op.get("status") == "reviewed" and not reviewed:
        errors.append(_error(prefix, "reviewed operation requires reviewed fixtures"))
    # Draft vectors deliberately have no canonical catalog binding.  Once the
    # fixture is reviewed it must bind the canonical catalog file, never a
    # fallback design draft or an arbitrary staged source.
    catalog = _catalog_path(root, op)
    catalog_hash = fixture.get("catalog_sha256")
    if reviewed:
        canonical = root / "catalog" / "operations" / "delaunay-2d.json"
        if op.get("status") != "reviewed":
            errors.append(_error(prefix, "reviewed fixture requires a reviewed operation"))
        if catalog != canonical or not canonical.is_file():
            errors.append(_error(prefix, "reviewed fixture requires the canonical delaunay-2d catalog source"))
        if not isinstance(catalog_hash, str) or not SHA256.fullmatch(catalog_hash):
            errors.append(_error(prefix, "reviewed fixture requires a lowercase canonical catalog_sha256"))
        elif not canonical.is_file() or _sha(canonical) != catalog_hash:
            errors.append(_error(prefix, "reviewed catalog_sha256 does not bind the canonical operation source"))
    elif catalog_hash is not None:
        if not isinstance(catalog_hash, str) or not SHA256.fullmatch(catalog_hash):
            errors.append(_error(prefix, "catalog_sha256 must be null or lowercase sha256 during the draft stage"))
        elif op.get("_catalog_path") is None or catalog is None or not catalog.is_file() or _sha(catalog) != catalog_hash:
            errors.append(_error(prefix, "draft catalog_sha256 must bind an explicitly staged operation"))
    decision = root / "design" / "operations" / "cp9-triangulation-contract-decisions.md"
    digest = fixture.get("draft_decision_sha256")
    if not isinstance(digest, str) or not SHA256.fullmatch(digest):
        errors.append(_error(prefix, "draft_decision_sha256 must be lowercase sha256"))
    elif not decision.is_file() or _sha(decision) != digest:
        errors.append(_error(prefix, "draft_decision_sha256 is stale"))
    _validate_bindings(root, fixture, prefix, errors)
    limitations = fixture.get("limitations")
    if not isinstance(limitations, list) or not all(isinstance(item, str) and item for item in limitations):
        errors.append(_error(prefix, "limitations must be a list of nonempty strings"))
    native_only = fixture.get("native_only_cases")
    native_ids = [item.get("id") for item in native_only] if isinstance(native_only, list) and all(isinstance(item, dict) for item in native_only) else []
    if (not isinstance(native_only, list)
            or not all(isinstance(item, dict) and isinstance(item.get("id"), str) and item["id"] and isinstance(item.get("description"), str) and item["description"] for item in native_only)
            or len(native_ids) != len(set(native_ids))):
        errors.append(_error(prefix, "native_only_cases must contain id/description objects"))
    _validate_cross_case_checks(fixture.get("cross_case_checks"), fixture.get("cases"), prefix, errors)
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
        if not isinstance(identifier, str) or not identifier or identifier in identifiers:
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


def main(argv: list[str] | None = None) -> int:
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fixture", type=Path)
    parser.add_argument("--catalog", type=Path, default=Path("catalog/operations/delaunay-2d.json"))
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    catalog_path = args.catalog if args.catalog.is_absolute() else root / args.catalog
    fixture_path = args.fixture if args.fixture.is_absolute() else root / args.fixture
    try:
        op = json.loads(catalog_path.read_text(encoding="utf-8"))
        op["_catalog_path"] = str(catalog_path.relative_to(root))
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(json.dumps({"status": "failed", "errors": [str(exc)]}, sort_keys=True))
        return 2
    errors = validate(root, "delaunay", op, fixture)
    print(json.dumps({"status": "passed" if not errors else "failed", "errors": errors}, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
