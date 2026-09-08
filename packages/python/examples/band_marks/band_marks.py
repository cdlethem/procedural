"""Example-owned composition: retain 64 traced noise-band paths, draw connected
segments or perpendicular tick marks.

Motivated by 2018/Generativos/venas, not source replay (see catalog/validation/
noise-band-path.json, targets.processing-java.technique). The paths use the reviewed
portable path.noise-band-trace-2d operation; rendering and interactive controls belong
to a target starter. These constants describe one bounded piece, never public operation
defaults or encouraged ranges.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterator

from procedurals import noise_band_path_2d

PATH_COUNT = 64
COLORS = (0x224B63, 0x3A7D7C, 0x6B8E23, 0xC17C3D, 0x8B3D5C, 0x4F5D95)
OTHER_COLORS = (0xE76F51, 0x264653, 0xB84A62, 0x457B9D, 0x8A5A44, 0x606C38)
BACKGROUND_RGB = 0xF5F0E6
_FIELD_SEED = 0x6A09E667
_NARROW_TOLERANCE = 0.002
_WIDE_TOLERANCE = 0.008


@dataclass(frozen=True, slots=True)
class BandMarks:
    """Retained paths for style-only recolor/mark edits; T rebuilds with a new tolerance."""
    wider: bool
    paths: tuple


def create_band_marks(wider: bool = False) -> BandMarks:
    paths = []
    for i in range(PATH_COUNT):
        paths.append(noise_band_path_2d({
            "field": {"seed": _FIELD_SEED},
            "start": [40.0 + 80.0 * (i % 8), 40.0 + 80.0 * (i // 8)],
            "heading": 0.0,
            "seed": 1000 + i,
            "attempts": 2048,
            "stepDistance": 1.0,
            "fieldScale": 0.006,
            "fieldOffset": [7.3, 11.7],
            "tolerance": _WIDE_TOLERANCE if wider else _NARROW_TOLERANCE,
            "maxVertices": 2049,
        }))
    return BandMarks(wider, tuple(paths))


def _segment(from_point, to_point, rgb, opacity8, width):
    return {"kind": "segment2", "from": from_point, "to": to_point, "rgb": rgb,
            "opacity8": opacity8, "width": width, "cap": "round"}


def band_path_commands(model: BandMarks, alternate: bool, marks: bool) -> Iterator[dict]:
    """Yield the "path" view: connected line segments through every retained vertex,
    or (marks=True) a short perpendicular tick every 8th vertex. Matches the shared
    drawing.fresh-raster-2d vocabulary exactly (segment2 only; no fill primitive needed).
    """
    palette = OTHER_COLORS if alternate else COLORS
    point = [0.0, 0.0]
    next_point = [0.0, 0.0]
    for i, path in enumerate(model.paths):
        rgb = palette[i % len(palette)]
        if marks:
            j = 1
            while j < path.size:
                path.point_into(j, point)
                heading = path.heading_at(j - 1)
                dx, dy = -math.sin(heading) * 2.0, math.cos(heading) * 2.0
                start = [point[0] - dx, point[1] - dy]
                end = [point[0] + dx, point[1] + dy]
                if start[0] != end[0] or start[1] != end[1]:
                    yield _segment(start, end, rgb, 150, 0.8)
                j += 8
        else:
            path.point_into(0, point)
            x, y = point[0], point[1]
            for j in range(1, path.size):
                path.point_into(j, next_point)
                if x != next_point[0] or y != next_point[1]:
                    yield _segment([x, y], [next_point[0], next_point[1]], rgb, 150, 0.8)
                x, y = next_point[0], next_point[1]
