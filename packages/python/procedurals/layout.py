"""Portable layout operations.

``layout.regular-grid`` is motivated by the regular point fields in
``2017/Generativos/circlesAlpha`` and ``2019/generativos/paraisooscuro``. Those
reports establish construction patterns, not approved artistic defaults or ranges.
This module keeps the operation renderer-independent and computes positions lazily.
"""

from __future__ import annotations

from array import array
from collections.abc import Mapping
from dataclasses import dataclass
import math
from typing import Any


__all__ = ["GridError", "regular_grid"]
MAX_AXIS = 2_147_483_647
MAX_SAFE_INTEGER = 9_007_199_254_740_991
_PARAM_KEYS = frozenset(("origin", "spacing", "columns", "rows"))


class GridError(ValueError):
    """Stable operation error with the catalog error code in ``.code``."""

    def __init__(self, code: str, message: str | None = None) -> None:
        self.code = code
        super().__init__(message or code)


def _number(value: Any) -> float:
    """Convert an accepted numeric scalar to binary64, rejecting bool/non-finite."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise GridError("INVALID_INPUT", "expected a numeric scalar")
    try:
        result = float(value)
    except (OverflowError, ValueError):
        raise GridError("INVALID_INPUT", "numeric scalar is not representable") from None
    if not math.isfinite(result):
        raise GridError("INVALID_INPUT", "numeric scalar must be finite")
    return 0.0 if result == 0.0 else result


def _vector(value: Any) -> tuple[float, float]:
    """Read exactly a JSON list or binary64 ``array('d')`` vector."""
    if isinstance(value, array):
        if value.typecode != "d" or len(value) != 2:
            raise GridError("INVALID_INPUT", "vector must be a length-two array('d')")
        values = (value[0], value[1])
    elif isinstance(value, list):
        if len(value) != 2:
            raise GridError("INVALID_INPUT", "vector must contain exactly two values")
        values = (value[0], value[1])
    else:
        raise GridError("INVALID_INPUT", "vector must be a list or array('d')")
    return (_number(values[0]), _number(values[1]))


def _count(value: Any) -> int:
    """Validate a JSON-schema integer, allowing integral binary64 values."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise GridError("INVALID_INPUT", "count must be an integer")
    if isinstance(value, float):
        if not math.isfinite(value) or not value.is_integer():
            raise GridError("INVALID_INPUT", "count must be an integer")
    try:
        result = int(value)
    except (OverflowError, ValueError):
        raise GridError("INVALID_INPUT", "count must be an integer") from None
    if result < 0 or result > MAX_AXIS:
        raise GridError("INVALID_INPUT", "count is outside the axis domain")
    return result


def _coordinate(origin: float, spacing: float, index: int) -> float:
    """Compute multiply then add as separate binary64 operations, never FMA."""
    product = float(index) * spacing
    if not math.isfinite(product):
        raise GridError("COORDINATE_OVERFLOW", "coordinate multiplication overflowed")
    coordinate = origin + product
    if not math.isfinite(coordinate):
        raise GridError("COORDINATE_OVERFLOW", "coordinate addition overflowed")
    return 0.0 if coordinate == 0.0 else coordinate


