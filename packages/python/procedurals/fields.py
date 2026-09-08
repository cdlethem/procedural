"""Portable scalar fields.

The implementation in this module is renderer independent.  The reviewed
``field.gradient-noise-2d-01`` operation is an independently specified,
single-octave gradient field; it is not Processing's ``noise()`` function.

The integer mixer is ``lowbias32`` from Hash Function Prospector
(https://github.com/skeeto/hash-prospector), published under the Unlicense;
see the repository's ``THIRD_PARTY_NOTICES.md``.  The lattice combiner and
gradient ordering are project choices.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
import math
from typing import Any


__all__ = ["GradientNoiseError", "gradient_noise_2d_01"]

_MASK32 = 0xFFFFFFFF
_MAX_SAFE_INTEGER = 9_007_199_254_740_991
_MISSING = object()
_GRADIENTS = (
    (1, 0),
    (-1, 0),
    (0, 1),
    (0, -1),
    (1, 1),
    (-1, 1),
    (1, -1),
    (-1, -1),
)


class GradientNoiseError(ValueError):
    """Stable gradient-noise operation error with a catalog ``.code``."""

    def __init__(self, code: str, message: str | None = None) -> None:
        self.code = code
        super().__init__(message or code)


def _fail(code: str, message: str) -> None:
    raise GradientNoiseError(code, message)


def _u32(value: int) -> int:
    """Return the mathematical low 32 bits of an integer."""
    return value & _MASK32


def _mix32(value: int) -> int:
    """The reviewed unsigned32 lowbias32 mixer, with each step wrapped."""
    value = _u32(value)
    value ^= value >> 16
    value = (value * 0x7FEB352D) & _MASK32
    value ^= value >> 15
    value = (value * 0x846CA68B) & _MASK32
    return (value ^ (value >> 16)) & _MASK32


def _corner_hash(seed: int, i: int, j: int) -> int:
    """Hash one integer lattice corner to an unsigned32 value."""
    first = _mix32(_u32(seed) ^ _u32(i) ^ 0x9E3779B9)
    return _mix32(first ^ _u32(j) ^ 0x85EBCA6B)


def _coordinate(value: Any) -> float:
    """Convert a Python number to binary64 and validate its safe cell domain."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        _fail("INVALID_QUERY", "query coordinates must be numeric")
    try:
        result = float(value)
    except (OverflowError, ValueError):
        _fail("INVALID_QUERY", "query coordinate is not representable")
    if not math.isfinite(result):
        _fail("INVALID_QUERY", "query coordinates must be finite")
    if result < -_MAX_SAFE_INTEGER or result >= _MAX_SAFE_INTEGER:
        _fail("INVALID_QUERY", "query coordinate is outside the safe lattice domain")
    return result


def _seed(value: Any) -> int:
    """Validate a seed as an unsigned32 mathematical integer."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        _fail("INVALID_INPUT", "seed must be an integer")
    if isinstance(value, float):
        if not math.isfinite(value) or not value.is_integer():
            _fail("INVALID_INPUT", "seed must be an integer")
    try:
        result = int(value)
    except (OverflowError, ValueError):
        _fail("INVALID_INPUT", "seed must be an integer")
    if result < 0 or result > _MASK32:
        _fail("INVALID_INPUT", "seed is outside the unsigned32 domain")
    return result


def _dot(seed: int, i: int, j: int, dx: float, dy: float) -> float:
    gradient = _GRADIENTS[_corner_hash(seed, i, j) & 7]
    # Keep the two products and their addition as separate binary64 steps.
    px = gradient[0] * dx
    py = gradient[1] * dy
    return px + py


def _fade(value: float) -> float:
    # Deliberately retain the contract's operation order (and avoid FMA).
    a = value * value
    b = a * value
    c = 6.0 * value
    d = c - 15.0
    e = value * d
    f = e + 10.0
    return b * f


def _lerp(a: float, b: float, t: float) -> float:
    difference = b - a
    product = t * difference
    return a + product


@dataclass(frozen=True, slots=True)
class _GradientNoise2D01:
    """Private immutable seed-only gradient field."""

    _seed_value: int

    def serialize(self) -> dict[str, int]:
        """Return a detached canonical ``{"seed": ...}`` descriptor."""
        return {"seed": self._seed_value}

    def sample(self, query_or_x: Any, y: Any = _MISSING) -> float:
        """Sample with ``sample([x, y])`` or ``sample(x, y)`` without a query-container allocation.

        The scalar route is intended for native hot loops.  The tuple/list route
        validates its shape before either coordinate, as required by the
        interchange contract.
        """
        if y is _MISSING:
            query = query_or_x
            if not isinstance(query, (list, tuple)) or len(query) != 2:
                _fail("INVALID_QUERY", "query must contain exactly two coordinates")
            x = _coordinate(query[0])
            y_value = _coordinate(query[1])
            return self._sample_coordinates(x, y_value)
        x = _coordinate(query_or_x)
        y_value = _coordinate(y)
        return self._sample_coordinates(x, y_value)

    def _sample_coordinates(self, x: float, y: float) -> float:
        # math.floor returns an arbitrary precision integer, retaining all safe
        # lattice bits.  Only _corner_hash performs the modulo-2^32 reduction.
        i = math.floor(x)
        j = math.floor(y)
        u = x - i
        v = y - j

        n00 = _dot(self._seed_value, i, j, u, v)
        n10 = _dot(self._seed_value, i + 1, j, u - 1.0, v)
        n01 = _dot(self._seed_value, i, j + 1, u, v - 1.0)
        n11 = _dot(self._seed_value, i + 1, j + 1, u - 1.0, v - 1.0)
        fx = _fade(u)
        fy = _fade(v)
        bottom = _lerp(n00, n10, fx)
        top = _lerp(n01, n11, fx)
        raw = _lerp(bottom, top, fy)
        scaled = 0.5 * raw
        result = 0.5 + scaled
        if result <= 0.0:
            return 0.0
        if result >= 1.0:
            return 1.0
        return 0.0 if result == 0.0 else result


def gradient_noise_2d_01(params: Any) -> _GradientNoise2D01:
    """Construct the reviewed immutable ``field.gradient-noise-2d-01`` field.

    The field has no approved artistic seed range or default.  Its seed is a
    required unsigned32 identity; the operation is motivated by
    ``2018/Generativos/pelines`` and is not Processing-noise compatibility.
    """
    if not isinstance(params, Mapping) or set(params) != {"seed"}:
        _fail("INVALID_INPUT", "parameters must contain exactly the seed key")
    return _GradientNoise2D01(_seed(params["seed"]))

