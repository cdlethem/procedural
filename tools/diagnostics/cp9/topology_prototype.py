#!/usr/bin/env python3
"""Private exact-rational CP9 topology investigation; not a library implementation.

It prototypes the selected no-supertriangle strategy for at most 64 distinct sites:
strict-hull fan, canonical insertion, then deterministic exact edge flips.  It is
intentionally slow and uses Fraction so a failure reports a concrete witness instead
of silently substituting a floating-point epsilon.
"""
from __future__ import annotations

import argparse
import hashlib
import heapq
import json
import random
import sys
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from time import perf_counter
from typing import Iterable

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / ".work/cp9-topology"
MAX_SITES = 64
MAX_EDGE_EXAMINATIONS = 100_000

Point = tuple[Fraction, Fraction]
Face = tuple[int, int, int]
Edge = tuple[int, int]


class PrototypeFailure(RuntimeError):
    def __init__(self, message: str, witness: dict[str, object] | None = None):
        super().__init__(message)
        self.witness = witness or {}


def as_fraction(value: object) -> Fraction:
    if isinstance(value, bool):
        raise TypeError("boolean coordinate")
    if isinstance(value, Fraction):
        return value
    if isinstance(value, int):
        return Fraction(value)
    raise TypeError("private prototype accepts only integer or Fraction coordinates")


def point_key(point: Point) -> tuple[Fraction, Fraction]:
    return point


def orient(a: Point, b: Point, c: Point) -> Fraction:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def incircle(a: Point, b: Point, c: Point, d: Point) -> Fraction:
    """Determinant whose positive sign means d is inside a CCW abc circle."""
    adx, ady = a[0] - d[0], a[1] - d[1]
    bdx, bdy = b[0] - d[0], b[1] - d[1]
    cdx, cdy = c[0] - d[0], c[1] - d[1]
    alift = adx * adx + ady * ady
    blift = bdx * bdx + bdy * bdy
    clift = cdx * cdx + cdy * cdy
    return (
        alift * (bdx * cdy - bdy * cdx)
        - blift * (adx * cdy - ady * cdx)
        + clift * (adx * bdy - ady * bdx)
    )


def independent_det4(matrix: list[list[Fraction]]) -> Fraction:
    """Exact Gaussian-elimination determinant, kept out of the flip predicate."""
    work = [row[:] for row in matrix]
    value = Fraction(1)
    for column in range(4):
        pivot = next((row for row in range(column, 4) if work[row][column] != 0), None)
        if pivot is None:
            return Fraction(0)
        if pivot != column:
            work[column], work[pivot] = work[pivot], work[column]
            value = -value
        pivot_value = work[column][column]
        value *= pivot_value
        for row in range(column + 1, 4):
            factor = work[row][column] / pivot_value
            for target in range(column, 4):
                work[row][target] -= factor * work[column][target]
    return value


def independent_incircle(a: Point, b: Point, c: Point, d: Point) -> Fraction:
    """A separate 4x4 determinant oracle for the all-site verifier."""
    return independent_det4([
        [a[0], a[1], a[0] * a[0] + a[1] * a[1], Fraction(1)],
        [b[0], b[1], b[0] * b[0] + b[1] * b[1], Fraction(1)],
        [c[0], c[1], c[0] * c[0] + c[1] * c[1], Fraction(1)],
        [d[0], d[1], d[0] * d[0] + d[1] * d[1], Fraction(1)],
    ])


def sign(value: Fraction) -> int:
    return (value > 0) - (value < 0)


def edge(a: int, b: int) -> Edge:
    return (a, b) if a < b else (b, a)


def make_face(points: list[Point], a: int, b: int, c: int) -> Face:
    area = orient(points[a], points[b], points[c])
    if area == 0:
        raise PrototypeFailure("zero-area face requested", {"vertices": [a, b, c]})
    return (a, b, c) if area > 0 else (a, c, b)


def face_edges(face: Face) -> tuple[Edge, Edge, Edge]:
    return (edge(face[0], face[1]), edge(face[1], face[2]), edge(face[2], face[0]))


