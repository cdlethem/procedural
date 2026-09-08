"""Retained shared-occupancy cardinal lattice paths independently specified by the
shared path.occupied-lattice-paths-2d contract.

Motivating note: survey/out/2019/generativos/tata/notes.md. This deliberately does
not reproduce tata's omitted starts, random proposals, scene stream, or rendering;
no artistic dimensions/starts/step range is established, see the catalog contract
for evidence.
"""
from array import array
import math

__all__ = ["LatticeError", "occupied_lattice_paths_2d"]
_MAX_CELLS = 1073741823
_MAX_STEPS = 1073741822
_MAX_SAFE = 9007199254740991
_UINT32_MAX = 4294967295
_MASK32 = (1 << 32) - 1
_MASK64 = (1 << 64) - 1


class LatticeError(ValueError):
    """Stable catalog code: INVALID_INPUT, WORK_LIMIT_EXCEEDED, INVALID_INDEX,
    INDEX_OUT_OF_RANGE or INVALID_OUTPUT."""
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _fail(code):
    raise LatticeError(code)


def _integral(value):
    if type(value) not in (int, float) or type(value) is bool:
        _fail("INVALID_INPUT")
    if type(value) is float and (not math.isfinite(value) or not value.is_integer()):
        _fail("INVALID_INPUT")
    return value


def _bounded_int(value, lo, hi):
    n = _integral(value)
    if n < lo or n > hi:
        _fail("INVALID_INPUT")
    return int(n)


def _uint32(value):
    return _bounded_int(value, 0, _UINT32_MAX)


def _pair(value):
    if type(value) is not list or len(value) != 2:
        _fail("INVALID_INPUT")
    return value


def _record_either_key(value):
    if type(value) is not dict or len(value) != 1:
        _fail("INVALID_INPUT")
    return value


def _read_random(value):
    record = _record_either_key(value)
    has_seed, has_state = "seed" in record, "state" in record
    if has_seed == has_state:
        _fail("INVALID_INPUT")
    if has_seed:
        return _uint32(record["seed"]), None
    words = record["state"]
    if type(words) is not list or len(words) != 4:
        _fail("INVALID_INPUT")
    state = [_uint32(word) for word in words]
    if state == [0, 0, 0, 0]:
        _fail("INVALID_INPUT")
    return 0, state


class _Xoshiro:
    """Private xoshiro128**1.1 stream with two SplitMix64 expansion words; same
    algorithm as procedurals.quadrant_partition._Stream, extended to accept an
    explicit caller-supplied [s0,s1,s2,s3] state that bypasses expansion."""
    def __init__(self, seed, state):
        if state is not None:
            self._s = list(state)
            return
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

    def next_u32(self):
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

    def choose(self, count):
        """floor(u32 * count / 2^32); consumes exactly one word for count in 1..4."""
        return (self.next_u32() * count) >> 32

    def state(self):
        return self._s.copy()


class _LatticePaths:
    __slots__ = ("_x", "_y", "_offsets", "_reasons", "_random_state")

    def __init__(self, x, y, offsets, reasons, random_state):
        self._x = x
        self._y = y
        self._offsets = offsets
        self._reasons = reasons
        self._random_state = random_state

    @property
    def path_count(self):
        return len(self._reasons)

    def _path_index(self, path):
        if type(path) not in (int, float) or type(path) is bool:
            _fail("INVALID_INDEX")
        if type(path) is float and (not math.isfinite(path) or not path.is_integer()):
            _fail("INVALID_INDEX")
        if path < 0 or path > _MAX_SAFE:
            _fail("INVALID_INDEX")
        path = int(path)
        if path >= len(self._reasons):
            _fail("INDEX_OUT_OF_RANGE")
        return path

    def _cell_index(self, path, cell):
        if type(cell) not in (int, float) or type(cell) is bool:
            _fail("INVALID_INDEX")
        if type(cell) is float and (not math.isfinite(cell) or not cell.is_integer()):
            _fail("INVALID_INDEX")
        if cell < 0 or cell > _MAX_SAFE:
            _fail("INVALID_INDEX")
        cell = int(cell)
        length = self._offsets[path + 1] - self._offsets[path]
        if cell >= length:
            _fail("INDEX_OUT_OF_RANGE")
        return cell

    def path_length_at(self, path):
        p = self._path_index(path)
        return self._offsets[p + 1] - self._offsets[p]

    def cell_at(self, path, cell):
        """Return a fresh detached [x, y] pair."""
        p = self._path_index(path)
        c = self._cell_index(p, cell)
        at = self._offsets[p] + c
        return [self._x[at], self._y[at]]

    def cell_into(self, path, cell, output, offset=0):
        """Validate path, cell and destination before writing; return output."""
        p = self._path_index(path)
        c = self._cell_index(p, cell)
        if not (type(output) is list or (type(output) is array and output.typecode == "i" and output.itemsize == 4)):
            _fail("INVALID_OUTPUT")
        if type(offset) not in (int, float) or type(offset) is bool:
            _fail("INVALID_OUTPUT")
        if type(offset) is float and (not math.isfinite(offset) or not offset.is_integer()):
            _fail("INVALID_OUTPUT")
        offset = int(offset)
        if offset < 0 or offset > len(output) - 2:
            _fail("INVALID_OUTPUT")
        at = self._offsets[p] + c
        output[offset] = self._x[at]
        output[offset + 1] = self._y[at]
        return output

    def completion_reason_at(self, path):
        return self._reasons[self._path_index(path)]

    def random_state(self):
        """Return a fresh detached uint32 [s0,s1,s2,s3] state."""
        return self._random_state.copy()

    def to_values(self):
        """Export detached paths, completion reasons and post-call state."""
        paths = []
        for p in range(len(self._reasons)):
            path = []
            for i in range(self._offsets[p], self._offsets[p + 1]):
                path.append([self._x[i], self._y[i]])
            paths.append(path)
        return {"paths": paths, "completionReasons": list(self._reasons), "randomState": self._random_state.copy()}


