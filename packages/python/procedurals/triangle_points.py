"""Retained triangle point geometry specified by the frozen CP5 contracts.

Motivating notes: survey/out/2018/Generativos/puntis/notes.md,
puntis2/notes.md, and puntis3/notes.md.  The operations own only sampling and
coordinate mapping; they do not draw, choose styles, or preserve source modes.
"""
from array import array
from dataclasses import dataclass
import math

__all__ = ["TrianglePointsError", "seeded_triangle_points_2d",
           "map_triangle_coordinates_2d"]

_MAX_COUNT = 1_073_741_823
_MAX_SAFE = 9_007_199_254_740_991
_MASK32 = (1 << 32) - 1
_MASK64 = (1 << 64) - 1


class TrianglePointsError(ValueError):
    """A stable triangle-operation error with the catalog error code."""
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _invalid(code="INVALID_INPUT"):
    raise TrianglePointsError(code)


def _number(value):
    if type(value) not in (int, float):
        _invalid()
    try:
        number = float(value)
    except OverflowError:
        _invalid()
    if not math.isfinite(number):
        _invalid()
    return 0.0 if number == 0.0 else number


def _integer(value, maximum, code):
    # Inspect arbitrary-size ints before conversion, so a huge int is a stable
    # contract error rather than an OverflowError from float/int conversion.
    if type(value) is int:
        if value < 0 or value > maximum:
            _invalid(code)
        return value
    if type(value) is float:
        if not math.isfinite(value) or not value.is_integer() or value < 0 or value > maximum:
            _invalid(code)
        return int(value)
    _invalid(code)


def _record(config, keys):
    if type(config) is not dict or len(config) != len(keys) or any(key not in config for key in keys):
        _invalid()
    return config


def _triangle(value):
    if type(value) is not list or len(value) != 3:
        _invalid()
    values = [0.0] * 6
    for index in range(3):
        vertex = value[index]
        if type(vertex) is not list or len(vertex) != 2:
            _invalid()
        values[2 * index] = _number(vertex[0])
        values[2 * index + 1] = _number(vertex[1])
    return tuple(values)


def _units(value):
    if type(value) is not list or len(value) > _MAX_COUNT:
        _invalid()
    # This validation deliberately retains no O(N) copy.  Mapping reads the
    # passive caller list only after the full static pass has succeeded.
    for row in value:
        if type(row) is not list or len(row) != 2:
            _invalid()
        u = _number(row[0])
        if u < 0.0 or u > 1.0:
            _invalid()
        v = _number(row[1])
        if v < 0.0 or v > 1.0:
            _invalid()
    return value


def _zero(value):
    return 0.0 if value == 0.0 else value


def _lerp(a, b, t):
    if t == 0.0:
        return _zero(a)
    if t == 1.0:
        return _zero(b)
    if (a < 0.0 < b) or (b < 0.0 < a):
        # Keep these operations separated: this is the specified opposite-sign
        # weighted form, rather than the difference form below.
        raw = a * (1.0 - t) + b * t
    else:
        raw = a + (b - a) * t
    low, high = min(a, b), max(a, b)
    if raw < low:
        raw = low
    elif raw > high:
        raw = high
    return _zero(raw)


def _map_into(triangle, u, v, points):
    root = math.sqrt(u)
    points.append(_lerp(triangle[0], _lerp(triangle[2], triangle[4], v), root))
    points.append(_lerp(triangle[1], _lerp(triangle[3], triangle[5], v), root))


class _Stream:
    """Private xoshiro128** 1.1 stream with two SplitMix64 expansion words."""
    def __init__(self, seed):
        state = seed + 0x9E3779B97F4A7C15
        first = self._split(state)
        second = self._split(state + 0x9E3779B97F4A7C15)
        self._state = [first & _MASK32, first >> 32, second & _MASK32, second >> 32]

    @staticmethod
    def _split(value):
        value &= _MASK64
        value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & _MASK64
        value = ((value ^ (value >> 27)) * 0x94D049BB133111EB) & _MASK64
        return (value ^ (value >> 31)) & _MASK64

    def output(self):
        state = self._state
        value = (state[1] * 5) & _MASK32
        result = ((((value << 7) | (value >> 25)) & _MASK32) * 9) & _MASK32
        temporary = (state[1] << 9) & _MASK32
        state[2] ^= state[0]
        state[3] ^= state[1]
        state[1] ^= state[2]
        state[0] ^= state[3]
        state[2] ^= temporary
        state[3] = ((state[3] << 11) | (state[3] >> 21)) & _MASK32
        return result

    def unit(self):
        return self.output() / 4294967296.0

    def state(self):
        return self._state.copy()


@dataclass(frozen=True, slots=True)
class _Result:
    _points: array

    @property
    def size(self):
        return len(self._points) // 2

    def _index(self, index):
        index = _integer(index, _MAX_SAFE, "INVALID_INDEX")
        if index >= self.size:
            _invalid("INDEX_OUT_OF_RANGE")
        return index

    def point_at(self, index):
        index = self._index(index) * 2
        return [_zero(self._points[index]), _zero(self._points[index + 1])]

    def point_into(self, index, out, offset=0):
        index = self._index(index) * 2
        offset = _integer(offset, _MAX_SAFE, "INVALID_OUTPUT")
        if not (type(out) is list or (type(out) is array and out.typecode == "d" and out.itemsize == 8)):
            _invalid("INVALID_OUTPUT")
        if offset > len(out) - 2:
            _invalid("INVALID_OUTPUT")
        # Exact lists and array('d') have writable fixed binary64 slots.  Both
        # checks precede either assignment, so a failure cannot partly mutate out.
        out[offset] = _zero(self._points[index])
        out[offset + 1] = _zero(self._points[index + 1])

    def to_values(self):
        return {"points": [self.point_at(index) for index in range(self.size)]}


def seeded_triangle_points_2d(config):
    """Retain uniform samples; motivated by survey/out/2018/Generativos/puntis2/notes.md.

    Seed, count and ordered vertices are explicit. No measured continuous useful
    count/coordinate range is claimed; the catalog ceiling is representational.
    """
    record = _record(config, ("seed", "count", "triangle"))
    seed = _integer(record["seed"], _MASK32, "INVALID_INPUT")
    count = _integer(record["count"], _MAX_COUNT, "INVALID_INPUT")
    triangle = _triangle(record["triangle"])
    if count == 0:
        return _Result(array("d"))
    points, stream = array("d"), _Stream(seed)
    for _ in range(count):
        _map_into(triangle, stream.unit(), stream.unit(), points)
    return _Result(points)


def map_triangle_coordinates_2d(config):
    """Map caller pairs; motivated by survey/out/2018/Generativos/puntis/notes.md
    and puntis3/notes.md. [0,1] is the unit-coordinate domain, not a recommended
    distribution or an observed-useful artistic range. No random stream is owned.
    """
    record = _record(config, ("triangle", "unitCoordinates"))
    triangle = _triangle(record["triangle"])
    coordinates = _units(record["unitCoordinates"])
    points = array("d")
    for row in coordinates:
        _map_into(triangle, _number(row[0]), _number(row[1]), points)
    return _Result(points)
