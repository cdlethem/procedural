#!/usr/bin/env python3
"""Private exact-schedule oracle for the CP9 triangulation contract draft.

This is deliberately not a library implementation.  It mirrors the draft's charged
work schedule and local active-face/incidence mutations so root can derive fixtures
without borrowing the earlier prototype's broad queue work counts.
"""
from __future__ import annotations

import hashlib
import heapq
import json
import math
import argparse
import sys
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Any, Iterable

from topology_prototype import verify_independently

ROOT = Path(__file__).resolve().parents[3]
DECISIONS = ROOT / "design/operations/cp9-triangulation-contract-decisions.md"
OUT = ROOT / ".work/cp9-contract-oracle"
POINT_LIMIT = 357_913_943
WORK_LIMIT = 9_007_199_254_740_991

Point = tuple[Fraction, Fraction]
Face = tuple[int, int, int]
Edge = tuple[int, int]


class OracleError(RuntimeError):
    code: str


class InvalidInput(OracleError):
    code = "INVALID_INPUT"


class WorkExhausted(OracleError):
    code = "WORK_LIMIT_EXCEEDED"

    def __init__(self, work_used: int, stage: str):
        super().__init__(f"work limit at {stage} after {work_used} units")
        self.work_used = work_used
        self.stage = stage


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def edge(a: int, b: int) -> Edge:
    return (a, b) if a < b else (b, a)


def orient(a: Point, b: Point, c: Point) -> Fraction:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def incircle(a: Point, b: Point, c: Point, d: Point) -> Fraction:
    adx, ady = a[0] - d[0], a[1] - d[1]
    bdx, bdy = b[0] - d[0], b[1] - d[1]
    cdx, cdy = c[0] - d[0], c[1] - d[1]
    return (
        (adx * adx + ady * ady) * (bdx * cdy - bdy * cdx)
        - (bdx * bdx + bdy * bdy) * (adx * cdy - ady * cdx)
        + (cdx * cdx + cdy * cdy) * (adx * bdy - ady * bdx)
    )


def canonical_face(points: list[Point], a: int, b: int, c: int) -> Face:
    direction = orient(points[a], points[b], points[c])
    if direction == 0:
        raise AssertionError(f"implementation defect: zero-area face {(a, b, c)}")
    raw = (a, b, c) if direction > 0 else (a, c, b)
    start = min(range(3), key=lambda index: raw[index])
    return raw[start:] + raw[:start]


def face_edges(face: Face) -> tuple[Edge, Edge, Edge]:
    return edge(face[0], face[1]), edge(face[1], face[2]), edge(face[2], face[0])


def third(face: Face, item: Edge) -> int:
    values = [vertex for vertex in face if vertex not in item]
    if len(values) != 1:
        raise AssertionError(f"implementation defect: no unique opposite for {face} / {item}")
    return values[0]


def checked_binary64(value: Any) -> float:
    if type(value) not in (int, float):
        raise InvalidInput("coordinate is not a passive finite number")
    try:
        binary = float(value)
    except (OverflowError, ValueError) as error:
        raise InvalidInput("coordinate is not a binary64 value") from error
    if not math.isfinite(binary):
        raise InvalidInput("coordinate is nonfinite")
    return binary


def static_input(config: Any) -> tuple[list[Any], int]:
    if type(config) is not dict or set(config) != {"points", "maxWork"}:
        raise InvalidInput("configuration keys must be exactly points and maxWork")
    raw_points = config["points"]
    max_work = config["maxWork"]
    if type(raw_points) is not list or len(raw_points) > POINT_LIMIT:
        raise InvalidInput("points must be a bounded list")
    if type(max_work) not in (int, float):
        raise InvalidInput("maxWork is not a bounded integer")
    try:
        work_binary = float(max_work)
    except (OverflowError, ValueError) as error:
        raise InvalidInput("maxWork is not a binary64 integer") from error
    if not math.isfinite(work_binary) or not work_binary.is_integer() or not 0 <= work_binary <= WORK_LIMIT:
        raise InvalidInput("maxWork is not a bounded integer")
    # This is a validation scan only. It deliberately does not retain a per-point
    # Fraction buffer before the draft's atomic canonicalize charge.
    for pair in raw_points:
        if type(pair) is not list or len(pair) != 2:
            raise InvalidInput("point is not a two-element pair")
        checked_binary64(pair[0])
        checked_binary64(pair[1])
    return raw_points, int(work_binary)