def occupied_lattice_paths_2d(config):
    """Generate ordered retained cardinal cell paths whose cells are claimed by
    one call-local occupancy set.

    Implements path.occupied-lattice-paths-2d 0.1.0 independently of source code.
    """
    if type(config) is not dict or set(config) != {"dimensions", "starts", "maxSteps", "maxCells", "random"}:
        _fail("INVALID_INPUT")
    dimensions = _pair(config["dimensions"])
    columns = _bounded_int(dimensions[0], 1, 2147483647)
    rows = _bounded_int(dimensions[1], 1, 2147483647)
    starts = config["starts"]
    if type(starts) is not list:
        _fail("INVALID_INPUT")
    if len(starts) > _MAX_CELLS:
        _fail("INVALID_INPUT")
    for item in starts:
        start = _pair(item)
        sx = _integral(start[0])
        if sx < 0 or sx >= columns:
            _fail("INVALID_INPUT")
        sy = _integral(start[1])
        if sy < 0 or sy >= rows:
            _fail("INVALID_INPUT")
    max_steps = _bounded_int(config["maxSteps"], 0, _MAX_STEPS)
    max_cells = _bounded_int(config["maxCells"], 0, _MAX_CELLS)
    seed, state = _read_random(config["random"])
    potential = len(starts) * (max_steps + 1)
    if potential > max_cells:
        raise LatticeError("WORK_LIMIT_EXCEEDED")

    start_x = [int(_pair(item)[0]) for item in starts]
    start_y = [int(_pair(item)[1]) for item in starts]

    stream = _Xoshiro(seed, state)
    out_x = array("i", [])
    out_y = array("i", [])
    offsets = [0]
    reasons = []
    occupied = set()

    for path in range(len(starts)):
        current_x, current_y = start_x[path], start_y[path]
        if (current_x, current_y) in occupied:
            offsets.append(len(out_x))
            reasons.append("occupied-start")
            continue
        occupied.add((current_x, current_y))
        out_x.append(current_x)
        out_y.append(current_y)
        if max_steps == 0:
            offsets.append(len(out_x))
            reasons.append("step-limit")
            continue
        moved = 0
        reason = None
        while moved < max_steps:
            candidates = []
            if current_y > 0 and (current_x, current_y - 1) not in occupied:
                candidates.append((current_x, current_y - 1))
            if current_x + 1 < columns and (current_x + 1, current_y) not in occupied:
                candidates.append((current_x + 1, current_y))
            if current_y + 1 < rows and (current_x, current_y + 1) not in occupied:
                candidates.append((current_x, current_y + 1))
            if current_x > 0 and (current_x - 1, current_y) not in occupied:
                candidates.append((current_x - 1, current_y))
            if not candidates:
                reason = "blocked"
                break
            chosen = stream.choose(len(candidates))
            current_x, current_y = candidates[chosen]
            occupied.add((current_x, current_y))
            out_x.append(current_x)
            out_y.append(current_y)
            moved += 1
            if moved == max_steps:
                reason = "step-limit"
        offsets.append(len(out_x))
        reasons.append(reason)
    return _LatticePaths(out_x, out_y, offsets, reasons, stream.state())
