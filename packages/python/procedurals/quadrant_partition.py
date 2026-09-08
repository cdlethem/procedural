"""Seeded nested rectangles, independently specified by the shared quadrant contract.

Motivating notes: survey/out/2018/Generativos/mosaic02/notes.md and
survey/out/2018/Generativos/mosaic/notes.md. Private Java investigation observed
replacement settings100/200 and selection fractions0.5/1; these are discrete example
choices, not defaults or continuous useful ranges. See the catalog for evidence.
"""
from array import array
from dataclasses import dataclass
import math

__all__ = ["PartitionError", "seeded_quadrant_partition_2d"]
_MAX_REPLACEMENTS = 178956970
_MAX_SAFE = 9007199254740991
_MASK32 = (1 << 32) - 1
_MASK64 = (1 << 64) - 1


class PartitionError(ValueError):
    """Stable catalog code, with replacement_index/stage for midpoint failure."""
    def __init__(self, code, replacement_index=None, stage=None):
        super().__init__(code)
        self.code = code
        if code == "PARTITION_ARITHMETIC_INVALID":
            self.replacement_index = replacement_index
            self.stage = stage


def _number(value):
    if type(value) not in (int, float):
        raise PartitionError("INVALID_INPUT")
    try:
        value = float(value)
    except OverflowError:
        raise PartitionError("INVALID_INPUT") from None
    if not math.isfinite(value):
        raise PartitionError("INVALID_INPUT")
    return 0.0 if value == 0 else value


def _integer(value, maximum, code):
    # Compare arbitrary-size integers before any float conversion or narrowing.
    if type(value) not in (int, float):
        raise PartitionError(code)
    if type(value) is float and (not math.isfinite(value) or not value.is_integer()):
        raise PartitionError(code)
    if not 0 <= value <= maximum:
        raise PartitionError(code)
    return int(value)


def _pair(value, positive):
    if type(value) is not list or len(value) != 2:
        raise PartitionError("INVALID_INPUT")
    x, y = _number(value[0]), _number(value[1])
    if positive and not (x > 0 and y > 0):
        raise PartitionError("INVALID_INPUT")
    return x, y


class _Stream:
    """Private xoshiro128**1.1 stream with two SplitMix64 expansion words."""
    def __init__(self, seed):
        x = seed + 0x9E3779B97F4A7C15
        a = self._split(x)
        b = self._split(x + 0x9E3779B97F4A7C15)
        self._s = [a & _MASK32, a >> 32, b & _MASK32, b >> 32]

    @staticmethod
    def _split(x):
        x &= _MASK64
        x = ((x ^ (x >> 30)) * 0xBF58476D1CE4E5B9) & _MASK64
        x = ((x ^ (x >> 27)) * 0x94D049BB133111EB) & _MASK64
        return (x ^ (x >> 31)) & _MASK64

    def output(self):
        s = self._s
        value = (s[1] * 5) & _MASK32
        result = ((((value << 7) | (value >> 25)) & _MASK32) * 9) & _MASK32
        t = (s[1] << 9) & _MASK32
        s[2] ^= s[0]
        s[3] ^= s[1]
        s[1] ^= s[2]
        s[0] ^= s[3]
        s[2] ^= t
        s[3] = ((s[3] << 11) | (s[3] >> 21)) & _MASK32
        return result

    def unit(self):
        return self.output() / 4294967296.0

    def state(self):
        return self._s.copy()