def materialize_points(raw_points: list[Any]) -> list[Point]:
    # The post-charge owned canonicalization buffers use exact values of the already
    # validated binary64 coordinates. Fraction.from_float also canonicalizes -0.0.
    return [(Fraction.from_float(checked_binary64(pair[0])), Fraction.from_float(checked_binary64(pair[1]))) for pair in raw_points]


@dataclass
class FaceNode:
    face: Face
    previous: int | None
    following: int | None
    alive: bool = True


class ActiveFaces:
    """Creation-ordered linked sequence with local O(1) removal and append."""

    def __init__(self, points: list[Point]) -> None:
        self.points = points
        self.nodes: dict[int, FaceNode] = {}
        self.head: int | None = None
        self.tail: int | None = None
        self.next_id = 0
        self.incidence: dict[Edge, set[int]] = {}

    def append(self, faces: Iterable[Face]) -> list[int]:
        ids: list[int] = []
        for face in sorted(faces):
            node_id = self.next_id
            self.next_id += 1
            node = FaceNode(face, self.tail, None)
            self.nodes[node_id] = node
            if self.tail is None:
                self.head = node_id
            else:
                self.nodes[self.tail].following = node_id
            self.tail = node_id
            for item in face_edges(face):
                owners = self.incidence.setdefault(item, set())
                owners.add(node_id)
                if len(owners) > 2:
                    raise AssertionError(f"implementation defect: nonmanifold edge {item}")
            ids.append(node_id)
        return ids

    def remove(self, node_id: int) -> None:
        node = self.nodes[node_id]
        if not node.alive:
            raise AssertionError(f"implementation defect: double removal {node_id}")
        for item in face_edges(node.face):
            owners = self.incidence[item]
            owners.remove(node_id)
            if not owners:
                del self.incidence[item]
        if node.previous is None:
            self.head = node.following
        else:
            self.nodes[node.previous].following = node.following
        if node.following is None:
            self.tail = node.previous
        else:
            self.nodes[node.following].previous = node.previous
        node.alive = False
        del self.nodes[node_id]

    def creation_order(self) -> Iterable[int]:
        current = self.head
        while current is not None:
            yield current
            current = self.nodes[current].following

    def faces(self) -> list[Face]:
        return [self.nodes[node_id].face for node_id in self.creation_order()]

    def replace(self, old: Iterable[int], new: Iterable[Face]) -> list[int]:
        for node_id in sorted(set(old)):
            self.remove(node_id)
        return self.append(new)


class Budget:
    def __init__(self, maximum: int) -> None:
        self.maximum = maximum
        self.used = 0
        self.trace: list[dict[str, int | str]] = []

    def charge(self, stage: str, amount: int = 1) -> None:
        if amount > self.maximum - self.used:
            raise WorkExhausted(self.used, stage)
        before = self.used
        self.used += amount
        self.trace.append({"stage": stage, "before": before, "after": self.used, "cost": amount})


def canonicalize(raw: list[Point]) -> tuple[list[Point], list[int], list[int]]:
    groups: dict[Point, list[int]] = {}
    for source, point in enumerate(raw):
        groups.setdefault(point, []).append(source)
    points = sorted(groups)
    point_to_vertex = {point: index for index, point in enumerate(points)}
    return points, [point_to_vertex[point] for point in raw], [groups[point][0] for point in points]


