"""Retained ordered pool of branching segments, independently specified by the shared
topology.seeded-line-pool-2d contract.

Motivating note: survey/out/2019/generativos/brotes/notes.md. This deliberately does not
reproduce placement, colours, tips, ancestry, or rendering; it owns a private xoshiro
stream and only retains final segment coordinates and division flags. The parameter
decision is recorded in design/capabilities/line-pool-admission.md: the inspected control
experiment tested 9000/90000/180000 attempts and first-cut angle scales 0.7/1.4/2.1;
those discrete observations do not establish a default or continuous encouraged range.
minCutLength is a caller coordinate-unit termination threshold based on the source's
4-unit skip, not a measured artistic range.
"""
import math

from ._fdlibm_trig import fdlibm_atan2, fdlibm_cos, fdlibm_sin

__all__ = ["LinePoolError", "seeded_line_pool_2d"]

_MAX_SEGMENTS = 536870911
_MAX_SAFE = 9007199254740991
_UINT32_MAX = 4294967295
_MASK32 = (1 << 32) - 1
_MASK64 = (1 << 64) - 1
_KEYS = {"seed", "segment", "attempts", "firstCutAngleScale", "minCutLength", "maxSegments"}


class LinePoolError(ValueError):
    """Stable catalog code, with attempt/stage/child_ordinal or attempt/selected_index detail."""

    def __init__(self, code, detail=None):
        super().__init__(code)
        self.code = code
        if code in ("ARITHMETIC_OVERFLOW", "SEGMENT_LIMIT_EXCEEDED") and detail:
            for key, value in detail.items():
                setattr(self, key, value)


def _fail(code, detail=None):
    raise LinePoolError(code, detail)


def _overflow(attempt, stage, child_ordinal=None):
    detail = {"attempt": attempt, "stage": stage}
    if child_ordinal is not None:
        detail["childOrdinal"] = child_ordinal
    _fail("ARITHMETIC_OVERFLOW", detail)


def _number(value):
    if type(value) not in (int, float):
        _fail("INVALID_INPUT")
    value = float(value)
    if not math.isfinite(value):
        _fail("INVALID_INPUT")
    return value


def _segment(value):
    if type(value) is not list or len(value) != 4:
        _fail("INVALID_INPUT")
    return [_number(value[0]), _number(value[1]), _number(value[2]), _number(value[3])]


def _uint32(value):
    n = _number(value)
    if n < 0 or n > _UINT32_MAX or n != math.floor(n):
        _fail("INVALID_INPUT")
    return int(n)


def _attempts(value):
    n = _number(value)
    if n < 0 or n > 2147483647 or n != math.floor(n):
        _fail("INVALID_INPUT")
    return int(n)


def _nonnegative(value):
    n = _number(value)
    if n < 0:
        _fail("INVALID_INPUT")
    return n


def _positive(value):
    n = _number(value)
    if not n > 0:
        _fail("INVALID_INPUT")
    return n


def _maximum(value):
    n = _number(value)
    if n < 1 or n > _MAX_SEGMENTS or n != math.floor(n):
        _fail("INVALID_INPUT")
    return int(n)


def _access_index(value):
    if type(value) is bool or type(value) not in (int, float):
        _fail("INVALID_INDEX")
    if type(value) is float:
        if not math.isfinite(value) or value != math.floor(value):
            _fail("INVALID_INDEX")
        value = int(value)
    if value < 0 or value > _MAX_SAFE:
        _fail("INVALID_INDEX")
    return value


def _zero(value):
    return 0.0 if value == 0 else value


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


def _range(low, high, stream):
    if low >= high:
        return low
    return low + ((high - low) * stream.unit())


class LinePool:
    """Owned pool of retained segments; accessors export fresh detached carriers."""
    __slots__ = ("_attempts", "_coordinates", "_divided", "_skips", "_successful_cuts")

    def __init__(self, coordinates, divided, attempts, successful_cuts, skips):
        self._coordinates = coordinates
        self._divided = divided
        self._attempts = attempts
        self._successful_cuts = successful_cuts
        self._skips = skips

    def _checked_index(self, index):
        at = _access_index(index)
        if at >= len(self._divided):
            _fail("INDEX_OUT_OF_RANGE")
        return at

    @property
    def size(self):
        return len(self._divided)

    @property
    def attempts(self):
        return self._attempts

    @property
    def successful_cuts(self):
        return self._successful_cuts

    @property
    def skips(self):
        return self._skips

    def segment_at(self, index):
        at = self._checked_index(index)
        base = at * 4
        c = self._coordinates
        return [_zero(c[base]), _zero(c[base + 1]), _zero(c[base + 2]), _zero(c[base + 3])]

    def segment_into(self, index, destination, offset=0):
        at = self._checked_index(index)
        if type(destination) is not list or type(offset) is not int or type(offset) is bool:
            _fail("INVALID_OUTPUT")
        if offset < 0 or offset > len(destination) - 4:
            _fail("INVALID_OUTPUT")
        base = at * 4
        c = self._coordinates
        destination[offset] = _zero(c[base])
        destination[offset + 1] = _zero(c[base + 1])
        destination[offset + 2] = _zero(c[base + 2])
        destination[offset + 3] = _zero(c[base + 3])
        return destination

    def divided_at(self, index):
        return self._divided[self._checked_index(index)]

    def to_values(self):
        segments = [self.segment_at(i) for i in range(self.size)]
        divided = list(self._divided)
        return {"segments": segments, "divided": divided, "attempts": self._attempts,
                "successfulCuts": self._successful_cuts, "skips": self._skips}