def third_vertex(face: Face, item: Edge) -> int:
    for vertex in face:
        if vertex not in item:
            return vertex
    raise PrototypeFailure("edge has no third vertex", {"face": list(face), "edge": list(item)})


def strictly_between(a: Point, b: Point, p: Point) -> bool:
    return a != p and b != p and orient(a, b, p) == 0 and (
        min(a[0], b[0]) <= p[0] <= max(a[0], b[0]
        ) and min(a[1], b[1]) <= p[1] <= max(a[1], b[1])
    )


def strict_hull(points: list[Point]) -> list[int]:
    """CCW strict corners; collinear edge sites are deliberately omitted."""
    ids = list(range(len(points)))
    if len(ids) < 3:
        return ids

    def build(sequence: Iterable[int]) -> list[int]:
        chain: list[int] = []
        for index in sequence:
            while len(chain) >= 2 and orient(points[chain[-2]], points[chain[-1]], points[index]) <= 0:
                chain.pop()
            chain.append(index)
        return chain

    lower = build(ids)
    upper = build(reversed(ids))
    return lower[:-1] + upper[:-1]


def independent_hull(points: list[Point]) -> list[int]:
    """Gift wrapping, deliberately separate from the prototype's monotonic chain."""
    if len(points) < 3:
        return list(range(len(points)))
    start = min(range(len(points)), key=lambda index: point_key(points[index]))
    hull = [start]
    current = start
    while True:
        candidate = next(index for index in range(len(points)) if index != current)
        for test in range(len(points)):
            if test == current or test == candidate:
                continue
            turn = orient(points[current], points[candidate], points[test])
            if turn < 0 or (turn == 0 and squared_distance(points[current], points[test]) > squared_distance(points[current], points[candidate])):
                candidate = test
        if candidate == start:
            break
        if candidate in hull:
            return []
        hull.append(candidate)
        current = candidate
        if len(hull) > len(points):
            return []
    return hull


def squared_distance(a: Point, b: Point) -> Fraction:
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2


def independent_supporting_segments(points: list[Point]) -> list[tuple[int, int]]:
    """All hull-supporting point pairs; no dependence on the construction's hull."""
    segments: list[tuple[int, int]] = []
    for a in range(len(points)):
        for b in range(a + 1, len(points)):
            sides = {sign(orient(points[a], points[b], point)) for point in points}
            if not (sides <= {0, 1} or sides <= {0, -1}):
                continue
            segments.append((a, b))
    return segments


def polygon_area2(points: list[Point], hull: list[int]) -> Fraction:
    return sum(
        points[hull[index]][0] * points[hull[(index + 1) % len(hull)]][1]
        - points[hull[index]][1] * points[hull[(index + 1) % len(hull)]][0]
        for index in range(len(hull))
    )


def canonicalize(raw: list[tuple[object, object]]) -> tuple[list[Point], dict[Point, list[int]]]:
    records: dict[Point, list[int]] = {}
    for input_index, value in enumerate(raw):
        point = (as_fraction(value[0]), as_fraction(value[1]))
        records.setdefault(point, []).append(input_index)
    points = sorted(records, key=point_key)
    return points, {point: records[point] for point in points}


def state_key(faces: list[Face]) -> tuple[tuple[int, int, int], ...]:
    return tuple(sorted(tuple(sorted(face)) for face in faces))


def edge_incidence(faces: list[Face]) -> dict[Edge, list[int]]:
    result: dict[Edge, list[int]] = {}
    for index, face in enumerate(faces):
        for item in face_edges(face):
            result.setdefault(item, []).append(index)
    return result


def point_in_face_or_edge(points: list[Point], face: Face, point: Point) -> bool:
    a, b, c = (points[value] for value in face)
    return orient(a, b, point) >= 0 and orient(b, c, point) >= 0 and orient(c, a, point) >= 0


