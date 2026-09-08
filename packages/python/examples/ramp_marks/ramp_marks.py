"""Example-owned composition: retain one positioned color ramp, sample it at a fixed
grid of dots using either a linear or radial scalar coordinate.

Motivated by the color.stop-ramp reference (see catalog/validation/stop-ramp.json,
targets.processing-java.technique). The ramp uses the reviewed portable color.stop-ramp
operation; rendering and interactive controls belong to a target starter. These
constants describe one bounded piece, never public operation defaults or encouraged
ranges.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterator

from procedurals import stop_ramp

BASE_POSITIONS = (0.0, 0.25, 0.8, 1.0)
SHIFTED_POSITIONS = (0.0, 0.6, 0.8, 1.0)
BASE_COLORS = (0x173F5F, 0x2A9D8F, 0xE9C46A, 0xE76F51)
ALTERNATE_COLORS = (0x352344, 0xB84A62, 0xF4E8C1, 0x477AAB)
BACKGROUND_RGB = 0xF8F5EE
GRID_STEP = 24
GRID_ORIGIN = 12
DOT_DIAMETER = 16
_CANVAS_SIZE = 640


@dataclass(frozen=True, slots=True)
class RampMarks:
    """Retained ramp for style-only recolor/shift edits; the radial toggle draws only."""
    shifted: bool
    alternate: bool
    ramp: object


def create_ramp_marks(shifted: bool = False, alternate: bool = False) -> RampMarks:
    positions = SHIFTED_POSITIONS if shifted else BASE_POSITIONS
    colors = ALTERNATE_COLORS if alternate else BASE_COLORS
    stops = [{"position": position, "color": color} for position, color in zip(positions, colors)]
    return RampMarks(shifted, alternate, stop_ramp({"stops": stops}))


def ramp_grid_value(x: float, y: float, radial: bool) -> float:
    """The exact scalar coordinate sampled at one grid dot, linear or radial."""
    if radial:
        return math.hypot(x - _CANVAS_SIZE / 2, y - _CANVAS_SIZE / 2) / (_CANVAS_SIZE * 0.65)
    return x / (_CANVAS_SIZE - 1)


def ramp_grid_dots(model: RampMarks, radial: bool) -> Iterator[dict]:
    """Yield {x, y, rgb} for every grid dot; positions/size stay fixed across edits."""
    y = GRID_ORIGIN
    while y < _CANVAS_SIZE:
        x = GRID_ORIGIN
        while x < _CANVAS_SIZE:
            value = ramp_grid_value(x, y, radial)
            yield {"x": x, "y": y, "rgb": model.ramp.sample(value)}
            x += GRID_STEP
        y += GRID_STEP
