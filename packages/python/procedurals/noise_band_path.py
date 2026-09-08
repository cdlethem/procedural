"""Attempt-bounded scalar-band walk independently specified by the shared
path.noise-band-trace-2d contract.

Motivating note: survey/out/2018/Generativos/venas/notes.md. No artistic
attempts/tolerance/scale range is established; see the catalog contract for
evidence. Uses a bit-exact ported fdlibm5.3 sin/cos (verified against
java.lang.StrictMath.sin/cos), not host math.sin/cos.
"""
from array import array
from dataclasses import dataclass
import copy
import math

from .fields import gradient_noise_2d_01
from ._fdlibm_trig import fdlibm_cos, fdlibm_sin

__all__ = ["NoiseBandPathError", "noise_band_path_2d"]
_HALF_PI = math.pi / 2  # exactly 0x1.921fb54442d18p0 (halving is exact)
_UINT32_MAX = 4294967295
_INT32_MAX = 2147483647
_MAX_VERTICES = 1073741823
_MAX_SAFE = 9007199254740991
_KEYS = {"field", "start", "heading", "seed", "attempts", "stepDistance",
          "fieldScale", "fieldOffset", "tolerance", "maxVertices"}
_MASK32 = (1 << 32) - 1
_MASK64 = (1 << 64) - 1


class NoiseBandPathError(ValueError):
    """Stable catalog code, with attemptIndex/stage for the three dynamic codes."""
    def __init__(self, code, attempt_index=None, stage=None):
        super().__init__(code)
        self.code = code
        if code in ("TRACE_ARITHMETIC_INVALID", "TRACE_QUERY_INVALID", "VERTEX_LIMIT_EXCEEDED"):
            self.attempt_index = attempt_index
            self.stage = stage


def _fail(code):
    raise NoiseBandPathError(code)


def _zero(value):
    return 0.0 if value == 0 else value


def _num(value):
    if type(value) not in (int, float) or type(value) is bool:
        _fail("INVALID_INPUT")
    try:
        value = float(value)
    except OverflowError:
        raise NoiseBandPathError("INVALID_INPUT") from None
    if not math.isfinite(value):
        _fail("INVALID_INPUT")
    return value


def _uint(value):
    n = _num(value)
    if n < 0 or n > _UINT32_MAX or n != math.floor(n):
        _fail("INVALID_INPUT")
    return int(n)


def _integer(value, lo, hi):
    n = _num(value)
    if n < lo or n > hi or n != math.floor(n):
        _fail("INVALID_INPUT")
    return int(n)


def _nonnegative(value):
    n = _num(value)
    if n < 0:
        _fail("INVALID_INPUT")
    return n


def _pair(value):
    if type(value) is not list or len(value) != 2:
        _fail("INVALID_INPUT")
    return _zero(_num(value[0])), _zero(_num(value[1]))


def _arith(value, attempt_index, stage):
    if not math.isfinite(value):
        raise NoiseBandPathError("TRACE_ARITHMETIC_INVALID", attempt_index, stage)
    return value


def _query(field, x, y, scale, offset_x, offset_y, attempt_index, prefix):
    """Q(x,y,prefix): field query with strict per-axis multiply-then-add domain checks."""
    qx = x * scale
    if not math.isfinite(qx):
        raise NoiseBandPathError("TRACE_QUERY_INVALID", attempt_index, prefix + "_x")
    qx = qx + offset_x
    if not math.isfinite(qx) or qx < -_MAX_SAFE or qx >= _MAX_SAFE:
        raise NoiseBandPathError("TRACE_QUERY_INVALID", attempt_index, prefix + "_x")
    qy = y * scale
    if not math.isfinite(qy):
        raise NoiseBandPathError("TRACE_QUERY_INVALID", attempt_index, prefix + "_y")
    qy = qy + offset_y
    if not math.isfinite(qy) or qy < -_MAX_SAFE or qy >= _MAX_SAFE:
        raise NoiseBandPathError("TRACE_QUERY_INVALID", attempt_index, prefix + "_y")
    return field.sample(qx, qy)


class _Xoshiro:
    """Private xoshiro128**1.1 stream with two SplitMix64 expansion words;
    identical algorithm to procedurals.quadrant_partition._Stream."""
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


