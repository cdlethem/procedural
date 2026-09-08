"""Immutable noncyclic positioned RGB24 color stops independently specified by the
shared color.stop-ramp contract.

Motivating notes: survey/out/2016/Generativos/boxDepth/notes.md,
survey/out/2016/Generativos/celular/notes.md,
survey/out/2016/Generativos/colorRamp/notes.md and
survey/out/2016/Generativos/triangleRamp/notes.md. No artistic stop-count/position/
palette range is established; see the catalog contract for evidence.
"""
from dataclasses import dataclass
import math

__all__ = ["StopRampError", "stop_ramp"]
_MAX_COLOR = 16777215


class StopRampError(ValueError):
    """Stable catalog code: INVALID_INPUT or INVALID_QUERY."""
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _fail(code):
    raise StopRampError(code)


def _number(value, code):
    if type(value) not in (int, float) or type(value) is bool:
        _fail(code)
    try:
        value = float(value)
    except OverflowError:
        raise StopRampError(code) from None
    if not math.isfinite(value):
        _fail(code)
    return value


def _checked_position(value):
    position = _number(value, "INVALID_INPUT")
    if position < 0 or position > 1:
        _fail("INVALID_INPUT")
    return 0.0 if position == 0 else position


def _checked_color(value):
    color = _number(value, "INVALID_INPUT")
    if color < 0 or color > _MAX_COLOR or color != math.floor(color):
        _fail("INVALID_INPUT")
    return int(color)


def _channel(a, b, t):
    difference = b - a
    product = difference * t
    value = a + product
    return math.floor(value + 0.5)


@dataclass(frozen=True, slots=True)
class _Ramp:
    _positions: list
    _colors: list

    def serialize(self):
        """Export detached ordered position/color stop records; retain none."""
        return {"stops": [{"position": p, "color": c} for p, c in zip(self._positions, self._colors)]}

    def sample(self, query):
        """Sample one RGB24 color; endpoint holds outside the first/last stop."""
        value = _number(query, "INVALID_QUERY")
        positions, colors = self._positions, self._colors
        if value <= positions[0]:
            return colors[0]
        last = len(positions) - 1
        if value >= positions[last]:
            return colors[last]
        left, right = 0, last
        while right - left > 1:
            middle = left + (right - left) // 2
            if value < positions[middle]:
                right = middle
            else:
                left = middle
        if value == positions[left]:
            return colors[left]
        if value == positions[right]:
            return colors[right]
        numerator = value - positions[left]
        denominator = positions[right] - positions[left]
        t = numerator / denominator
        a, b = colors[left], colors[right]
        red = _channel((a >> 16) & 255, (b >> 16) & 255, t)
        green = _channel((a >> 8) & 255, (b >> 8) & 255, t)
        blue = _channel(a & 255, b & 255, t)
        return red * 65536 + green * 256 + blue


def stop_ramp(config):
    """Build immutable positioned RGB24 color stops from {"stops": [{"position","color"}, ...]}.

    Implements color.stop-ramp 0.1.0 independently of source code.
    """
    if type(config) is not dict or set(config) != {"stops"}:
        _fail("INVALID_INPUT")
    stop_values = config["stops"]
    if type(stop_values) is not list:
        _fail("INVALID_INPUT")
    if len(stop_values) == 0:
        _fail("INVALID_INPUT")
    positions = [0.0] * len(stop_values)
    colors = [0] * len(stop_values)
    for index, stop_value in enumerate(stop_values):
        if type(stop_value) is not dict or set(stop_value) != {"position", "color"}:
            _fail("INVALID_INPUT")
        position = _checked_position(stop_value["position"])
        if index > 0 and not (position > positions[index - 1]):
            _fail("INVALID_INPUT")
        positions[index] = position
        colors[index] = _checked_color(stop_value["color"])
    return _Ramp(positions, colors)