def seeded_line_pool_2d(config):
    """Generate topology.seeded-line-pool-2d 0.1.0: repeatedly cut a selected segment."""
    if type(config) is not dict or set(config) != _KEYS:
        _fail("INVALID_INPUT")
    seed = _uint32(config["seed"])
    initial = _segment(config["segment"])
    attempts = _attempts(config["attempts"])
    first_cut_angle_scale = _nonnegative(config["firstCutAngleScale"])
    min_cut_length = _positive(config["minCutLength"])
    max_segments = _maximum(config["maxSegments"])

    coordinates = [initial[0], initial[1], initial[2], initial[3]]
    divided = [False]
    if attempts == 0:
        return LinePool(coordinates, divided, 0, 0, 0)

    stream = _Stream(seed)
    successful_cuts = 0
    skips = 0
    for attempt in range(attempts):
        size = len(divided)
        selected_index = min(size - 1, math.floor((stream.unit() * size) * _range(0.8, 1.0, stream)))
        base = selected_index * 4
        sx, sy, ex, ey = coordinates[base], coordinates[base + 1], coordinates[base + 2], coordinates[base + 3]
        dx = _checked(ex - sx, attempt, "difference_x")
        dy = _checked(ey - sy, attempt, "difference_y")
        xx = _checked(dx * dx, attempt, "square_x")
        yy = _checked(dy * dy, attempt, "square_y")
        squared = _checked(xx + yy, attempt, "squared_length")
        length = math.sqrt(squared)
        heading = fdlibm_atan2(dy, dx)
        if length < min_cut_length:
            skips += 1
            continue

        fraction = _range(_range(0.6, 0.7, stream), _range(0.0, 0.8, stream), stream)
        was_divided = divided[selected_index]
        if was_divided:
            fraction = fraction * 0.4
        remainder = length * (1.0 - fraction)

        first_present = False
        first_continuation = False
        first_turn = 0.0
        first_distance = 0.0
        first_continuation_x = 0.0
        first_continuation_y = 0.0
        second_present = False
        second_turn = 0.0
        second_distance = 0.0

        if not was_divided:
            a = _checked(_range(0.0, 1.2, stream) * _range(0.2, 1.0, stream) * first_cut_angle_scale, attempt, "spread_positive")
            b = _checked(_range(0.0, 1.2, stream) * _range(0.2, 1.0, stream) * first_cut_angle_scale, attempt, "spread_negative")
            stream.unit()
            l0 = _checked(remainder * _range(0.9, 1.2, stream), attempt, "length_positive")
            l1 = _checked(remainder * _range(0.9, 1.2, stream), attempt, "length_negative")
            l2 = _checked(remainder * _range(0.9, 1.2, stream), attempt, "length_straight")
            h0 = _checked(heading + a, attempt, "heading_positive")
            h1 = _checked(heading - b, attempt, "heading_negative")
            h2 = _checked(heading + _range(-0.1, 0.1, stream), attempt, "heading_straight")
            choice = min(2, math.floor(3.0 * stream.unit()))
            if choice == 0:
                child_count = 0
            elif choice == 1:
                first_present = True
                first_turn = h0
                first_distance = l0
                second_present = True
                second_turn = h1
                second_distance = l1
                child_count = 2
            else:
                first_present = True
                first_turn = h2
                first_distance = l2
                child_count = 1
        else:
            deviation = _range(0.1, 0.4, stream)
            sign = -1.0 if stream.unit() < 0.5 else 1.0
            deviation = (deviation * sign) * 2.0
            distance = _checked(remainder * _range(0.9, 1.1, stream), attempt, "length_repeat")
            turn = _checked(heading + deviation, attempt, "heading_repeat")
            first_present = True
            first_continuation = True
            first_continuation_x = ex
            first_continuation_y = ey
            second_present = True
            second_turn = turn
            second_distance = distance
            child_count = 2

        if size + child_count > max_segments:
            _fail("SEGMENT_LIMIT_EXCEEDED", {"attempt": attempt, "selectedIndex": selected_index})
        nx = _checked(sx + _checked(dx * fraction, attempt, "cut_delta_x"), attempt, "cut_x")
        ny = _checked(sy + _checked(dy * fraction, attempt, "cut_delta_y"), attempt, "cut_y")

        first_end_x = 0.0
        first_end_y = 0.0
        first_divided = False
        if first_present:
            if first_continuation:
                first_end_x = first_continuation_x
                first_end_y = first_continuation_y
                first_divided = True
            else:
                first_end_x = _checked(nx + _checked(fdlibm_cos(first_turn) * first_distance, attempt, "child_delta_x", 0), attempt, "child_x", 0)
                first_end_y = _checked(ny + _checked(fdlibm_sin(first_turn) * first_distance, attempt, "child_delta_y", 0), attempt, "child_y", 0)
        second_end_x = 0.0
        second_end_y = 0.0
        if second_present:
            second_end_x = _checked(nx + _checked(fdlibm_cos(second_turn) * second_distance, attempt, "child_delta_x", 1), attempt, "child_x", 1)
            second_end_y = _checked(ny + _checked(fdlibm_sin(second_turn) * second_distance, attempt, "child_delta_y", 1), attempt, "child_y", 1)

        coordinates[base + 2] = nx
        coordinates[base + 3] = ny
        divided[selected_index] = True
        if first_present:
            coordinates.extend((nx, ny, first_end_x, first_end_y))
            divided.append(first_divided)
        if second_present:
            coordinates.extend((nx, ny, second_end_x, second_end_y))
            divided.append(False)
        successful_cuts += 1

    return LinePool(coordinates, divided, attempts, successful_cuts, skips)


def _checked(value, attempt, stage, child_ordinal=None):
    if not math.isfinite(value):
        _overflow(attempt, stage, child_ordinal)
    return value
