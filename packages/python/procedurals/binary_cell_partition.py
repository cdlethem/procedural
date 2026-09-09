"""Immutable ordered integer-cell rectangles from attempt-bounded binary cuts.

Implements layout.binary-cell-partition-2d 0.1.0. Independently specified from
survey/out/2018/Generativos/poop/notes.md and survey/out/2018/Generativos/barab/notes.md.
CP17's private native study observed attempts 20/80/240 and RANDOM/LONGEST policies;
these are not defaults or encouraged ranges.
"""
import math

__all__ = ["PartitionError", "binary_cell_partition_2d"]

_MAX_ATTEMPTS = 2147483646
_UINT32_MAX = 4294967295
_INT32_MAX = 2147483647
_KEYS = ("seed", "columns", "rows", "attempts", "axisPolicy")
_MASK32 = (1 << 32) - 1
_MASK64 = (1 << 64) - 1


class PartitionError(ValueError):
    """Stable catalog code for binary-cell-partition-2d."""
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _invalid():
    raise PartitionError("INVALID_INPUT")


def _integer(value, minimum, maximum):
    if type(value) not in (int, float):
        _invalid()
    if type(value) is float and (not math.isfinite(value) or not value.is_integer()):
        _invalid()
    if not minimum <= value <= maximum:
        _invalid()
    return int(value)


def _record(value):
    if type(value) is not dict:
        _invalid()
    if len(value) != len(_KEYS) or any(key not in value for key in _KEYS):
        _invalid()
    return value


class _Stream:
    """Private xoshiro128**1.1 stream with two SplitMix64 expansion words.

    Independently duplicated from quadrant_partition.py's _Stream per the established
    per-module convention; both implement the shared private RNG contract.
    """
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


class _Partition:
    __slots__ = ("_bottom", "_left", "_right", "_splits", "_top")

    def __init__(self, left, top, right, bottom, splits):
        self._left = left
        self._top = top
        self._right = right
        self._bottom = bottom
        self._splits = splits

    @property
    def size(self):
        return len(self._left)

    @property
    def splits(self):
        return self._splits

    def _checked_index(self, index):
        if type(index) not in (int, float):
            raise PartitionError("INVALID_INDEX")
        if type(index) is float and (not math.isfinite(index) or not index.is_integer()):
            raise PartitionError("INVALID_INDEX")
        if not 0 <= index <= 9007199254740991:
            raise PartitionError("INVALID_INDEX")
        index = int(index)
        if index >= self.size:
            raise PartitionError("INDEX_OUT_OF_RANGE")
        return index

    def bounds_at(self, index):
        i = self._checked_index(index)
        return [self._left[i], self._top[i], self._right[i], self._bottom[i]]

    def bounds_into(self, index, destination):
        i = self._checked_index(index)
        if type(destination) is not list or len(destination) != 4:
            raise PartitionError("INVALID_OUTPUT")
        destination[0] = self._left[i]
        destination[1] = self._top[i]
        destination[2] = self._right[i]
        destination[3] = self._bottom[i]
        return destination

    def to_values(self):
        bounds = [[self._left[i], self._top[i], self._right[i], self._bottom[i]] for i in range(self.size)]
        return {"bounds": bounds, "splits": self._splits}


def binary_cell_partition_2d(config):
    """Generate a tiling of [0,0,columns,rows] using a private uint32-seeded stream."""
    _record(config)
    seed = _integer(config["seed"], 0, _UINT32_MAX)
    columns = _integer(config["columns"], 1, _INT32_MAX)
    rows = _integer(config["rows"], 1, _INT32_MAX)
    attempts = _integer(config["attempts"], 0, _MAX_ATTEMPTS)
    axis_policy = config["axisPolicy"]
    if axis_policy not in ("RANDOM", "LONGEST"):
        _invalid()
    random_axis = axis_policy == "RANDOM"

    left, top, right, bottom = [0], [0], [columns], [rows]
    size, splits = 1, 0
    stream = _Stream(seed)
    for _ in range(attempts):
        selected = math.floor(stream.unit() * size)
        x, y = left[selected], top[selected]
        x2, y2 = right[selected], bottom[selected]
        width, height = x2 - x, y2 - y
        split_width = (stream.unit() < 0.5) if random_axis else (width > height)
        extent = width if split_width else height
        if extent == 1:
            continue
        cut = 1 + math.floor(stream.unit() * (extent - 1))

        survivors_left = left[selected + 1:size]
        survivors_top = top[selected + 1:size]
        survivors_right = right[selected + 1:size]
        survivors_bottom = bottom[selected + 1:size]
        del left[selected:], top[selected:], right[selected:], bottom[selected:]
        left.extend(survivors_left); top.extend(survivors_top)
        right.extend(survivors_right); bottom.extend(survivors_bottom)

        left.extend([x, x + cut if split_width else x])
        top.extend([y, y if split_width else y + cut])
        right.extend([x + cut if split_width else x2, x2])
        bottom.extend([y2 if split_width else y + cut, y2])
        size += 1
        splits += 1
    return _Partition(left, top, right, bottom, splits)