def insert_site(points: list[Point], faces: list[Face], site: int, trace: list[dict[str, object]]) -> list[Face]:
    point = points[site]
    containing = [index for index, face in enumerate(faces) if point_in_face_or_edge(points, face, point)]
    if not containing:
        raise PrototypeFailure("site not contained by current hull triangulation", {"site": site, "point": format_point(point)})
    incident: list[tuple[int, Edge, int]] = []
    for index in containing:
        face = faces[index]
        for item in face_edges(face):
            if strictly_between(points[item[0]], points[item[1]], point):
                incident.append((index, item, third_vertex(face, item)))
    if incident:
        keys = {item for _, item, _ in incident}
        if len(keys) != 1 or len(incident) not in (1, 2):
            raise PrototypeFailure("ambiguous point-on-edge insertion", {
                "site": site, "point": format_point(point), "incident": [[index, list(item)] for index, item, _ in incident],
            })
        selected = incident[0][1]
        if any(item != selected for _, item, _ in incident):
            raise PrototypeFailure("mismatched edge insertion", {"site": site})
        replacement: list[Face] = [face for index, face in enumerate(faces) if index not in {value[0] for value in incident}]
        for _, (u, v), other in incident:
            replacement.append(make_face(points, u, site, other))
            replacement.append(make_face(points, site, v, other))
        trace.append({"site": site, "kind": "boundary-edge" if len(incident) == 1 else "internal-edge", "edge": list(selected)})
        return replacement
    if len(containing) != 1:
        raise PrototypeFailure("ambiguous interior insertion", {"site": site, "faces": containing})
    index = containing[0]
    a, b, c = faces[index]
    replacement = [face for face_index, face in enumerate(faces) if face_index != index]
    replacement.extend((make_face(points, a, b, site), make_face(points, b, c, site), make_face(points, c, a, site)))
    trace.append({"site": site, "kind": "face", "face": [a, b, c]})
    return replacement


def should_flip(points: list[Point], faces: list[Face], item: Edge, incidence: dict[Edge, list[int]]) -> tuple[bool, str, tuple[int, int] | None]:
    owners = incidence.get(item, [])
    if len(owners) != 2:
        return False, "boundary", None
    first, second = (faces[index] for index in owners)
    a, b = third_vertex(first, item), third_vertex(second, item)
    u, v = item
    # Strictly convex iff both diagonals put their opposite endpoints on opposite sides.
    if orient(points[u], points[v], points[a]) * orient(points[u], points[v], points[b]) >= 0:
        return False, "nonconvex", None
    if orient(points[a], points[b], points[u]) * orient(points[a], points[b], points[v]) >= 0:
        return False, "nonconvex", None
    circle = incircle(points[first[0]], points[first[1]], points[first[2]], points[b])
    if circle > 0:
        return True, "strict-incircle", (a, b)
    if circle == 0 and edge(a, b) < item:
        return True, "cocircular-lex", (a, b)
    return False, "delaunay", None


def restore_delaunay(points: list[Point], faces: list[Face], trace: list[dict[str, object]]) -> tuple[list[Face], int, int]:
    """Deterministic work-bounded candidate-edge queue for this tiny investigation."""
    queue: list[Edge] = []
    queued: set[Edge] = set()

    def enqueue_internal() -> None:
        for item, owners in sorted(edge_incidence(faces).items()):
            if len(owners) == 2 and item not in queued:
                heapq.heappush(queue, item)
                queued.add(item)

    enqueue_internal()
    seen = {state_key(faces)}
    examinations = 0
    flips = 0
    while queue:
        if examinations >= MAX_EDGE_EXAMINATIONS:
            raise PrototypeFailure("candidate-edge work cap exceeded", {"edge_examinations": examinations, "flips": flips, "queue": len(queue)})
        item = heapq.heappop(queue)
        queued.remove(item)
        incidence = edge_incidence(faces)
        examinations += 1
        change, reason, replacement = should_flip(points, faces, item, incidence)
        if not change:
            continue
        assert replacement is not None
        owners = incidence[item]
        a, b = replacement
        rebuilt = [face for index, face in enumerate(faces) if index not in owners]
        rebuilt.append(make_face(points, a, b, item[0]))
        rebuilt.append(make_face(points, b, a, item[1]))
        faces = rebuilt
        flips += 1
        key = state_key(faces)
        if key in seen:
            raise PrototypeFailure("repeated topology state during flipping", {"edge": list(item), "reason": reason, "flips": flips})
        seen.add(key)
        trace.append({"edge": list(item), "replacement": list(edge(a, b)), "reason": reason})
        # Deliberately broad in the tiny prototype: it keeps queue order deterministic and
        # rechecks edges whose local adjacent face changed without relying on a mutable map.
        enqueue_internal()
    return faces, flips, examinations


