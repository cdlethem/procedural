#!/usr/bin/env python3
"""Private interval enclosure for the CP7 draft profile-surface arithmetic.

This is an engineering diagnostic, not a public mesh implementation or a claim that
all target sin/cos functions are correctly enclosed by the chosen two-adjacent-float
reference envelope.  It uses only small self-contained profiles until draft fixture
cases exist.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[3]
FUTURE_CASES = ROOT / ".work/cp7-contract/fixture-cases.json"
TAU = 6.283185307179586


@dataclass(frozen=True)
class Interval:
    lo: float
    hi: float

    def __post_init__(self) -> None:
        if not (math.isfinite(self.lo) and math.isfinite(self.hi) and self.lo <= self.hi):
            raise ValueError("nonfinite interval")

    @property
    def exact(self) -> bool:
        return self.lo == self.hi


def down(value: float) -> float:
    if not math.isfinite(value):
        raise ValueError("nonfinite interval bound")
    return math.nextafter(value, -math.inf)


def up(value: float) -> float:
    if not math.isfinite(value):
        raise ValueError("nonfinite interval bound")
    return math.nextafter(value, math.inf)


def rounded(lo: float, hi: float, exact: bool = False) -> Interval:
    if not (math.isfinite(lo) and math.isfinite(hi)):
        raise ValueError("nonfinite interval bound")
    if exact or lo == hi:
        return Interval(lo, hi)
    return Interval(down(min(lo, hi)), up(max(lo, hi)))


def point(value: float) -> Interval:
    if not math.isfinite(value):
        raise ValueError("nonfinite point")
    return Interval(value, value)


def add(a: Interval, b: Interval) -> Interval:
    return rounded(a.lo + b.lo, a.hi + b.hi, a.exact and b.exact)


def sub(a: Interval, b: Interval) -> Interval:
    return rounded(a.lo - b.hi, a.hi - b.lo, a.exact and b.exact)


def mul(a: Interval, b: Interval) -> Interval:
    if (a.exact and a.lo == 0.0) or (b.exact and b.lo == 0.0):
        return point(0.0)
    values = (a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi)
    return rounded(min(values), max(values), a.exact and b.exact)


def div(a: Interval, b: Interval) -> Interval:
    if b.lo <= 0.0 <= b.hi:
        raise ValueError("zero_divisor_possible")
    if a.exact and a.lo == 0.0:
        return point(0.0)
    values = (a.lo / b.lo, a.lo / b.hi, a.hi / b.lo, a.hi / b.hi)
    return rounded(min(values), max(values), a.exact and b.exact)


def sqrt(a: Interval) -> Interval:
    if a.lo < 0.0:
        raise ValueError("negative_sqrt_possible")
    return rounded(math.sqrt(a.lo), math.sqrt(a.hi), a.exact)


def abs_interval(a: Interval) -> Interval:
    if a.lo <= 0.0 <= a.hi:
        return Interval(0.0, max(abs(a.lo), abs(a.hi)))
    return Interval(min(abs(a.lo), abs(a.hi)), max(abs(a.lo), abs(a.hi)))


def maximum(values: Iterable[Interval]) -> Interval:
    items = list(values)
    return Interval(max(value.lo for value in items), max(value.hi for value in items))


def widened_trig(value: float, *, exact: bool) -> Interval:
    if exact:
        return point(value)
    lo = value
    hi = value
    for _ in range(2):
        lo = down(lo)
        hi = up(hi)
    return Interval(max(-1.0, lo), min(1.0, hi))


def trig(cell: int, slices: int) -> tuple[float, float, Interval, Interval]:
    theta = (TAU * cell) / slices
    cosine = math.cos(theta)
    sine = math.sin(theta)
    exact = theta == 0.0
    return cosine, sine, widened_trig(cosine, exact=exact), widened_trig(sine, exact=exact)


def raw_normal(a: tuple[float, float, float], b: tuple[float, float, float], c: tuple[float, float, float]) -> tuple[float, float, float]:
    ux, uy, uz = (b[index] - a[index] for index in range(3))
    vx, vy, vz = (c[index] - a[index] for index in range(3))
    su = max(abs(ux), abs(uy), abs(uz))
    sv = max(abs(vx), abs(vy), abs(vz))
    if not (math.isfinite(su) and math.isfinite(sv) and su != 0.0 and sv != 0.0):
        raise ValueError("reference edge scale failure")
    ux, uy, uz = ux / su, uy / su, uz / su
    vx, vy, vz = vx / sv, vy / sv, vz / sv
    nx = uy * vz - uz * vy
    ny = uz * vx - ux * vz
    nz = ux * vy - uy * vx
    sn = max(abs(nx), abs(ny), abs(nz))
    if not math.isfinite(sn) or sn == 0.0:
        raise ValueError("reference cross scale failure")
    qx, qy, qz = nx / sn, ny / sn, nz / sn
    length = math.sqrt((qx * qx + qy * qy) + qz * qz)
    if not math.isfinite(length) or length == 0.0:
        raise ValueError("reference normal length failure")
    return qx / length, qy / length, qz / length


def interval_normal(a: tuple[Interval, Interval, Interval], b: tuple[Interval, Interval, Interval], c: tuple[Interval, Interval, Interval]) -> tuple[Interval, Interval, Interval]:
    u = tuple(sub(b[index], a[index]) for index in range(3))
    v = tuple(sub(c[index], a[index]) for index in range(3))
    su = maximum(abs_interval(component) for component in u)
    sv = maximum(abs_interval(component) for component in v)
    us = tuple(div(component, su) for component in u)
    vs = tuple(div(component, sv) for component in v)
    cross = (
        sub(mul(us[1], vs[2]), mul(us[2], vs[1])),
        sub(mul(us[2], vs[0]), mul(us[0], vs[2])),
        sub(mul(us[0], vs[1]), mul(us[1], vs[0])),
    )
    nonzero_axes = [i for i, component in enumerate(cross)
                    if not (component.exact and component.lo == 0.0)]
    if len(nonzero_axes) == 1:
        axis = nonzero_axes[0]
        component = cross[axis]
        if component.lo > 0.0 or component.hi < 0.0:
            return tuple(point((1.0 if component.lo > 0.0 else -1.0) if i == axis else 0.0)
                         for i in range(3))
    sn = maximum(abs_interval(component) for component in cross)
    q = tuple(div(component, sn) for component in cross)
    length = sqrt(add(add(mul(q[0], q[0]), mul(q[1], q[1])), mul(q[2], q[2])))
    return tuple(div(component, length) for component in q)


@dataclass(frozen=True)
class Vertex:
    exact: tuple[float, float, float]
    interval: tuple[Interval, Interval, Interval]
    origin: str


@dataclass(frozen=True)
class Triangle:
    indices: tuple[int, int, int]
    kind: str
    band: int
    cell: int


def mesh(profile: list[tuple[float, float]], slices: int, cap_start: bool, cap_end: bool) -> tuple[list[Vertex], list[Triangle]]:
    vertices: list[Vertex] = []
    rings: list[int | list[int]] = []
    for z, radius in profile:
        if radius == 0.0:
            rings.append(len(vertices))
            vertices.append(Vertex((0.0, 0.0, z), (point(0.0), point(0.0), point(z)), "pole"))
            continue
        ring: list[int] = []
        for cell in range(slices):
            cosine, sine, cosine_interval, sine_interval = trig(cell, slices)
            ring.append(len(vertices))
            vertices.append(Vertex((radius * cosine, radius * sine, z),
                                   (mul(point(radius), cosine_interval), mul(point(radius), sine_interval), point(z)),
                                   "ring"))
        rings.append(ring)
    triangles: list[Triangle] = []
    for band in range(len(profile) - 1):
        lower, upper = rings[band], rings[band + 1]
        for cell in range(slices):
            next_cell = (cell + 1) % slices
            if isinstance(lower, list) and isinstance(upper, list):
                a, b, c, d = lower[cell], lower[next_cell], upper[next_cell], upper[cell]
                triangles.extend((Triangle((a, b, c), "side", band, cell), Triangle((a, c, d), "side", band, cell)))
            elif isinstance(lower, int):
                assert isinstance(upper, list)
                triangles.append(Triangle((lower, upper[next_cell], upper[cell]), "side", band, cell))
            else:
                assert isinstance(upper, int)
                triangles.append(Triangle((lower[cell], lower[next_cell], upper), "side", band, cell))
    if cap_start and isinstance(rings[0], list):
        centre = len(vertices)
        vertices.append(Vertex((0.0, 0.0, profile[0][0]), (point(0.0), point(0.0), point(profile[0][0])), "start-centre"))
        ring = rings[0]
        for cell in range(slices):
            triangles.append(Triangle((centre, ring[(cell + 1) % slices], ring[cell]), "start-cap", -1, cell))
    if cap_end and isinstance(rings[-1], list):
        centre = len(vertices)
        vertices.append(Vertex((0.0, 0.0, profile[-1][0]), (point(0.0), point(0.0), point(profile[-1][0])), "end-centre"))
        ring = rings[-1]
        for cell in range(slices):
            triangles.append(Triangle((centre, ring[cell], ring[(cell + 1) % slices]), "end-cap", -1, cell))
    return vertices, triangles


def allowance(value: float, enclosure: Interval) -> float:
    if not enclosure.lo <= value <= enclosure.hi:
        raise AssertionError("reference value escaped its interval")
    return max(abs(value - enclosure.lo), abs(enclosure.hi - value))


def summarize(case: dict) -> dict:
    vertices, triangles = mesh(case["profile"], case["slices"], case["cap_start"], case["cap_end"])
    position = [{"max_abs_allowance": 0.0, "max_interval_width": 0.0, "exact_components": 0, "components": 0}
                for _ in range(3)]
    normal = [{"max_abs_allowance": 0.0, "max_interval_width": 0.0, "exact_components": 0, "components": 0}
              for _ in range(3)]
    for vertex in vertices:
        for index, enclosure in enumerate(vertex.interval):
            position[index]["components"] += 1
            position[index]["max_abs_allowance"] = max(position[index]["max_abs_allowance"], allowance(vertex.exact[index], enclosure))
            position[index]["max_interval_width"] = max(position[index]["max_interval_width"], enclosure.hi - enclosure.lo)
            position[index]["exact_components"] += int(enclosure.exact)
    kinds: dict[str, int] = {}
    for face_index, triangle in enumerate(triangles):
        del face_index
        a, b, c = (vertices[index] for index in triangle.indices)
        reference = raw_normal(a.exact, b.exact, c.exact)
        enclosure = interval_normal(a.interval, b.interval, c.interval)
        kinds[triangle.kind] = kinds.get(triangle.kind, 0) + 1
        for index, component in enumerate(enclosure):
            normal[index]["components"] += 1
            normal[index]["max_abs_allowance"] = max(normal[index]["max_abs_allowance"], allowance(reference[index], component))
            normal[index]["max_interval_width"] = max(normal[index]["max_interval_width"], component.hi - component.lo)
            normal[index]["exact_components"] += int(component.exact)
    return {
        "id": case["id"],
        "profile": case["profile"],
        "slices": case["slices"],
        "capStart": case["cap_start"],
        "capEnd": case["cap_end"],
        "vertices": len(vertices),
        "faces": len(triangles),
        "face_kinds": kinds,
        "position_components": {axis: position[index] for index, axis in enumerate(("x", "y", "z"))},
        "normal_components": {axis: normal[index] for index, axis in enumerate(("x", "y", "z"))},
        "status": "finite_interval_enclosure"
    }


def main() -> None:
    cases = [
        {"id": "cylinder-s3", "profile": [(-1.0, 1.0), (1.0, 1.0)], "slices": 3, "cap_start": True, "cap_end": True},
        {"id": "waist-s4", "profile": [(-2.0, 1.0), (0.0, 0.4), (2.0, 1.0)], "slices": 4, "cap_start": True, "cap_end": True},
        {"id": "frustum-s4", "profile": [(-2.0, 0.6), (2.0, 1.2)], "slices": 4, "cap_start": True, "cap_end": False},
        {"id": "end-pole-s3", "profile": [(-2.0, 1.0), (2.0, 0.0)], "slices": 3, "cap_start": True, "cap_end": True},
        {"id": "uniform-1e200-s4", "profile": [(-1e200, 1e200), (1e200, 1e200)], "slices": 4, "cap_start": True, "cap_end": True},
        {"id": "uniform-1e-200-s4", "profile": [(-1e-200, 1e-200), (1e-200, 1e-200)], "slices": 4, "cap_start": True, "cap_end": True},
    ]
    records: list[dict] = []
    for case in cases:
        try:
            records.append(summarize(case))
        except (ArithmeticError, ValueError, OverflowError) as error:
            records.append({"id": case["id"], "status": "inconclusive", "reason": str(error)})
    future = {"path": str(FUTURE_CASES.relative_to(ROOT)), "present": FUTURE_CASES.is_file(),
              "status": "not consumed; self-contained cases only"}
    print(json.dumps({
        "status": "observational",
        "scope": "Private CP7 interval arithmetic engineering diagnostic; no public operation, fixture, target-trigonometry, renderer, or universal tolerance claim.",
        "trig_envelope": "For nonzero theta, local Python sin/cos reference widened by two adjacent binary64 values in each direction and clipped to[-1,1]. theta==0 uses exact sin=+0/cos=1.",
        "interval_policy": "Outward rounded binary64 interval operations after the initial trigonometric envelope. Exact point operations and exact zero products remain exact. Any nonfinite bound or interval divisor containing zero is inconclusive, not widened by an invented epsilon.",
        "records": records,
        "future_fixture_cases": future
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
