"""Portable circle placement operations.

Implements ``sampling.ordered-circle-filter-2d@0.1.0`` and
``sampling.seeded-circle-placement-2d@0.1.0``. Motivating notes:
``survey/out/2018/Generativos/caramelo/notes.md``,
``survey/out/2018/Generativos/candy/notes.md`` and
``survey/out/2017/Generativos/studio/notes.md``. The two operations share one
result type and one ordered exclusion kernel; seeded generation streams four
portable xoshiro128**1.1 units per proposal. Discrete fixture settings are
conformance examples, not approved continuous ranges or defaults.
"""

from __future__ import annotations

from array import array
from dataclasses import dataclass
import math
from typing import Any

__all__ = ["CirclePlacementError", "ordered_circle_filter_2d", "seeded_circle_placement_2d"]

MAX_PROPOSALS = 1_073_741_823
MAX_SAFE_INTEGER = 9_007_199_254_740_991
MASK_64 = (1 << 64) - 1
_ORDERED_KEYS = ("centres", "radii", "separationScale")
_SEEDED_KEYS = ("seed", "attempts", "origin", "extent", "radiusRange", "separationScale")


class CirclePlacementError(ValueError):
    """Stable operation error with the catalog error code in ``.code``."""

    def __init__(self, code: str, message: str | None = None,
                 candidate_index: int | None = None, stage: str | None = None) -> None:
        self.code = code
        super().__init__(message or code)
        if candidate_index is not None:
            self.candidate_index = candidate_index
        if stage is not None:
            self.stage = stage


def _invalid(message: str) -> CirclePlacementError:
    return CirclePlacementError("INVALID_INPUT", message)


def _arithmetic(candidate_index: int, stage: str) -> CirclePlacementError:
    return CirclePlacementError("PLACEMENT_ARITHMETIC_INVALID", stage, candidate_index, stage)


def _zero(value: float) -> float:
    return 0.0 if value == 0.0 else value


def _record(value: Any, keys: tuple[str, ...]) -> dict[Any, Any]:
    """Read an exact builtin dict record with exactly the declared keys."""
    if type(value) is not dict:
        raise _invalid("config must be an exact builtin dict record")
    if len(value) != len(keys) or any(key not in value for key in keys):
        raise _invalid("config keys do not match the operation input")
    return value


def _number(value: Any) -> float:
    """Convert an accepted numeric scalar to binary64, rejecting bool/non-finite."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise _invalid("expected a numeric scalar")
    try:
        result = float(value)
    except (OverflowError, ValueError):
        raise _invalid("numeric scalar is not representable as finite binary64") from None
    if not math.isfinite(result):
        raise _invalid("numeric scalar must be finite")
    return _zero(result)


def _pair(value: Any, positive: bool = False) -> tuple[float, float]:
    """Read an exact builtin list pair of finite binary64 values."""
    if type(value) is not list or len(value) != 2:
        raise _invalid("pair must be an exact builtin list of two values")
    x = _number(value[0])
    y = _number(value[1])
    if positive and not (x > 0.0 and y > 0.0):
        raise _invalid("pair values must be strictly positive")
    return (x, y)


def _count(value: Any, maximum: int) -> int:
    """Validate a finite integral number in ``0..maximum`` before narrowing."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise _invalid("count must be a finite integral number")
    if isinstance(value, float):
        if not math.isfinite(value) or not value.is_integer():
            raise _invalid("count must be a finite integral number")
        value = int(value)
    if value < 0 or value > maximum:
        raise _invalid("count is outside the declared domain")
    return value