def on_closed_segment(a: Point, b: Point, p: Point) -> bool:
    return orient(a, b, p) == 0 and min(a[0], b[0]) <= p[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= p[1] <= max(a[1], b[1])


def proper_or_touching_cross(a: Point, b: Point, c: Point, d: Point) -> bool:
    """Any intersection of non-shared endpoint edges is invalid for this mesh."""
    return (
        sign(orient(a, b, c)) * sign(orient(a, b, d)) <= 0
        and sign(orient(c, d, a)) * sign(orient(c, d, b)) <= 0
        and (on_closed_segment(a, b, c) or on_closed_segment(a, b, d) or on_closed_segment(c, d, a) or on_closed_segment(c, d, b)
             or (sign(orient(a, b, c)) * sign(orient(a, b, d)) < 0 and sign(orient(c, d, a)) * sign(orient(c, d, b)) < 0))
    )


def verify_independently(points: list[Point], hull: list[int], faces: list[Face], two_dimensional: bool) -> dict[str, object]:
    """Rebuilds incidence from face triples; it does not mutate prototype topology state."""
    if not two_dimensional:
        if faces:
            raise PrototypeFailure("collinear bypass emitted faces", {"faces": [list(face) for face in faces]})
        return {"two_dimensional": False, "vertices": len(points), "faces": 0, "edges": 0, "boundary_edges": 0, "area_matches_hull": True, "empty_circle": True}
    independent_corners = independent_hull(points)
    if not independent_corners or polygon_area2(points, independent_corners) <= 0:
        raise PrototypeFailure("independent gift-wrap hull is not two-dimensional", {"hull": independent_corners})
    if independent_corners != hull:
        raise PrototypeFailure("construction hull differs from independent gift-wrap hull", {"construction": hull, "independent": independent_corners})
    supporting = independent_supporting_segments(points)
    if any(orient(points[face[0]], points[face[1]], points[face[2]]) <= 0 for face in faces):
        raise PrototypeFailure("nonpositive face in verifier")
    incidence = edge_incidence(faces)
    if any(len(owners) not in (1, 2) for owners in incidence.values()):
        raise PrototypeFailure("invalid edge incidence", {"edges": {str(key): owners for key, owners in incidence.items() if len(owners) not in (1, 2)}})
    for first_index, first in enumerate(sorted(incidence)):
        for second in sorted(incidence)[first_index + 1:]:
            if set(first) & set(second):
                continue
            if proper_or_touching_cross(points[first[0]], points[first[1]], points[second[0]], points[second[1]]):
                raise PrototypeFailure("crossing or touching nonincident edges", {"first": list(first), "second": list(second)})
    area = sum(orient(points[a], points[b], points[c]) for a, b, c in faces)
    hull_area = polygon_area2(points, independent_corners)
    if area != hull_area:
        raise PrototypeFailure("face area does not equal hull area", {"faces_area2": format_fraction(area), "hull_area2": format_fraction(hull_area)})
    boundary = [item for item, owners in incidence.items() if len(owners) == 1]
    for item in boundary:
        if not any(on_closed_segment(points[a], points[b], points[item[0]]) and on_closed_segment(points[a], points[b], points[item[1]]) for a, b in supporting):
            raise PrototypeFailure("boundary edge does not lie on strict hull", {"edge": list(item)})
    for corner in independent_corners:
        if not any(corner in item for item in boundary):
            raise PrototypeFailure("strict hull corner missing from boundary", {"site": corner})
    for site, point in enumerate(points):
        if any(on_closed_segment(points[a], points[b], point) for a, b in supporting) and not any(site in item for item in boundary):
            raise PrototypeFailure("hull-edge site missing from boundary", {"site": site})
    for face in faces:
        for site, point in enumerate(points):
            if site in face:
                continue
            determinant = independent_incircle(points[face[0]], points[face[1]], points[face[2]], point)
            if determinant > 0:
                raise PrototypeFailure("brute-force empty-circle violation", {"face": list(face), "site": site, "determinant": format_fraction(determinant)})
    for item, owners in incidence.items():
        if len(owners) != 2:
            continue
        first, second = faces[owners[0]], faces[owners[1]]
        a, b = third_vertex(first, item), third_vertex(second, item)
        if orient(points[item[0]], points[item[1]], points[a]) * orient(points[item[0]], points[item[1]], points[b]) < 0 and orient(points[a], points[b], points[item[0]]) * orient(points[a], points[b], points[item[1]]) < 0:
            determinant = incircle(points[first[0]], points[first[1]], points[first[2]], points[b])
            if determinant == 0 and edge(a, b) < item:
                raise PrototypeFailure("cocircular internal edge violates lex diagonal policy", {"edge": list(item), "alternate": list(edge(a, b))})
    used = {site for face in faces for site in face}
    if used != set(range(len(points))):
        raise PrototypeFailure("not every two-dimensional unique site participates", {"missing": sorted(set(range(len(points))) - used)})
    return {"two_dimensional": True, "vertices": len(points), "faces": len(faces), "edges": len(incidence), "boundary_edges": len(boundary), "area_matches_hull": True, "empty_circle": True}


def format_fraction(value: Fraction) -> str:
    return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"


def format_point(point: Point) -> list[str]:
    return [format_fraction(point[0]), format_fraction(point[1])]


def coordinate_signature(points: list[Point], faces: list[Face]) -> list[list[list[str]]]:
    return sorted(sorted([format_point(points[site]) for site in face]) for face in faces)


@dataclass
class Result:
    points: list[Point]
    duplicates: dict[Point, list[int]]
    hull: list[int]
    faces: list[Face]
    insertions: list[dict[str, object]]
    flips: list[dict[str, object]]
    flip_count: int
    edge_examinations: int
    verification: dict[str, object]


def triangulate(raw: list[tuple[object, object]]) -> Result:
    points, duplicates = canonicalize(raw)
    if len(points) > MAX_SITES:
        raise PrototypeFailure("distinct-site cap exceeded", {"distinct_sites": len(points), "cap": MAX_SITES})
    hull = strict_hull(points)
    if len(points) < 3 or len(hull) < 3 or polygon_area2(points, hull) == 0:
        verification = verify_independently(points, hull, [], False)
        return Result(points, duplicates, hull, [], [], [], 0, 0, verification)
    root = min(hull)
    start = hull.index(root)
    hull = hull[start:] + hull[:start]
    faces = [make_face(points, root, hull[index], hull[index + 1]) for index in range(1, len(hull) - 1)]
    insertion_trace: list[dict[str, object]] = []
    corners = set(hull)
    for site in range(len(points)):
        if site not in corners:
            faces = insert_site(points, faces, site, insertion_trace)
    flip_trace: list[dict[str, object]] = []
    faces, flips, examinations = restore_delaunay(points, faces, flip_trace)
    verification = verify_independently(points, hull, faces, True)
    return Result(points, duplicates, hull, faces, insertion_trace, flip_trace, flips, examinations, verification)


def serialise_result(result: Result) -> dict[str, object]:
    return {
        "distinct_sites": len(result.points),
        "input_records_by_unique_site": [result.duplicates[point] for point in result.points],
        "strict_hull": result.hull,
        "faces": [list(face) for face in result.faces],
        "coordinate_topology": coordinate_signature(result.points, result.faces),
        "insertions": result.insertions,
        "flips": result.flips,
        "flip_count": result.flip_count,
        "edge_examinations": result.edge_examinations,
        "verification": result.verification,
    }


def cases() -> list[tuple[str, list[tuple[int, int]]]]:
    fixed: list[tuple[str, list[tuple[int, int]]]] = [
        ("triangle", [(0, 0), (6, 0), (0, 4)]),
        ("square-cocircular", [(0, 0), (4, 0), (4, 4), (0, 4)]),
        ("cocircular-octagon", [(-5, 0), (-3, -4), (0, -5), (3, -4), (5, 0), (3, 4), (0, 5), (-3, 4)]),
        ("cocircular-tie-flip", [(0, 0), (0, 1), (0, 2), (1, 2), (2, 2)]),
        ("hull-collinear-sites", [(0, 0), (2, 0), (4, 0), (4, 2), (4, 4), (2, 4), (0, 4), (0, 2), (2, 2)]),
        ("internal-edge-site", [(0, 0), (4, 0), (4, 4), (0, 4), (2, 2)]),
        ("rational-interior", [(0, 0), (6, 0), (6, 6), (0, 6), (Fraction(1, 2), Fraction(1, 3)), (Fraction(7, 3), Fraction(5, 2))]),
        ("duplicates", [(0, 0), (4, 0), (0, 4), (4, 4), (2, 2), (0, 0), (2, 2), (4, 0)]),
        ("all-collinear", [(index, 0) for index in range(12)]),
    ]
    generator = random.Random(913)
    for number in range(12):
        count = 3 + number * 2
        sites: set[tuple[int, int]] = set()
        while len(sites) < count:
            sites.add((generator.randrange(-30, 31), generator.randrange(-30, 31)))
        fixed.append((f"random-integer-{count:02d}", list(sites)))
    return fixed


def write_result(payload: dict[str, object]) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    destination = OUT / "result.json"
    destination.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", help="run only one named registered case")
    args = parser.parse_args()
    started = perf_counter()
    completed: list[dict[str, object]] = []
    failures: list[dict[str, object]] = []
    registered = cases()
    if args.case:
        registered = [item for item in registered if item[0] == args.case]
        if not registered:
            raise SystemExit("unknown case: " + args.case)
    signatures: dict[str, list[list[list[str]]]] = {}
    for name, raw in registered:
        try:
            result = triangulate(raw)
            entry = {"id": name, "status": "passed", "input_count": len(raw), **serialise_result(result)}
            completed.append(entry)
            signatures[name] = entry["coordinate_topology"]  # type: ignore[assignment]
        except PrototypeFailure as error:
            failures.append({"id": name, "status": "failed", "error": str(error), "witness": error.witness, "input": [list(point) for point in raw]})
    permutation_checks: list[dict[str, object]] = []
    if not args.case:
        base = dict(registered)["duplicates"]
        expected = signatures.get("duplicates")
        for label, raw in (("reversed", list(reversed(base))), ("rotated", base[3:] + base[:3]), ("sorted", sorted(base))):
            try:
                permutation_result = triangulate(raw)
                observed = coordinate_signature(permutation_result.points, permutation_result.faces)
                passed = observed == expected
                permutation_checks.append({"id": "duplicates-" + label, "passed": passed})
                if not passed:
                    failures.append({"id": "duplicates-" + label, "status": "failed", "error": "canonical permutation topology differs", "witness": {"expected": expected, "observed": observed}})
            except PrototypeFailure as error:
                failures.append({"id": "duplicates-" + label, "status": "failed", "error": str(error), "witness": error.witness})
    payload: dict[str, object] = {
        "status": "passed" if not failures else "failed",
        "scope": "Private exact Fraction/integer topology investigation; no public triangulator, production performance claim, render, or source-code reuse.",
        "strategy": "strict convex-hull corner fan; canonical insertion; exact Delaunay and cocircular lexicographic edge flips",
        "work_cap": {"distinct_sites": MAX_SITES, "edge_examinations": MAX_EDGE_EXAMINATIONS},
        "cases": completed,
        "permutation_checks": permutation_checks,
        "failures": failures,
        "elapsed_ms": round((perf_counter() - started) * 1000, 3),
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    }
    destination = write_result(payload)
    print(json.dumps({"status": payload["status"], "cases": len(completed), "failures": len(failures), "result": str(destination.relative_to(ROOT))}, sort_keys=True))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
