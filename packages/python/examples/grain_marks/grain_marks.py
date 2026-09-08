"""Example-owned retained grain composition matching Java GrainComposition.

The canvas, density, and two biased coordinate expressions are choices for the
editable GrainMarks example.  They are not sampling-operation defaults.
"""
from dataclasses import dataclass
import math

from procedurals.quadrant_partition import seeded_quadrant_partition_2d
from procedurals.triangle_points import (
    map_triangle_coordinates_2d,
    seeded_triangle_points_2d,
)

_MASK48 = (1 << 48) - 1
_MULTIPLIER = 0x5DEECE66D
_POINT_BUDGET = 160_000


class _JavaExampleRandom:
    """The example's private java.util.Random-compatible nextDouble stream."""
    def __init__(self, seed):
        self._state = (seed ^ _MULTIPLIER) & _MASK48

    def _next(self, bits):
        self._state = (self._state * _MULTIPLIER + 11) & _MASK48
        return self._state >> (48 - bits)

    def next_double(self):
        return (self._next(26) * 134217728 + self._next(27)) / 9007199254740992.0


@dataclass(frozen=True, slots=True)
class _GrainComposition:
    _regions: tuple
    _total_points: int

    @property
    def size(self):
        return len(self._regions)

    @property
    def total_points(self):
        return self._total_points

    def region_at(self, index):
        return self._regions[index]


def _triangle(ax, ay, bx, by, cx, cy):
    return [[ax, ay], [bx, by], [cx, cy]]


def _triangles(seed, cells):
    if not cells:
        return [_triangle(40.0, 600.0, 320.0, 40.0, 600.0, 600.0)]
    layout = seeded_quadrant_partition_2d({
        "seed": seed, "replacements": 4, "selectionFraction": 0.5,
        "origin": [0.0, 0.0], "extent": [640.0, 640.0],
    })
    triangles, bounds = [], [0.0] * 4
    for index in range(layout.size):
        layout.bounds_into(index, bounds)
        left, top, right, bottom = bounds
        triangles.append(_triangle(left, top, right, top, right, bottom))
        triangles.append(_triangle(left, top, right, bottom, left, bottom))
    return triangles


def _counts(triangles, density):
    counts, total = [], 0
    for triangle in triangles:
        a, b, c = triangle
        area = abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * 0.5
        requested = area * density
        if not math.isfinite(requested):
            raise ValueError("example exceeds 160000-point work budget")
        count = math.ceil(requested)
        if count > _POINT_BUDGET - total:
            raise ValueError("example exceeds 160000-point work budget")
        counts.append(count)
        total += count
    return counts, total


def _biased_units(seed, count, distribution):
    random = _JavaExampleRandom(seed)
    units = []
    for _ in range(count):
        if distribution == 1:
            u = random.next_double() * random.next_double()
            v = random.next_double()
        else:
            side = 0 if random.next_double() < 0.5 else 1
            lower = side * 0.8
            v = (lower + (1.0 - lower) * random.next_double()) * (0.4 + 0.6 * random.next_double())
            u = random.next_double()
        units.append([u, v])
    return units


def create_grain_composition(seed, density, distribution, cells):
    """Build retained grain; motivated by survey/out/2018/Generativos/puntis/notes.md
    and puntis3/notes.md. Density is an example choice, not a measured useful range.

    Distribution zero uses the seeded public core.  One and two materialize the
    example's Java-Random caller pairs then use the explicit mapping core.
    """
    if type(density) in (int, float):
        try:
            density_value = float(density)
        except OverflowError:
            density_value = math.inf
    else:
        density_value = math.nan
    if (type(seed) is not int or seed < 0 or seed > 0xFFFFFFFF
            or not math.isfinite(density_value) or density_value < 0
            or type(distribution) is not int or distribution < 0 or distribution > 2
            or type(cells) is not bool):
        raise ValueError("invalid example configuration")
    triangles = _triangles(seed, cells)
    counts, total = _counts(triangles, density_value)
    regions = []
    for index, triangle in enumerate(triangles):
        region_seed = (seed + index) & 0xFFFFFFFF
        if distribution == 0:
            regions.append(seeded_triangle_points_2d({
                "seed": region_seed, "count": counts[index], "triangle": triangle,
            }))
        else:
            regions.append(map_triangle_coordinates_2d({
                "triangle": triangle,
                "unitCoordinates": _biased_units(region_seed, counts[index], distribution),
            }))
    return _GrainComposition(tuple(regions), total)
