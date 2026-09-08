"""Retained binary64 gradient-field paths.

This module implements the reviewed ``path.gradient-trace-2d`` operation. It
retains geometry only: callers choose marks, rendering, palettes, clipping and
any envelope separately.
"""

from __future__ import annotations

from array import array
from dataclasses import dataclass
import math
import struct
from typing import Any

from .fields import gradient_noise_2d_01

__all__ = ["GradientPathError", "gradient_path_2d"]

_MAX_STEPS = 1_073_741_822
_MAX_SAFE_INTEGER = 9_007_199_254_740_991
_PARAM_KEYS = frozenset((
    "field", "start", "steps", "stepDistance", "fieldScale", "fieldOffset",
    "angleBase", "angleScale",
))


class GradientPathError(ValueError):
    """Stable gradient-path error with catalog ``code`` and dynamic details."""

    def __init__(self, code: str, message: str | None = None, *,
                 step_index: int | None = None, stage: str | None = None) -> None:
        self.code = code
        self.step_index = step_index
        self.stage = stage
        super().__init__(message or code)


def _fail(code: str, message: str) -> None:
    raise GradientPathError(code, message)


def _dynamic(code: str, step_index: int, stage: str) -> None:
    raise GradientPathError(code, code, step_index=step_index, stage=stage)


def _number(value: Any) -> float:
    """Accept only builtin int/float and canonicalize a finite binary64 zero."""
    if type(value) not in (int, float):
        _fail("INVALID_INPUT", "expected a finite builtin numeric value")
    try:
        result = float(value)
    except (OverflowError, ValueError):
        _fail("INVALID_INPUT", "numeric value is not representable as binary64")
    if not math.isfinite(result):
        _fail("INVALID_INPUT", "numeric value must be finite")
    return 0.0 if result == 0.0 else result


def _count(value: Any, *, maximum: int, label: str) -> int:
    """Validate an integer domain without converting huge Python integers first."""
    if type(value) is int:
        if value < 0 or value > maximum:
            _fail("INVALID_INPUT", f"{label} is outside its supported range")
        return value
    if type(value) is not float or not math.isfinite(value) or not value.is_integer():
        _fail("INVALID_INPUT", f"{label} must be a finite integral value")
    result = int(value)
    if result < 0 or result > maximum:
        _fail("INVALID_INPUT", f"{label} is outside its supported range")
    return result


def _pair(value: Any, label: str) -> tuple[float, float]:
    if type(value) is not list or len(value) != 2:
        _fail("INVALID_INPUT", f"{label} must be an exact builtin two-value list")
    return _number(value[0]), _number(value[1])


def _configuration(params: Any) -> tuple[int, tuple[float, float], int, float, float,
                                         tuple[float, float], float, float]:
    # The validation sequence is contract-visible through failure classification.
    if type(params) is not dict or set(params) != _PARAM_KEYS:
        _fail("INVALID_INPUT", "parameters must contain exactly the eight required keys")
    field = params["field"]
    if type(field) is not dict or set(field) != {"seed"}:
        _fail("INVALID_INPUT", "field must contain exactly the seed key")
    seed = _count(field["seed"], maximum=0xFFFFFFFF, label="field seed")
    start = _pair(params["start"], "start")
    steps = _count(params["steps"], maximum=_MAX_STEPS, label="steps")
    distance = _number(params["stepDistance"])
    if distance < 0.0:
        _fail("INVALID_INPUT", "stepDistance must be nonnegative")
    field_scale = _number(params["fieldScale"])
    field_offset = _pair(params["fieldOffset"], "fieldOffset")
    angle_base = _number(params["angleBase"])
    angle_scale = _number(params["angleScale"])
    return seed, start, steps, distance, field_scale, field_offset, angle_base, angle_scale


def _checked_query(value: float, step_index: int, stage: str) -> float:
    if not math.isfinite(value) or value < -_MAX_SAFE_INTEGER or value >= _MAX_SAFE_INTEGER:
        _dynamic("TRACE_QUERY_INVALID", step_index, stage)
    # Intermediate signed zero is intentionally retained until field sampling.
    return value


def _checked_query_product(value: float, step_index: int, stage: str) -> float:
    """Reject only nonfinite products; apply query-domain limits after addition."""
    if not math.isfinite(value):
        _dynamic("TRACE_QUERY_INVALID", step_index, stage)
    return value


def _checked_arithmetic(value: float, step_index: int, stage: str) -> float:
    if not math.isfinite(value):
        _dynamic("TRACE_ARITHMETIC_INVALID", step_index, stage)
    return value


def _index(value: Any, upper_bound: int) -> int:
    if type(value) is int:
        result = value
    elif type(value) is float and math.isfinite(value) and value.is_integer():
        result = int(value)
    else:
        _fail("INVALID_INDEX", "index must be a finite safe nonnegative integer")
    if result < 0 or result > _MAX_SAFE_INTEGER:
        _fail("INVALID_INDEX", "index must be a finite safe nonnegative integer")
    if result > upper_bound:
        _fail("INDEX_OUT_OF_RANGE", "index is outside this path")
    return result


def _offset(value: Any) -> int:
    if type(value) is int:
        result = value
    elif type(value) is float and math.isfinite(value) and value.is_integer():
        result = int(value)
    else:
        _fail("INVALID_OUTPUT", "offset must be a finite safe nonnegative integer")
    if result < 0 or result > _MAX_SAFE_INTEGER:
        _fail("INVALID_OUTPUT", "offset must be a finite safe nonnegative integer")
    return result