def _access_index(index: Any, size: int) -> int:
    if isinstance(index, bool) or not isinstance(index, (int, float)):
        raise CirclePlacementError("INVALID_INDEX", "index must be a finite nonnegative safe integer")
    if isinstance(index, float):
        if not math.isfinite(index) or not index.is_integer():
            raise CirclePlacementError("INVALID_INDEX", "index must be a finite nonnegative safe integer")
        index = int(index)
    if index < 0 or index > MAX_SAFE_INTEGER:
        raise CirclePlacementError("INVALID_INDEX", "index must be a finite nonnegative safe integer")
    if index >= size:
        raise CirclePlacementError("INDEX_OUT_OF_RANGE", "index is outside the result")
    return index


def _offset(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise CirclePlacementError("INVALID_OUTPUT", "offset must be a finite nonnegative integer")
    if isinstance(value, float):
        if not math.isfinite(value) or not value.is_integer():
            raise CirclePlacementError("INVALID_OUTPUT", "offset must be a finite nonnegative integer")
        value = int(value)
    if value < 0 or value > MAX_SAFE_INTEGER:
        raise CirclePlacementError("INVALID_OUTPUT", "offset must be a finite nonnegative integer")
    return value


def _buffer(out: Any, offset: int) -> None:
    """Require exactly two writable binary64 slots in a builtin list or array('d')."""
    if type(out) is array:
        if out.typecode != "d" or len(out) - offset < 2:
            raise CirclePlacementError("INVALID_OUTPUT", "output must have two writable binary64 slots")
    elif type(out) is list:
        if len(out) - offset < 2:
            raise CirclePlacementError("INVALID_OUTPUT", "output must have two writable binary64 slots")
    else:
        raise CirclePlacementError("INVALID_OUTPUT", "output must be a builtin list or array('d')")


def _checked(value: float, candidate_index: int, stage: str) -> float:
    if not math.isfinite(value):
        raise _arithmetic(candidate_index, stage)
    return value


def _accept(storage: _Storage, x: float, y: float, radius: float,
            source_index: int, candidate_index: int, scale: float) -> None:
    """Shared ordered exclusion kernel; rejects at the first violating pair."""
    for accepted in range(storage.size):
        base = accepted * 2
        dx = _checked(x - storage.coordinates[base], candidate_index, "difference_x")
        dy = _checked(y - storage.coordinates[base + 1], candidate_index, "difference_y")
        square_x = _checked(dx * dx, candidate_index, "square_x")
        if dx != 0.0 and square_x == 0.0:
            raise _arithmetic(candidate_index, "square_x")
        square_y = _checked(dy * dy, candidate_index, "square_y")
        if dy != 0.0 and square_y == 0.0:
            raise _arithmetic(candidate_index, "square_y")
        distance_squared = _checked(square_x + square_y, candidate_index, "distance_squared")
        radius_sum = _checked(radius + storage.radii[accepted], candidate_index, "radius_sum")
        threshold = _checked(radius_sum * scale, candidate_index, "threshold")
        if not threshold > 0.0:
            raise _arithmetic(candidate_index, "threshold")
        threshold_squared = _checked(threshold * threshold, candidate_index, "threshold_squared")
        if threshold_squared == 0.0:
            raise _arithmetic(candidate_index, "threshold_squared")
        if distance_squared < threshold_squared:
            return
    storage.append(x, y, radius, source_index)


@dataclass(frozen=True, slots=True)
class _CirclePlacements:
    """Detached immutable retained placement result (2*N coordinates, N radii, N indices)."""

    _coordinates: array
    _radii: array
    _source_indices: array
    _attempts: int

    @property
    def size(self) -> int:
        return len(self._radii)

    @property
    def attempts(self) -> int:
        return self._attempts

    def point_at(self, index: Any) -> list[float]:
        """Return a fresh binary64 ``[x, y]`` centre pair for a valid index."""
        value = _access_index(index, self.size)
        base = value * 2
        return [self._coordinates[base], self._coordinates[base + 1]]

    def point_into(self, index: Any, out: Any, offset: Any = 0) -> None:
        """Write two coordinates into validated storage without point-container allocation."""
        value = _access_index(index, self.size)
        output_offset = _offset(offset)
        _buffer(out, output_offset)
        base = value * 2
        out[output_offset] = self._coordinates[base]
        out[output_offset + 1] = self._coordinates[base + 1]

    def radius_at(self, index: Any) -> float:
        """Return the positive binary64 radius for a valid index."""
        return self._radii[_access_index(index, self.size)]

    def source_index_at(self, index: Any) -> int:
        """Return the original proposal index for a valid accepted circle."""
        return self._source_indices[_access_index(index, self.size)]

    def to_values(self) -> dict[str, Any]:
        """Materialize the detached output-schema value; never expose retained buffers."""
        size = len(self._radii)
        centres = [[self._coordinates[2 * index], self._coordinates[2 * index + 1]]
                   for index in range(size)]
        return {
            "centres": centres,
            "radii": list(self._radii),
            "sourceIndices": list(self._source_indices),
            "attempts": self._attempts,
        }


class _Storage:
    __slots__ = ("coordinates", "maximum", "radii", "size", "source_indices")

    def __init__(self, maximum: int) -> None:
        self.maximum = maximum
        capacity = min(16, maximum)
        self.coordinates = array("d", [0.0]) * (2 * capacity)
        self.radii = array("d", [0.0]) * capacity
        self.source_indices = array("I", [0]) * capacity
        self.size = 0

    def append(self, x: float, y: float, radius: float, source_index: int) -> None:
        if self.size == len(self.radii):
            self._grow()
        base = self.size * 2
        self.coordinates[base] = _zero(x)
        self.coordinates[base + 1] = _zero(y)
        self.radii[self.size] = radius
        self.source_indices[self.size] = source_index
        self.size += 1

    def _grow(self) -> None:
        current = len(self.radii)
        if current >= self.maximum:
            raise MemoryError("circle placement capacity")
        capacity = min(max(current * 2, 16), self.maximum)
        coordinates = array("d", [0.0]) * (2 * capacity)
        coordinates[: self.size * 2] = self.coordinates[: self.size * 2]
        radii = array("d", [0.0]) * capacity
        radii[: self.size] = self.radii[: self.size]
        indices = array("I", [0]) * capacity
        indices[: self.size] = self.source_indices[: self.size]
        self.coordinates = coordinates
        self.radii = radii
        self.source_indices = indices

    def finish(self, attempts: int) -> _CirclePlacements:
        return _CirclePlacements(
            array("d", self.coordinates[: self.size * 2]),
            array("d", self.radii[: self.size]),
            array("I", self.source_indices[: self.size]),
            attempts,
        )


def _ordered_input(config: Any) -> tuple[list[Any], list[Any], float]:
    record = _record(config, _ORDERED_KEYS)
    centres = record["centres"]
    radii = record["radii"]
    if type(centres) is not list or type(radii) is not list:
        raise _invalid("centres and radii must be builtin lists")
    if len(centres) > MAX_PROPOSALS or len(radii) != len(centres):
        raise _invalid("radii length must equal centres length within the representation bound")
    scale = _number(record["separationScale"])
    if not scale > 0.0:
        raise _invalid("separationScale must be strictly positive")
    for index in range(len(centres)):
        _pair(centres[index])
        radius = _number(radii[index])
        if not radius > 0.0:
            raise _invalid("radius must be strictly positive")
    return (centres, radii, scale)


def ordered_circle_filter_2d(config: Any) -> _CirclePlacements:
    """Retain supplied circles in order when the exclusion test permits them."""
    centres, radii, scale = _ordered_input(config)
    storage = _Storage(len(centres))
    for index, centre in enumerate(centres):
        x = _number(centre[0])
        y = _number(centre[1])
        _accept(storage, x, y, _number(radii[index]), index, index, scale)
    return storage.finish(len(centres))


def _rotl32(value: int, shift: int) -> int:
    return ((value << shift) | (value >> (32 - shift))) & 0xFFFFFFFF


def _splitmix_output(state: int) -> int:
    mixed = state
    mixed = ((mixed ^ (mixed >> 30)) * 0xBF58476D1CE4E5B9) & MASK_64
    mixed = ((mixed ^ (mixed >> 27)) * 0x94D049BB133111EB) & MASK_64
    return (mixed ^ (mixed >> 31)) & MASK_64


class _Xoshiro128StarStar11:
    """Private portable stream; state is discarded with the result."""

    __slots__ = ("s0", "s1", "s2", "s3")

    def __init__(self, seed: int) -> None:
        state = seed & 0xFFFFFFFF
        state = (state + 0x9E3779B97F4A7C15) & MASK_64
        first = _splitmix_output(state)
        state = (state + 0x9E3779B97F4A7C15) & MASK_64
        second = _splitmix_output(state)
        self.s0 = first & 0xFFFFFFFF
        self.s1 = (first >> 32) & 0xFFFFFFFF
        self.s2 = second & 0xFFFFFFFF
        self.s3 = (second >> 32) & 0xFFFFFFFF
        if (self.s0 | self.s1 | self.s2 | self.s3) == 0:
            raise AssertionError("all-zero xoshiro state")

    def next_u32(self) -> int:
        result = (_rotl32((self.s1 * 5) & 0xFFFFFFFF, 7) * 9) & 0xFFFFFFFF
        temporary = (self.s1 << 9) & 0xFFFFFFFF
        self.s2 ^= self.s0
        self.s3 ^= self.s1
        self.s1 ^= self.s2
        self.s0 ^= self.s3
        self.s2 ^= temporary
        self.s3 = _rotl32(self.s3, 11)
        return result

    def unit(self) -> float:
        return self.next_u32() / 4_294_967_296.0


def _map_candidate(origin: tuple[float, float], extent: tuple[float, float],
                   radius_range: tuple[float, float], ux: float, uy: float,
                   u: float, v: float, candidate_index: int) -> tuple[float, float, float]:
    px = extent[0] * ux
    x = _checked(px + origin[0], candidate_index, "proposal_x")
    py = extent[1] * uy
    y = _checked(py + origin[1], candidate_index, "proposal_y")
    span = radius_range[1] - radius_range[0]
    first = span * u
    second = first * v
    radius = radius_range[0] + second
    return (_zero(x), _zero(y), radius)


def _seeded_input(config: Any) -> dict[str, Any]:
    record = _record(config, _SEEDED_KEYS)
    seed = _count(record["seed"], 0xFFFFFFFF)
    attempts = _count(record["attempts"], MAX_PROPOSALS)
    origin = _pair(record["origin"])
    extent = _pair(record["extent"], positive=True)
    radius_range = _pair(record["radiusRange"], positive=True)
    if radius_range[0] > radius_range[1]:
        raise _invalid("radiusRange minimum must not exceed maximum")
    scale = _number(record["separationScale"])
    if not scale > 0.0:
        raise _invalid("separationScale must be strictly positive")
    return {"seed": seed, "attempts": attempts, "origin": origin,
            "extent": extent, "radiusRange": radius_range, "separationScale": scale}


def seeded_circle_placement_2d(config: Any) -> _CirclePlacements:
    """Place differently sized circles from an explicit seed and finite proposal budget."""
    input_values = _seeded_input(config)
    if input_values["attempts"] == 0:
        return _CirclePlacements(array("d"), array("d"), array("I"), 0)
    stream = _Xoshiro128StarStar11(input_values["seed"])
    storage = _Storage(input_values["attempts"])
    for index in range(input_values["attempts"]):
        ux = stream.unit()
        uy = stream.unit()
        u = stream.unit()
        v = stream.unit()
        x, y, radius = _map_candidate(input_values["origin"], input_values["extent"],
                                      input_values["radiusRange"], ux, uy, u, v, index)
        _accept(storage, x, y, radius, index, index, input_values["separationScale"])
    return storage.finish(input_values["attempts"])