def strict_hull(points: list[Point], budget: Budget) -> list[int]:
    def chain(indices: Iterable[int], stage: str) -> list[int]:
        result: list[int] = []
        for vertex in indices:
            while len(result) >= 2:
                budget.charge(stage)
                if orient(points[result[-2]], points[result[-1]], points[vertex]) <= 0:
                    result.pop()
                else:
                    break
            result.append(vertex)
        return result

    lower = chain(range(len(points)), "hull_lower")
    upper = chain(reversed(range(len(points))), "hull_upper")
    return lower[:-1] + upper[:-1]


def containing_signs(points: list[Point], face: Face, site: int) -> tuple[Fraction, Fraction, Fraction]:
    a, b, c = face
    point = points[site]
    return orient(points[a], points[b], point), orient(points[b], points[c], point), orient(points[c], points[a], point)


def insert_site(points: list[Point], active: ActiveFaces, site: int, budget: Budget, trace: list[dict[str, Any]]) -> None:
    found: int | None = None
    signs: tuple[Fraction, Fraction, Fraction] | None = None
    for node_id in active.creation_order():
        budget.charge("locate")
        candidate = containing_signs(points, active.nodes[node_id].face, site)
        if all(value >= 0 for value in candidate):
            found, signs = node_id, candidate
            break
    if found is None or signs is None:
        raise AssertionError(f"implementation defect: no containing face for site {site}")
    zeros = [index for index, value in enumerate(signs) if value == 0]
    if not zeros:
        a, b, c = active.nodes[found].face
        appended = active.replace((found,), (
            canonical_face(points, a, b, site),
            canonical_face(points, b, c, site),
            canonical_face(points, c, a, site),
        ))
        trace.append({"site": site, "kind": "face", "visited_face": found, "appended": appended})
        return
    if len(zeros) != 1:
        raise AssertionError(f"implementation defect: distinct site has multiple zero containment signs {site}")
    face = active.nodes[found].face
    boundary = face_edges(face)[zeros[0]]
    owners = sorted(active.incidence[boundary])
    if len(owners) not in (1, 2):
        raise AssertionError(f"implementation defect: edge incidence {boundary} has {owners}")
    replacement: list[Face] = []
    for owner in owners:
        other = third(active.nodes[owner].face, boundary)
        replacement.extend((
            canonical_face(points, boundary[0], site, other),
            canonical_face(points, site, boundary[1], other),
        ))
    appended = active.replace(owners, replacement)
    trace.append({"site": site, "kind": "boundary-edge" if len(owners) == 1 else "internal-edge", "edge": list(boundary), "visited_face": found, "appended": appended})


def queue_add(heap: list[Edge], queued: set[Edge], item: Edge) -> None:
    if item not in queued:
        heapq.heappush(heap, item)
        queued.add(item)


def legalize(points: list[Point], active: ActiveFaces, budget: Budget, trace: list[dict[str, Any]]) -> None:
    heap: list[Edge] = []
    queued: set[Edge] = set()
    for item, owners in sorted(active.incidence.items()):
        if len(owners) == 2:
            queue_add(heap, queued, item)
    while heap:
        budget.charge("legalize")
        item = heapq.heappop(heap)
        queued.remove(item)
        owners = active.incidence.get(item)
        if owners is None or len(owners) != 2:
            trace.append({"edge": list(item), "kind": "stale-or-boundary"})
            continue
        first_id, second_id = sorted(owners)
        first, second = active.nodes[first_id].face, active.nodes[second_id].face
        opposite_first, opposite_second = third(first, item), third(second, item)
        if orient(points[item[0]], points[item[1]], points[opposite_first]) > 0:
            left, right = opposite_first, opposite_second
        else:
            left, right = opposite_second, opposite_first
        if orient(points[item[0]], points[item[1]], points[left]) <= 0 or orient(points[item[0]], points[item[1]], points[right]) >= 0:
            raise AssertionError(f"implementation defect: inconsistent local sides for {item}")
        if orient(points[left], points[right], points[item[0]]) * orient(points[left], points[right], points[item[1]]) >= 0:
            trace.append({"edge": list(item), "kind": "nonflippable"})
            continue
        determinant = incircle(points[item[0]], points[item[1]], points[left], points[right])
        replacement_edge = edge(left, right)
        reason: str | None = None
        if determinant > 0:
            reason = "strict-incircle"
        elif determinant == 0 and replacement_edge < item:
            reason = "cocircular-lex"
        if reason is None:
            trace.append({"edge": list(item), "kind": "kept"})
            continue
        appended = active.replace((first_id, second_id), (
            canonical_face(points, left, right, item[0]),
            canonical_face(points, right, left, item[1]),
        ))
        for node_id in appended:
            for new_edge in face_edges(active.nodes[node_id].face):
                if len(active.incidence[new_edge]) == 2:
                    queue_add(heap, queued, new_edge)
        trace.append({"edge": list(item), "replacement": list(replacement_edge), "kind": reason, "appended": appended})


