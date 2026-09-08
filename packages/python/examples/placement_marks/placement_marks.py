"""PlacementMarks composition helpers for the editable py5 starter.

Motivated by survey/out/2018/Generativos/caramelo/notes.md,
survey/out/2018/Generativos/candy/notes.md and
survey/out/2017/Generativos/studio/notes.md. The canvas, radius settings and
authored radial pattern describe this piece, not library defaults or
recommended ranges. The radial source is a transfer example: it sends its
5 x 32 authored proposals through the same public ordered exclusion
operation. See docs/placement-marks.md.
"""

from __future__ import annotations

import math

from procedurals.placements import (
    ordered_circle_filter_2d,
    seeded_circle_placement_2d,
)

__all__ = [
    "ALTERNATE_PALETTE",
    "BASE_PALETTE",
    "create_placement_composition",
    "vertex_into",
]

BASE_PALETTE = ((0x31, 0xA1, 0x51), (0xFF, 0xA7, 0x1E), (0x05, 0x08, 0x4C),
                (0xDE, 0x46, 0x38), (0x3D, 0xBD, 0xB7))
ALTERNATE_PALETTE = ((0x2E, 0x05, 0x51), (0xFF, 0x00, 0xC7), (0x01, 0xAF, 0xC2),
                     (0xFD, 0xBE, 0x03), (0xF4, 0xF9, 0xFD))


def create_placement_composition(radial: bool, seed: int, attempts: int,
                                 minimum: float, maximum: float,
                                 separation: float):
    """Propose centres in an inset rectangle, or use the authored radial bands."""
    if radial:
        return create_radial_placement_composition(separation)
    return seeded_circle_placement_2d({
        "seed": seed, "attempts": attempts,
        "origin": [64.0, 64.0], "extent": [512.0, 512.0],
        "radiusRange": [minimum, maximum], "separationScale": separation,
    })


def create_radial_placement_composition(separation: float):
    """Replace the proposal source with authored bands, keeping the exclusion rule."""
    sizes = (8.0, 14.0, 20.0)
    centres: list[list[float]] = []
    radii: list[float] = []
    for band in range(5):
        distance = 48.0 * (band + 1)
        for j in range(32):
            angle = 2.0 * math.pi * j / 32 + band * math.pi / 32
            centres.append([320.0 + distance * math.cos(angle),
                            320.0 + distance * math.sin(angle)])
            radii.append(sizes[(band * 32 + j) % len(sizes)])
    return ordered_circle_filter_2d({
        "centres": centres, "radii": radii, "separationScale": separation,
    })


def vertex_into(placements, circle: int, vertex: int, diamond: bool,
                out: list[float]) -> None:
    """Rings and inscribed diamonds reuse the exact same retained placement object."""
    vertices = 4 if diamond else 64
    if vertex < 0 or vertex >= vertices:
        raise ValueError("vertex")
    placements.point_into(circle, out, 0)
    radius = placements.radius_at(circle)
    angle = 2.0 * math.pi * vertex / vertices
    out[0] = out[0] + radius * math.cos(angle)
    out[1] = out[1] + radius * math.sin(angle)