@dataclass(frozen=True, slots=True)
class _Partition:
    _left: array
    _top: array
    _right: array
    _bottom: array
    _ids: list
    _replacements: int

    @property
    def size(self):
        return len(self._ids)

    @property
    def replacements(self):
        return self._replacements

    def _index(self, index):
        index = _integer(index, _MAX_SAFE, "INVALID_INDEX")
        if index >= self.size:
            raise PartitionError("INDEX_OUT_OF_RANGE")
        return index

    def bounds_at(self, index):
        """Return detached [left, top, right, bottom] binary64 values."""
        i = self._index(index)
        return [self._left[i], self._top[i], self._right[i], self._bottom[i]]

    def id_at(self, index):
        """Return the selected live leaf's within-run birth identity."""
        return self._ids[self._index(index)]

    def bounds_into(self, index, out, offset=0):
        """Validate access and all four destination slots before writing; return None."""
        i = self._index(index)
        offset = _integer(offset, _MAX_SAFE, "INVALID_OUTPUT")
        if not (type(out) is list or (type(out) is array and out.typecode == "d" and out.itemsize == 8)):
            raise PartitionError("INVALID_OUTPUT")
        if offset > len(out) - 4:
            raise PartitionError("INVALID_OUTPUT")
        out[offset] = self._left[i]
        out[offset + 1] = self._top[i]
        out[offset + 2] = self._right[i]
        out[offset + 3] = self._bottom[i]

    def to_values(self):
        """Export detached bounds, IDs and replacement count; retain no export objects."""
        return {"bounds": [self.bounds_at(i) for i in range(self.size)],
                "ids": self._ids.copy(), "replacements": self._replacements}


def seeded_quadrant_partition_2d(config):
    """Generate layout.seeded-quadrant-partition-2d0.1.0 without drawing or clipping.

    Required explicit seed/replacements/origin/extent/selectionFraction follow the
    frozen catalog. Longer runs share replacement history, not final-array prefixes.
    Motivating mosaic02/mosaic paths and discrete evidence choices are in this module's
    docstring; no artistic defaults or continuous useful parameter range is implied.
    """
    keys = ("seed", "replacements", "origin", "extent", "selectionFraction")
    if type(config) is not dict or len(config) != 5 or any(key not in config for key in keys):
        raise PartitionError("INVALID_INPUT")
    seed = _integer(config["seed"], _MASK32, "INVALID_INPUT")
    count = _integer(config["replacements"], _MAX_REPLACEMENTS, "INVALID_INPUT")
    ox, oy = _pair(config["origin"], False)
    width, height = _pair(config["extent"], True)
    fraction = _number(config["selectionFraction"])
    if not 0 < fraction <= 1:
        raise PartitionError("INVALID_INPUT")
    right, bottom = ox + width, oy + height
    if not (math.isfinite(right) and math.isfinite(bottom) and right > ox and bottom > oy):
        raise PartitionError("INVALID_RECTANGLE")
    width, height = right - ox, bottom - oy
    if not (math.isfinite(width) and math.isfinite(height) and width > 0 and height > 0):
        raise PartitionError("INVALID_RECTANGLE")
    lefts, tops = array("d", [ox]), array("d", [oy])
    rights, bottoms, ids = array("d", [right]), array("d", [bottom]), [0]
    if count == 0:
        return _Partition(lefts, tops, rights, bottoms, ids, 0)
    stream = _Stream(seed)
    for n in range(count):
        limit = len(ids) * fraction
        selected = math.floor(stream.unit() * limit)
        l, t, r, b = lefts[selected], tops[selected], rights[selected], bottoms[selected]
        mx = l + (r - l) * 0.5
        if not l < mx < r:
            raise PartitionError("PARTITION_ARITHMETIC_INVALID", n, "midpoint_x")
        my = t + (b - t) * 0.5
        if not t < my < b:
            raise PartitionError("PARTITION_ARITHMETIC_INVALID", n, "midpoint_y")
        # TL, TR, BR, BL; append first, then remove parent, preserving live order.
        lefts.append(l); lefts.append(mx); lefts.append(mx); lefts.append(l)
        tops.append(t); tops.append(t); tops.append(my); tops.append(my)
        rights.append(mx); rights.append(r); rights.append(r); rights.append(mx)
        bottoms.append(my); bottoms.append(my); bottoms.append(b); bottoms.append(b)
        birth = 4 * n + 1
        ids.append(birth); ids.append(birth + 1); ids.append(birth + 2); ids.append(birth + 3)
        del lefts[selected], tops[selected], rights[selected], bottoms[selected], ids[selected]
    return _Partition(lefts, tops, rights, bottoms, ids, count)
