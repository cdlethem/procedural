"""Example-owned composition: remap a retained source raster through a per-pixel
displacement field, using either a paired-sine field or a gradient-noise-driven angle.

Motivated by the raster.bilinear-remap-2d reference (see catalog/validation/
bilinear-raster-remap.json, targets.processing-java.technique), composed with the
already-ported color.cyclic-palette and fields.gradient-noise-2d-01 operations.
Rendering the source pattern and interactive controls belong to a target starter. These
constants describe one bounded piece, never public operation defaults or encouraged
ranges.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from procedurals import bilinear_raster_remap_2d, cyclic_palette, gradient_noise_2d_01

SIDE = 640
COLORS = (0xE76F51, 0xF4A261, 0xE9C46A, 0x2A9D8F, 0x264653)
BACKGROUND_RGB = 0xF8F5EE
STRENGTHS = (32, 64, 0)


@dataclass(frozen=True, slots=True)
class WarpMarks:
    """Retained palette and noise field, independent of the strength/field/pattern edits."""
    palette: object
    noise_field: object


def create_warp_marks() -> WarpMarks:
    return WarpMarks(cyclic_palette({"colors": list(COLORS)}), gradient_noise_2d_01({"seed": 42}))


def dot_color_at(model: WarpMarks, x: float, y: float) -> int:
    """The dot-pattern source color sampled at one grid position (non-stripe source)."""
    return int(model.palette.sample((x + 3.0 * y) / SIDE))


def stripe_color_at(row: int) -> int:
    """The stripe source color for one 32px row band."""
    return COLORS[(row // 32) % len(COLORS)]


def displacement_at(model: WarpMarks, x: float, y: float, strength: int, alternate_field: bool):
    """The exact source-sampling displacement for one output pixel."""
    if strength == 0:
        return x, y
    if alternate_field:
        return (x + strength * math.sin((y * (2.0 * math.pi)) / 160.0),
                y + strength * math.sin((x * (2.0 * math.pi)) / 160.0))
    angle = model.noise_field.sample(x * 0.01, y * 0.01) * (2.0 * math.pi)
    return x + strength * math.cos(angle), y + strength * math.sin(angle)


def remap_source(source_pixels, model: WarpMarks, strength: int, alternate_field: bool):
    """Remap an owned packed-ARGB8 source raster through the exact per-pixel displacement
    field. source_pixels must be a row-major sequence of SIDE*SIDE unsigned32 ARGB8
    values (matching the shared raster.bilinear-remap-2d contract exactly).
    """
    coordinates = [None] * (SIDE * SIDE)
    index = 0
    for y in range(SIDE):
        for x in range(SIDE):
            coordinates[index] = list(displacement_at(model, x, y, strength, alternate_field))
            index += 1
    return bilinear_raster_remap_2d({
        "source": {"width": SIDE, "height": SIDE, "pixels": source_pixels},
        "outputWidth": SIDE, "outputHeight": SIDE, "sourceCoordinates": coordinates,
    })