def output(points: list[Point], input_to_vertex: list[int], source_indices: list[int], active: ActiveFaces, work: Budget, hull: list[int], insertion_trace: list[dict[str, Any]], flip_trace: list[dict[str, Any]]) -> dict[str, Any]:
    triangles = sorted(active.faces())
    face_index = {face: index for index, face in enumerate(triangles)}
    edges: list[Edge] = sorted(active.incidence)
    edge_faces: list[list[int]] = []
    for item in edges:
        faces = sorted(face_index[active.nodes[node_id].face] for node_id in active.incidence[item])
        edge_faces.append([faces[0], faces[1]] if len(faces) == 2 else [faces[0], -1])
    # Reuse the earlier prototype only for independent geometry verification, never its construction or work accounting.
    verification = verify_independently(points, hull, triangles, True)
    return {
        "points": [point_json(point) for point in points],
        "inputToVertex": input_to_vertex,
        "sourceIndices": source_indices,
        "triangles": [list(face) for face in triangles],
        "edges": [list(item) for item in edges],
        "edgeFaces": edge_faces,
        "workUsed": work.used,
        "workTrace": work.trace,
        "insertionTrace": insertion_trace,
        "legalizationTrace": flip_trace,
        "geometryVerification": verification,
    }


def triangulate(config: Any) -> dict[str, Any]:
    raw_points, max_work = static_input(config)
    budget = Budget(max_work)
    budget.charge("canonicalize", len(raw_points))
    points, input_to_vertex, source_indices = canonicalize(materialize_points(raw_points))
    if len(points) < 3:
        return empty_output(points, input_to_vertex, source_indices, budget)
    hull = strict_hull(points, budget)
    if len(hull) < 3:
        return empty_output(points, input_to_vertex, source_indices, budget)
    active = ActiveFaces(points)
    root = hull[0]
    active.append(canonical_face(points, root, hull[index], hull[index + 1]) for index in range(1, len(hull) - 1))
    insertion_trace: list[dict[str, Any]] = []
    corners = set(hull)
    for site in range(len(points)):
        if site not in corners:
            insert_site(points, active, site, budget, insertion_trace)
    legalization_trace: list[dict[str, Any]] = []
    legalize(points, active, budget, legalization_trace)
    return output(points, input_to_vertex, source_indices, active, budget, hull, insertion_trace, legalization_trace)


def empty_output(points: list[Point], input_to_vertex: list[int], source_indices: list[int], budget: Budget) -> dict[str, Any]:
    return {
        "points": [point_json(point) for point in points],
        "inputToVertex": input_to_vertex,
        "sourceIndices": source_indices,
        "triangles": [],
        "edges": [],
        "edgeFaces": [],
        "workUsed": budget.used,
        "workTrace": budget.trace,
        "insertionTrace": [],
        "legalizationTrace": [],
        "geometryVerification": {"two_dimensional": False, "vertices": len(points), "faces": 0, "edges": 0},
    }


