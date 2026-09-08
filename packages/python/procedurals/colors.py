"""Portable colour operations.

This module implements the reviewed ``color.cyclic-palette`` operation.  It
samples an immutable ordered RGB24 palette at a phase measured in cycles,
interpolating the encoded sRGB8 channels directly.  The operation is
renderer-independent and has no approved artistic defaults or parameter
ranges; its computation is motivated by ``2018/Generativos/mountain4#2``,
``2018/Generativos/pelines#1`` and ``2017/Generativos/Cuadricula#1``.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
import math
from typing import Any


__all__ = ["CyclicPaletteError", "cyclic_palette"]

_MAX_PALETTE_LENGTH = 2_147_483_647
_MAX_RGB24 = 16_777_215
_PARAM_KEYS = frozenset(("colors",))


class CyclicPaletteError(ValueError):
    """Stable cyclic-palette operation error with a catalog ``.code``."""

    def __init__(self, code: str, message: str | None = None) -> None:
        self.code = code
        super().__init__(message or code)


def _fail(code: str, message: str) -> None:
    raise CyclicPaletteError(code, message)


def _rgb24(value: Any) -> int:
    """Validate one mathematical integral unsigned RGB24 value."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        _fail("INVALID_INPUT", "colors must contain integral RGB24 values")
    if isinstance(value, float):
        if not math.isfinite(value) or not value.is_integer():
            _fail("INVALID_INPUT", "colors must contain integral RGB24 values")
    try:
        result = int(value)
    except (OverflowError, ValueError):
        _fail("INVALID_INPUT", "color is not a representable integer")
    if result < 0 or result > _MAX_RGB24:
        _fail("INVALID_INPUT", "color is outside the RGB24 range")
    return result


def _phase(value: Any) -> float:
    """Convert an accepted Python number to finite binary64 phase."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        _fail("INVALID_QUERY", "phase must be a finite number")
    try:
        result = float(value)
    except (OverflowError, ValueError):
        _fail("INVALID_QUERY", "phase is not representable as binary64")
    if not math.isfinite(result):
        _fail("INVALID_QUERY", "phase must be finite")
    return 0.0 if result == 0.0 else result


@dataclass(frozen=True, slots=True)
class _CyclicPalette:
    """Private immutable ordered RGB24 palette sampler."""

    _colors: tuple[int, ...]

    def serialize(self) -> dict[str, list[int]]:
        """Return a detached canonical ``{"colors": [...]}`` descriptor."""
        return {"colors": list(self._colors)}

    def sample(self, phase: Any) -> int:
        """Sample one finite binary64 phase in cycles and return an RGB24 int."""
        normalized = _phase(phase)
        length = len(self._colors)
        if length == 1:
            return self._colors[0]
        f = normalized - math.floor(normalized)
        if f == 0.0 or f == 1.0:
            f = 0.0
        x = f * length
        if x == length:
            x = 0.0
        index = math.floor(x)
        fraction = x - index
        next_index = 0 if index + 1 == length else index + 1
        first = self._colors[index]
        second = self._colors[next_index]
        red = _channel(first, 16, second, fraction)
        green = _channel(first, 8, second, fraction)
        blue = _channel(first, 0, second, fraction)
        return red * 65_536 + green * 256 + blue


def _channel(first: int, shift: int, second: int, fraction: float) -> int:
    """Interpolate one encoded channel, then apply explicit half-up quantization."""
    a = (first >> shift) & 0xFF
    b = (second >> shift) & 0xFF
    difference = b - a
    product = fraction * difference
    value = a + product
    return math.floor(value + 0.5)


def cyclic_palette(params: Any) -> _CyclicPalette:
    """Construct the reviewed immutable ``color.cyclic-palette`` sampler.

    The operation is motivated by ``mountain4#2``, ``pelines#1`` and
    ``Cuadricula#1``; those reports establish cyclic neighbour interpolation,
    not a default palette, phase or encouraged artistic range.  Colours are
    opaque encoded RGB24 entries and phase is measured in palette cycles.
    """
    if not isinstance(params, Mapping) or set(params) != _PARAM_KEYS:
        _fail("INVALID_INPUT", "parameters must contain exactly the colors key")
    colors = params["colors"]
    if not isinstance(colors, (list, tuple)):
        _fail("INVALID_INPUT", "colors must be a list or tuple")
    length = len(colors)
    if length < 1 or length > _MAX_PALETTE_LENGTH:
        _fail("INVALID_INPUT", "colors must be nonempty and within the length bound")
    # Validate in order before retaining anything, then snapshot caller data.
    return _CyclicPalette(tuple(_rgb24(value) for value in colors))
