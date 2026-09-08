"""Example-owned CP16 composition: retain four closed splines, draw an outline with
oriented tile marks, or a triangle fan from each curve's center.

Motivated by 2019/generativos/databol and 2018/Generativos/blobs (see
design/capabilities/loop-marks-native-plan.md for the reference Java composition). The
curves use the reviewed portable geometry.closed-spline-2d operation; rendering and
interactive controls belong to a target starter. These constants describe one bounded
piece, never public operation defaults or encouraged ranges.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterator

from procedurals import closed_spline_2d

COLORS = (0xDE6B48, 0x3B8D91, 0xD3A73B, 0x71619A)
OTHER_COLORS = (0x366A8C, 0xA95478, 0x678C49, 0xC87632)
BACKGROUND_RGB = 0xF5F0E6
_CURVE_COUNT = 4
_CONTROL_COUNT = 6
_RADIUS_BASE = 82
_RADIUS_SPREAD = 36  # exclusive upper bound for the LCG draw, matching Java's nextInt(36)
_SUBDIVISIONS = 32
_OUTLINE_SAMPLES = 192
_TILE_SPACING = 18.0
_TILE_WIDTH, _TILE_HEIGHT = 12.0, 22.0
_TIP_WIDTH, _TIP_HEIGHT = 4.0, 10.0
_FAN_SAMPLES = 192

_MASK48 = (1 << 48) - 1
_MULTIPLIER = 0x5DEECE66D


class _JavaExampleRandom:
    """Example-only java.util.Random(seed) sequence including nextInt, matching the
    Java LoopMarks composition's control-point radii. This does not expose or alter
    the library's private xoshiro sampling stream.
    """

    def __init__(self, seed):
        self._state = (seed ^ _MULTIPLIER) & _MASK48

    def _next(self, bits):
        self._state = (self._state * _MULTIPLIER + 11) & _MASK48
        return self._state >> (48 - bits)

    def next_int(self, bound):
        if bound & -bound == bound:
            return (bound * self._next(31)) >> 31
        while True:
            bits = self._next(31)
            value = bits % bound
            if bits - value + (bound - 1) >= 0:
                return value


def _center(index: int) -> tuple[float, float]:
    return (170 + (index % 2) * 300, 170 + (index // 2) * 300)


@dataclass(frozen=True, slots=True)
class LoopMarks:
    """Retained curves for style-only recolor/fan-mode edits; T rebuilds geometry."""
    moved: bool
    curves: tuple


def create_loop_marks(moved: bool = False) -> LoopMarks:
    random = _JavaExampleRandom(42)
    curves = []
    for i in range(_CURVE_COUNT):
        cx, cy = _center(i)
        controls = []
        for j in range(_CONTROL_COUNT):
            angle = (j * math.pi) / 3.0
            radius = _RADIUS_BASE + random.next_int(_RADIUS_SPREAD)
            controls.append([cx + math.cos(angle) * radius, cy + math.sin(angle) * radius])
        if moved:
            controls[1][0] += 42
            controls[1][1] -= 32
        curves.append(closed_spline_2d({"controls": controls, "subdivisions": _SUBDIVISIONS}))
    return LoopMarks(moved, tuple(curves))


def _rotated_rect_vertices(cx, cy, heading, half_width, half_height):
    cos, sin = math.cos(heading), math.sin(heading)
    corners = ((-half_width, -half_height), (half_width, -half_height),
               (half_width, half_height), (-half_width, half_height))
    return [[cx + lx * cos - ly * sin, cy + lx * sin + ly * cos] for lx, ly in corners]


def _segment(from_point, to_point, rgb, opacity8, width):
    return {"kind": "segment2", "from": from_point, "to": to_point, "rgb": rgb,
            "opacity8": opacity8, "width": width, "cap": "round"}


def _quad(vertices, rgb, opacity8):
    return {"kind": "quad2", "vertices": vertices, "rgb": rgb, "opacity8": opacity8}


def loop_tile_commands(model: LoopMarks, alternate: bool) -> Iterator[dict]:
    """Yield the "tiles" view: a translucent 192-segment outline stroke, plus rotated
    two-layer tile glyphs every 18 distance units. Rounded corners (radius 3/1 in the
    Java source) are drawn as plain rectangles here: the shared fresh-raster-2d command
    vocabulary is exactly segment2 (capped line) and quad2 (convex fill), with no
    rounded-rect primitive.
    """
    palette = OTHER_COLORS if alternate else COLORS
    for i, curve in enumerate(model.curves):
        rgb = palette[i]
        points = []
        for j in range(_OUTLINE_SAMPLES):
            sample = curve.sample_parameter((j * curve.control_count) / _OUTLINE_SAMPLES)
            points.append([sample["x"], sample["y"]])
        for j in range(_OUTLINE_SAMPLES):
            start, end = points[j], points[(j + 1) % _OUTLINE_SAMPLES]
            if start[0] == end[0] and start[1] == end[1]:
                continue
            yield _segment(start, end, rgb, 95, 0.8)
        distance = 0.0
        while distance < curve.length:
            sample = curve.sample_distance(distance)
            tangent_x, tangent_y = sample["tangentX"], sample["tangentY"]
            if tangent_x == 0 and tangent_y == 0:
                distance += _TILE_SPACING
                continue
            heading = math.atan2(tangent_y, tangent_x)
            yield _quad(_rotated_rect_vertices(sample["x"], sample["y"], heading,
                                                _TILE_WIDTH / 2, _TILE_HEIGHT / 2), rgb, 255)
            yield _quad(_rotated_rect_vertices(sample["x"], sample["y"], heading,
                                                _TIP_WIDTH / 2, _TIP_HEIGHT / 2), BACKGROUND_RGB, 255)
            distance += _TILE_SPACING


def loop_fan_triangles(model: LoopMarks, alternate: bool) -> Iterator[dict]:
    """Yield the "fans" view: FAN_SAMPLES colored triangles per curve, fanning from its
    center to consecutive perimeter samples. Fan drawing is an artistic use of the
    selected outline, not polygon triangulation, and (like the Java source) is not
    expressed through the shared quad2 vocabulary, which admits only strictly-convex
    four-vertex fills, not triangles.
    """
    palette = OTHER_COLORS if alternate else COLORS
    for i, curve in enumerate(model.curves):
        cx, cy = _center(i)
        rgb = palette[i]
        next_sample = curve.sample_parameter(0)
        for j in range(_FAN_SAMPLES):
            current = next_sample
            next_sample = curve.sample_parameter(((j + 1) * curve.control_count) / _FAN_SAMPLES)
            yield {"cx": cx, "cy": cy, "x1": current["x"], "y1": current["y"],
                   "x2": next_sample["x"], "y2": next_sample["y"], "rgb": rgb,
                   "opacity8": 110 + (j % 16) * 8}