@dataclass(frozen=True, slots=True)
class _Path:
    _positions: array
    _headings: array
    _attempts: int
    _accepted: int
    _rejected: int
    _config: dict

    @property
    def size(self):
        return len(self._positions) // 2

    @property
    def attempts(self):
        return self._attempts

    @property
    def accepted(self):
        return self._accepted

    @property
    def rejected(self):
        return self._rejected

    def _checked(self, index, headings):
        if type(index) not in (int, float) or type(index) is bool:
            _fail("INVALID_INDEX")
        if type(index) is float and (not math.isfinite(index) or not index.is_integer()):
            _fail("INVALID_INDEX")
        if index < 0 or index > _MAX_SAFE:
            _fail("INVALID_INDEX")
        index = int(index)
        if index >= (self._accepted if headings else self.size):
            _fail("INDEX_OUT_OF_RANGE")
        return index

    def point_at(self, index):
        """Return a fresh detached [x, y] binary64 point."""
        i = self._checked(index, False)
        return [self._positions[2 * i], self._positions[2 * i + 1]]

    def point_into(self, index, output, offset=0):
        """Validate index and both destination slots before writing; return output."""
        i = self._checked(index, False)
        if not (type(output) is list or (type(output) is array and output.typecode == "d" and output.itemsize == 8)):
            _fail("INVALID_OUTPUT")
        if type(offset) not in (int, float) or type(offset) is bool:
            _fail("INVALID_OUTPUT")
        if type(offset) is float and (not math.isfinite(offset) or not offset.is_integer()):
            _fail("INVALID_OUTPUT")
        offset = int(offset)
        if offset < 0 or offset > len(output) - 2:
            _fail("INVALID_OUTPUT")
        output[offset] = self._positions[2 * i]
        output[offset + 1] = self._positions[2 * i + 1]
        return output

    def heading_at(self, index):
        """Return the accepted-segment proposal heading."""
        i = self._checked(index, True)
        return self._headings[i]

    def serialize(self):
        """Return a detached configuration snapshot for replay."""
        return copy.deepcopy(self._config)

    def to_values(self):
        """Export detached positions, headings and counters; retain no export objects."""
        return {
            "positions": [self.point_at(i) for i in range(self.size)],
            "headings": list(self._headings),
            "attempts": self._attempts,
            "accepted": self._accepted,
            "rejected": self._rejected,
        }


def noise_band_path_2d(config):
    """Retain an attempt-bounded connected path whose accepted proposals remain
    within a strict scalar band around the starting noise value.

    Implements path.noise-band-trace-2d 0.1.0 independently of source code.
    """
    if type(config) is not dict or set(config) != _KEYS:
        _fail("INVALID_INPUT")
    field_config = config["field"]
    if type(field_config) is not dict or set(field_config) != {"seed"}:
        _fail("INVALID_INPUT")
    field_seed = _uint(field_config["seed"])
    start_x0, start_y0 = _pair(config["start"])
    heading = _zero(_num(config["heading"]))
    seed = _uint(config["seed"])
    tries = _integer(config["attempts"], 0, _INT32_MAX)
    distance = _zero(_nonnegative(config["stepDistance"]))
    scale = _zero(_num(config["fieldScale"]))
    offset_x, offset_y = _pair(config["fieldOffset"])
    tolerance = _zero(_nonnegative(config["tolerance"]))
    maximum = _integer(config["maxVertices"], 1, _MAX_VERTICES)
    start_x, start_y = _zero(start_x0), _zero(start_y0)

    field = gradient_noise_2d_01({"seed": field_seed})
    configuration = {
        "field": field.serialize(), "start": [start_x, start_y], "heading": heading, "seed": seed,
        "attempts": tries, "stepDistance": distance, "fieldScale": scale,
        "fieldOffset": [offset_x, offset_y], "tolerance": tolerance, "maxVertices": maximum,
    }

    points = array("d", [start_x, start_y])
    directions = array("d", [])
    if tries == 0:
        return _Path(points, directions, 0, 0, 0, configuration)

    level = _query(field, start_x, start_y, scale, offset_x, offset_y, -1, "start_query")
    random = _Xoshiro(seed)
    x, y = start_x, start_y
    accepted, rejected = 0, 0

    for attempt in range(tries):
        low = (-_HALF_PI) * random.unit()
        high = _HALF_PI * random.unit()
        span = high - low
        delta = span * random.unit()
        turn = low + delta
        proposal = _arith(heading + turn, attempt, "proposal_heading")
        dx = _arith(distance * fdlibm_cos(proposal), attempt, "delta_x")
        next_x = _arith(x + dx, attempt, "position_x")
        dy = _arith(distance * fdlibm_sin(proposal), attempt, "delta_y")
        next_y = _arith(y + dy, attempt, "position_y")
        value = _query(field, next_x, next_y, scale, offset_x, offset_y, attempt, "candidate_query")
        drift_product = 0.2 * random.unit()
        drift = -0.1 + drift_product
        rejection_heading = _arith(heading + drift, attempt, "rejection_heading")
        difference = value - level
        band_error = abs(difference)
        if band_error < tolerance:
            if accepted + 1 == maximum:
                raise NoiseBandPathError("VERTEX_LIMIT_EXCEEDED", attempt, "append")
            next_x = _zero(next_x)
            next_y = _zero(next_y)
            canonical_proposal = _zero(proposal)
            points.append(next_x)
            points.append(next_y)
            directions.append(canonical_proposal)
            x, y, heading = next_x, next_y, canonical_proposal
            accepted += 1
        else:
            heading = _zero(rejection_heading)
            rejected += 1
    return _Path(points, directions, tries, accepted, rejected, configuration)
