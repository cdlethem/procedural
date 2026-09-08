"""Example-owned CP2 composition: draw movement, then choose marks.

Motivated by 2019/generativos/ciserp, 2018/Generativos/mantel,
2019/generativos/natalata and 2019/generativos/limo002. The paths use the
reviewed portable operations; rendering and interactive controls belong to a
target starter. These constants describe one bounded piece, never public
operation defaults or encouraged ranges.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Iterator, Sequence

from procedurals import cyclic_palette, gradient_path_2d, regular_grid

BASE_PALETTE = (0x31A151, 0xFFA71E, 0x05084C, 0xDE4638, 0x3DBDB7)
ALTERNATE_PALETTE = (0x2E0551, 0xFF00C7, 0x01AFC2, 0xFDBE03, 0xF4F9FD)


@dataclass(frozen=True, slots=True)
class PathMarks:
    """Retained movement paths for style-only trace, mark, and palette edits."""

    paths: tuple[object, ...]

    @property
    def path_count(self) -> int:
        return len(self.paths)

    def path_at(self, index: int) -> object:
        return self.paths[index]


def create_path_marks(seed: int = 42, steps: int = 2_000,
                      distance: float = 0.4) -> PathMarks:
    """Trace the accepted 6×4 composition sequentially using public operations.

    Changing ``seed``, ``steps`` or ``distance`` deliberately constructs new
    movement. Mark length, trace-versus-mark mode and palette should instead
    reuse the returned immutable paths through :func:`path_mark_commands`.
    """
    starts = regular_grid({
        "origin": [60.0, 80.0], "spacing": [104.0, 160.0],
        "columns": 6, "rows": 4,
    })
    point = [0.0, 0.0]
    paths = []
    for index in range(starts.size):
        starts.point_into(index, point)
        paths.append(gradient_path_2d({
            "field": {"seed": seed}, "start": [point[0], point[1]],
            "steps": steps, "stepDistance": distance,
            "fieldScale": 0.002, "fieldOffset": [0.0, 0.0],
            "angleBase": -20.0, "angleScale": 40.0,
        }))
    return PathMarks(tuple(paths))


def perpendicular_mark(x: float, y: float, heading: float, length: float,
                       rgb: int) -> dict[str, object]:
    """Return one independent mark centered at the endpoint of a movement step."""
    perpendicular = heading + math.pi / 2.0
    half = length * 0.5
    dx = half * math.cos(perpendicular)
    dy = half * math.sin(perpendicular)
    return _segment(x - dx, y - dy, x + dx, y + dy, rgb)


def path_mark_commands(model: PathMarks, *, trace: bool, mark_length: float,
                       colors: Sequence[int] = BASE_PALETTE) -> Iterator[dict[str, object]]:
    """Yield bounded plain commands without retaining the command stream.

    Trace mode yields one independent segment per advance. Mark mode uses
    headings at 0, 4, 8, … and attaches each perpendicular mark to point i+1.
    Palette and mark edits read the retained paths and never call integration.
    """
    palette = cyclic_palette({"colors": list(colors)})
    palette_length = len(colors)
    for path_index, path in enumerate(model.paths):
        rgb = palette.sample((path_index % palette_length) / palette_length)
        stride = 1 if trace else 4
        for index in range(0, path.steps, stride):
            endpoint = path.point_at(index + 1)
            if trace:
                start = path.point_at(index)
                yield _segment(start[0], start[1], endpoint[0], endpoint[1], rgb)
            else:
                yield perpendicular_mark(endpoint[0], endpoint[1], path.heading_at(index),
                                         mark_length, rgb)


def visible_path_mark_commands(model: PathMarks, *, trace: bool, mark_length: float,
                               colors: Sequence[int] = BASE_PALETTE) -> Iterator[dict[str, object]]:
    """Stream only marks that can affect the fixed 640px example canvas.

    This is an example drawing boundary, not clipping or a transform of the
    retained paths. It delegates raw construction to :func:`path_mark_commands`
    and omits a segment only when its complete bounding box misses the canvas
    padded by one pixel: ``[-1, 641]²``. The registered stroke is one pixel
    wide with round caps; the maximum mark length is 24, so the remaining
    command endpoints are within ``[-25, 665]²`` and satisfy the drawing
    adapter's broader input domain. Kept commands preserve raw order and
    coordinates exactly.
    """
    for command in path_mark_commands(model, trace=trace, mark_length=mark_length, colors=colors):
        start, end = command["from"], command["to"]
        if (max(start[0], end[0]) < -1.0 or min(start[0], end[0]) > 641.0 or
                max(start[1], end[1]) < -1.0 or min(start[1], end[1]) > 641.0):
            continue
        yield command


def _segment(x1: float, y1: float, x2: float, y2: float,
             rgb: int) -> dict[str, object]:
    return {
        "kind": "segment2", "from": [x1, y1], "to": [x2, y2],
        "rgb": rgb, "opacity8": 150, "width": 1, "cap": "round",
    }