def fraction_text(value: Fraction) -> str:
    return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"


def point_json(point: Point) -> list[str]:
    return [fraction_text(point[0]), fraction_text(point[1])]


def coordinate_topology(result: dict[str, Any]) -> list[list[list[str]]]:
    return sorted(sorted(result["points"][vertex] for vertex in triangle) for triangle in result["triangles"])


def json_safe(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return "NaN" if math.isnan(value) else "Infinity" if value > 0 else "-Infinity"
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [json_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    return value


def attempt(case_id: str, config: Any) -> dict[str, Any]:
    input_for_report = json_safe(config)
    try:
        result = triangulate(config)
        return {"id": case_id, "status": "success", "input": input_for_report, "output": result}
    except WorkExhausted as error:
        return {"id": case_id, "status": "error", "input": input_for_report, "error": error.code, "error_detail": {"workUsed": error.work_used, "stage": error.stage}}
    except InvalidInput as error:
        return {"id": case_id, "status": "error", "input": input_for_report, "error": error.code}


def known_config(max_work: int) -> dict[str, Any]:
    # Includes hull-edge and internal-edge insertion, strict flips, and enough scan work for every stage.
    return {"points": [[0.0, 0.0], [2.0, 0.0], [4.0, 0.0], [4.0, 2.0], [4.0, 4.0], [2.0, 4.0], [0.0, 4.0], [0.0, 2.0], [2.0, 2.0]], "maxWork": max_work}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUT / "report-review1", help="new ignored directory for this oracle report")
    args = parser.parse_args()
    output_directory = args.output.resolve()
    try:
        output_directory.relative_to(ROOT)
    except ValueError as error:
        raise SystemExit("output must remain inside the repository") from error
    report = output_directory / "report.json"
    if report.exists():
        raise SystemExit("refusing to overwrite existing oracle report: " + str(report))
    base = attempt("known-geometry", known_config(WORK_LIMIT))
    if base["status"] != "success":
        raise AssertionError(base)
    result = base["output"]
    assert isinstance(result, dict)
    trace = result["workTrace"]
    assert isinstance(trace, list)
    first_stage_charge: dict[str, dict[str, int | str]] = {}
    for event in trace:
        first_stage_charge.setdefault(str(event["stage"]), event)
    expected_stages = ("canonicalize", "hull_lower", "hull_upper", "locate", "legalize")
    if tuple(first_stage_charge) != expected_stages:
        raise AssertionError(f"unexpected reachable stages: {tuple(first_stage_charge)}")
    threshold = int(result["workUsed"])
    exact = attempt("known-exact-budget", known_config(threshold))
    short = attempt("known-one-short-total", known_config(threshold - 1))
    if exact["status"] != "success" or short.get("error") != "WORK_LIMIT_EXCEEDED":
        raise AssertionError("exact total threshold did not distinguish success/failure")
    integral_float_budget = attempt("integral-float-maxwork", known_config(float(threshold)))
    if integral_float_budget["status"] != "success" or integral_float_budget["output"]["workUsed"] != threshold:
        raise AssertionError("integral floating maxWork carrier did not match integer carrier")
    stage_witnesses: list[dict[str, Any]] = []
    for stage in expected_stages:
        event = first_stage_charge[stage]
        maximum = int(event["after"]) - 1
        witness = attempt("one-short-" + stage, known_config(maximum))
        if witness.get("error_detail", {}).get("stage") != stage:
            raise AssertionError(f"one-short witness misses {stage}: {witness}")
        stage_witnesses.append(witness)
    duplicate = attempt("duplicates-and-mappings", {
        "points": [[0.0, 0.0], [4.0, 0.0], [0.0, 4.0], [4.0, 4.0], [2.0, 2.0], [0.0, -0.0], [2.0, 2.0], [4.0, 0.0]],
        "maxWork": WORK_LIMIT,
    })
    if duplicate["status"] != "success":
        raise AssertionError(duplicate)
    duplicate_output = duplicate["output"]
    assert isinstance(duplicate_output, dict)
    base_points = duplicate["input"]["points"]
    permutations: list[dict[str, Any]] = []
    expected_topology = coordinate_topology(duplicate_output)
    for label, points in (("reversed", list(reversed(base_points))), ("rotated", base_points[3:] + base_points[:3]), ("sorted", sorted(base_points))):
        observed = attempt("duplicate-" + label, {"points": points, "maxWork": WORK_LIMIT})
        if observed["status"] != "success":
            raise AssertionError(observed)
        candidate = observed["output"]
        assert isinstance(candidate, dict)
        same = coordinate_topology(candidate) == expected_topology
        if not same:
            raise AssertionError("permuted duplicate topology differs")
        permutations.append({"id": label, "same_coordinate_topology": same, "inputToVertex": candidate["inputToVertex"], "sourceIndices": candidate["sourceIndices"]})
    cocircular_tie = attempt("cocircular-tie-flip", {
        "points": [[0.0, 0.0], [0.0, 1.0], [0.0, 2.0], [1.0, 2.0], [2.0, 2.0]],
        "maxWork": WORK_LIMIT,
    })
    if cocircular_tie["status"] != "success" or not any(event.get("kind") == "cocircular-lex" for event in cocircular_tie["output"]["legalizationTrace"]):
        raise AssertionError("cocircular tie did not exercise the declared lexicographic flip")
    collinear = attempt("all-collinear", {"points": [[float(index), 0.0] for index in range(8)], "maxWork": WORK_LIMIT})
    empty = attempt("empty", {"points": [], "maxWork": 0})
    invalid_precedence = attempt("invalid-before-budget", {"points": [[0.0, 0.0], [float("nan"), 1.0]], "maxWork": 0})
    for value in (collinear, empty):
        if value["status"] != "success" or value["output"]["triangles"] or value["output"]["edges"]:
            raise AssertionError(value)
    if invalid_precedence.get("error") != "INVALID_INPUT":
        raise AssertionError(invalid_precedence)
    payload = {
        "status": "passed",
        "scope": "Private exact Fraction-from-binary64 work-schedule oracle. It is not public core, a frozen fixture, a rendering result, or a portability claim.",
        "source_bindings": {
            "oracle": {"path": str(Path(__file__).relative_to(ROOT)), "sha256": digest(Path(__file__))},
            "decision_draft": {"path": str(DECISIONS.relative_to(ROOT)), "sha256": digest(DECISIONS)},
            "geometry_verifier": {"path": "tools/diagnostics/cp9/topology_prototype.py", "sha256": digest(ROOT / "tools/diagnostics/cp9/topology_prototype.py")},
        },
        "schedule": "atomic N canonicalize charge; charged hull tests; stop-first active-face locate; local incidence mutation; lexicographic set queue with local re-enqueue only",
        "report_revision": "review1: charge-before-pop, post-charge Fraction materialization, dead-node removal, integral floating maxWork carrier",
        "known_geometry": base,
        "exact_budget": {"threshold": threshold, "at_threshold": exact, "one_short_total": short},
        "integral_float_budget": integral_float_budget,
        "one_short_stage_witnesses": stage_witnesses,
        "duplicates_and_mappings": duplicate,
        "permutations": permutations,
        "cocircular_tie": cocircular_tie,
        "collinear": collinear,
        "empty": empty,
        "invalid_before_budget": invalid_precedence,
    }
    output_directory.mkdir(parents=True, exist_ok=False)
    report.write_text(json.dumps(payload, indent=2, sort_keys=True, allow_nan=False) + "\n")
    print(json.dumps({"status": "passed", "report": str(report.relative_to(ROOT)), "known_work": threshold, "stages": list(first_stage_charge)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