@dataclass(frozen=True, slots=True)
class _RegularGrid:
    """Internal immutable compact row-major rectangular sequence."""

    _origin: tuple[float, float]
    _spacing: tuple[float, float]
    _columns: int
    _rows: int
    _size: int

    @property
    def origin(self) -> tuple[float, float]:
        return self._origin

    @property
    def spacing(self) -> tuple[float, float]:
        return self._spacing

    @property
    def columns(self) -> int:
        return self._columns

    @property
    def rows(self) -> int:
        return self._rows

    @property
    def size(self) -> int:
        return self._size

    def serialize(self) -> dict[str, Any]:
        """Return a detached canonical four-parameter representation."""
        return {
            "origin": [self._origin[0], self._origin[1]],
            "spacing": [self._spacing[0], self._spacing[1]],
            "columns": self._columns,
            "rows": self._rows,
        }

    def _index(self, index: Any) -> int:
        if isinstance(index, bool) or not isinstance(index, (int, float)):
            raise GridError("INVALID_INDEX", "index must be a finite safe integer")
        if isinstance(index, float):
            if not math.isfinite(index) or not index.is_integer():
                raise GridError("INVALID_INDEX", "index must be a finite safe integer")
        try:
            value = int(index)
        except (OverflowError, ValueError):
            raise GridError("INVALID_INDEX", "index must be a finite safe integer") from None
        if value < 0 or value > MAX_SAFE_INTEGER:
            raise GridError("INVALID_INDEX", "index must be a finite safe integer")
        if value >= self._size:
            raise GridError("INDEX_OUT_OF_RANGE", "index is outside the grid")
        return value

    def point_at(self, index: Any) -> list[float]:
        """Return a fresh binary64 ``[x, y]`` pair for a valid row-major index."""
        value = self._index(index)
        column = value % self._columns
        row = (value - column) // self._columns
        x = _coordinate(self._origin[0], self._spacing[0], column)
        y = _coordinate(self._origin[1], self._spacing[1], row)
        return [x, y]

    @staticmethod
    def _offset(value: Any) -> int:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise GridError("INVALID_OUTPUT", "offset must be a finite nonnegative integer")
        if isinstance(value, float):
            if not math.isfinite(value) or not value.is_integer():
                raise GridError("INVALID_OUTPUT", "offset must be a finite nonnegative integer")
        try:
            result = int(value)
        except (OverflowError, ValueError):
            raise GridError("INVALID_OUTPUT", "offset must be a finite nonnegative integer") from None
        if result < 0 or result > MAX_SAFE_INTEGER:
            raise GridError("INVALID_OUTPUT", "offset must be a finite nonnegative integer")
        return result

    @staticmethod
    def _buffer(out: Any, offset: int) -> None:
        if type(out) is array:
            valid = out.typecode == "d"
            length = len(out)
        elif type(out) is list:
            valid = True
            length = len(out)
        else:
            valid = False
            length = 0
        if not valid or offset > length or length - offset < 2:
            raise GridError("INVALID_OUTPUT", "output must have two writable binary64 slots")

    def point_into(self, index: Any, out: Any, offset: Any = 0) -> None:
        """Write two coordinates into validated storage without point-container allocation.

        Numeric float objects are necessarily produced by Python arithmetic; this method
        allocates no list/tuple for the point and writes only after every validation passes.
        """
        value = self._index(index)
        output_offset = self._offset(offset)
        self._buffer(out, output_offset)
        column = value % self._columns
        row = (value - column) // self._columns
        x = _coordinate(self._origin[0], self._spacing[0], column)
        y = _coordinate(self._origin[1], self._spacing[1], row)
        out[output_offset] = x
        out[output_offset + 1] = y


def regular_grid(params: Any) -> _RegularGrid:
    """Validate and construct the reviewed immutable regular-grid operation.

    The motivating ``2017/Generativos/circlesAlpha`` and
    ``2019/generativos/paraisooscuro`` reports establish grid
    structure only; they approve no artistic defaults or numeric ranges.
    """
    if not isinstance(params, Mapping):
        raise GridError("INVALID_INPUT", "parameters must be an object")
    if set(params) != _PARAM_KEYS:
        raise GridError("INVALID_INPUT", "parameters have unknown or missing keys")
    origin = _vector(params["origin"])
    spacing = _vector(params["spacing"])
    if spacing[0] <= 0.0 or spacing[1] <= 0.0:
        raise GridError("INVALID_INPUT", "spacing must be positive")
    columns = _count(params["columns"])
    rows = _count(params["rows"])
    product = columns * rows
    if product > MAX_SAFE_INTEGER:
        raise GridError("GRID_SIZE_OVERFLOW", "grid size exceeds safe integer domain")
    if product:
        _coordinate(origin[0], spacing[0], columns - 1)
        _coordinate(origin[1], spacing[1], rows - 1)
    return _RegularGrid(origin, spacing, columns, rows, product)