def _buffer(value: Any, offset: int) -> None:
    if type(value) is list:
        length = len(value)
    elif type(value) is array and value.typecode == "d":
        length = len(value)
    else:
        _fail("INVALID_OUTPUT", "output must be an exact builtin list or array('d')")
    if offset > length or length - offset < 2:
        _fail("INVALID_OUTPUT", "output requires two writable binary64 slots")


def _copy_configuration(seed: int, start: tuple[float, float], steps: int, distance: float,
                        field_scale: float, offset: tuple[float, float], angle_base: float,
                        angle_scale: float) -> dict[str, Any]:
    return {
        "field": {"seed": seed}, "start": [start[0], start[1]], "steps": steps,
        "stepDistance": distance, "fieldScale": field_scale,
        "fieldOffset": [offset[0], offset[1]], "angleBase": angle_base,
        "angleScale": angle_scale,
    }


def _stored_value(storage: bytes, index: int) -> float:
    return struct.unpack_from("=d", storage, index * 8)[0]


def _copy_values(positions: bytes, headings: bytes) -> dict[str, list[Any]]:
    return {
        "positions": [[_stored_value(positions, index), _stored_value(positions, index + 1)]
                      for index in range(0, len(positions) // 8, 2)],
        "headings": [_stored_value(headings, index) for index in range(len(headings) // 8)],
    }


@dataclass(frozen=True, slots=True)
class _GradientPath2D:
    """Immutable ownership boundary around packed retained path values."""

    _seed: int
    _start: tuple[float, float]
    _steps: int
    _distance: float
    _field_scale: float
    _field_offset: tuple[float, float]
    _angle_base: float
    _angle_scale: float
    _positions: bytes
    _headings: bytes

    @property
    def steps(self) -> int:
        return self._steps

    def serialize(self) -> dict[str, Any]:
        """Return a detached canonical input descriptor without resampling."""
        return _copy_configuration(self._seed, self._start, self._steps, self._distance,
                                   self._field_scale, self._field_offset, self._angle_base,
                                   self._angle_scale)

    def to_values(self) -> dict[str, list[Any]]:
        """Materialize detached positions/headings without resampling or mutation."""
        return _copy_values(self._positions, self._headings)

    def point_at(self, index: Any) -> list[float]:
        value = _index(index, self._steps)
        position = 2 * value
        return [_stored_value(self._positions, position), _stored_value(self._positions, position + 1)]

    def heading_at(self, index: Any) -> float:
        value = _index(index, self._steps - 1)
        return _stored_value(self._headings, value)

    def point_into(self, index: Any, out: Any, offset: Any = 0) -> None:
        """Write a point after index/bounds/output validation, without pair allocation."""
        value = _index(index, self._steps)
        output_offset = _offset(offset)
        _buffer(out, output_offset)
        position = 2 * value
        out[output_offset] = _stored_value(self._positions, position)
        out[output_offset + 1] = _stored_value(self._positions, position + 1)


def gradient_path_2d(params: Any) -> _GradientPath2D:
    """Construct the reviewed eager, retained gradient-field path.

    The retained-feedback boundary is motivated by
    ``2019/generativos/ciserp``, ``2018/Generativos/mantel``,
    ``2019/generativos/natalata`` and ``2019/generativos/limo002``.
    It independently specifies only feedback integration and retained geometry;
    marks, rendering, palettes and bounds behavior remain with the caller. The
    corpus approves no artistic default or encouraged numeric range here.
    """
    seed, (x, y), steps, distance, field_scale, (offset_x, offset_y), angle_base, angle_scale = _configuration(params)
    # Allocation begins only after all static validation. MemoryError remains a host
    # resource failure rather than a library validation result.
    positions = array("d", [x, y])
    headings = array("d")
    field = gradient_noise_2d_01({"seed": seed})
    for step_index in range(steps):
        query_x_product = _checked_query_product(x * field_scale, step_index, "query_x")
        query_x = _checked_query(query_x_product + offset_x, step_index, "query_x")
        query_y_product = _checked_query_product(y * field_scale, step_index, "query_y")
        query_y = _checked_query(query_y_product + offset_y, step_index, "query_y")
        sample = field.sample(query_x, query_y)
        mapped = _checked_arithmetic(angle_scale * sample, step_index, "heading")
        heading = _checked_arithmetic(angle_base + mapped, step_index, "heading")
        heading = 0.0 if heading == 0.0 else heading
        cosine = math.cos(heading)
        delta_x = _checked_arithmetic(distance * cosine, step_index, "delta_x")
        sine = math.sin(heading)
        delta_y = _checked_arithmetic(distance * sine, step_index, "delta_y")
        x = _checked_arithmetic(x + delta_x, step_index, "position_x")
        y = _checked_arithmetic(y + delta_y, step_index, "position_y")
        x = 0.0 if x == 0.0 else x
        y = 0.0 if y == 0.0 else y
        headings.append(heading)
        positions.append(x)
        positions.append(y)
    # Store immutable packed values after eager construction. The temporary arrays are
    # not retained or exposed, while indexed reads remain O(1).
    return _GradientPath2D(seed, (positions[0], positions[1]), steps, distance, field_scale,
                           (offset_x, offset_y), angle_base, angle_scale,
                           positions.tobytes(), headings.tobytes())
