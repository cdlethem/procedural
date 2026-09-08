"""Closed uniform Catmull-Rom spline independently specified by the shared
closed-spline-2d contract.

Motivating notes: survey/out/2018/Generativos/blobs/notes.md (retained closed spline;
control generation, center, fan drawing and marks remain composition) and
survey/out/2018/Generativos/databol/notes.md (independent closed spline and distance
lookup; randomized controls and spline tile drawing remain composition). Distance
arithmetic uses a ported, bit-exact fdlibm5.3 hypot (verified against
java.lang.StrictMath.hypot), not host math.hypot.
"""
from array import array
from dataclasses import dataclass
import math
import struct

__all__ = ["SplineError", "closed_spline_2d"]
_MAX_CONTROLS = 268435455
_MAX_PRODUCT = 2147483646


class SplineError(ValueError):
    """Stable catalog code: INVALID_INPUT, INVALID_QUERY or NUMERIC_OVERFLOW."""
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _fail(code):
    raise SplineError(code)


def _finite(value):
    return type(value) in (int, float) and math.isfinite(value) and type(value) is not bool


def _number(value, code):
    if type(value) not in (int, float) or type(value) is bool:
        _fail(code)
    try:
        value = float(value)
    except OverflowError:
        _fail(code)
    if not math.isfinite(value):
        _fail(code)
    return 0.0 if value == 0 else value


def _positive_zero(value):
    return 0.0 if value == 0 else value


def _computed(value, code):
    if not math.isfinite(value):
        _fail(code)
    return value


def _add(a, b, code):
    return _computed(a + b, code)


def _sub(a, b, code):
    return _computed(a - b, code)


def _mul(a, b, code):
    return _computed(a * b, code)


# --- fdlibm5.3 StrictMath.hypot, ported from OpenJDK17 java.lang.FdLibm.Hypot and ---
# --- verified bit-exact against java.lang.StrictMath.hypot for an extensive battery. ---
def _hypot_bits(x):
    return struct.unpack("<Q", struct.pack("<d", x))[0]


def _hypot_from_bits(bits):
    return struct.unpack("<d", struct.pack("<Q", bits & 0xFFFFFFFFFFFFFFFF))[0]


def _hi32(x):
    bits = _hypot_bits(x)
    hi = bits >> 32
    return hi - 0x100000000 if hi >= 0x80000000 else hi


def _with_hi32(x, hi):
    low = _hypot_bits(x) & 0xFFFFFFFF
    return _hypot_from_bits(((hi & 0xFFFFFFFF) << 32) | low)


_HYPOT_TWO_MINUS_600 = _hypot_from_bits(0x1a70000000000000)
_HYPOT_TWO_PLUS_600 = _hypot_from_bits(0x6570000000000000)
_HYPOT_A_THRESHOLD = _hypot_from_bits(0x5f300000ffffffff)
_HYPOT_B_THRESHOLD = _hypot_from_bits(0x20b0000000000000)
_HYPOT_MIN_NORMAL = _hypot_from_bits(0x0010000000000000)
_HYPOT_T1_2_1022 = _hypot_from_bits(0x7fd0000000000000)


def _power_of_two_d(n):
    return _hypot_from_bits(((n + 1023) << 52) & 0x7ff0000000000000)


def _hypot(x, y):
    a = abs(x)
    b = abs(y)
    if not (math.isfinite(a) and math.isfinite(b)):
        if a == math.inf or b == math.inf:
            return math.inf
        return a + b
    if b > a:
        a, b = b, a
    ha = _hi32(a)
    hb = _hi32(b)
    if (ha - hb) > 0x3c00000:
        return a + b
    k = 0
    if a > _HYPOT_A_THRESHOLD:
        a = a * _HYPOT_TWO_MINUS_600
        b = b * _HYPOT_TWO_MINUS_600
        k += 600
        ha = _hi32(a)
        hb = _hi32(b)
    if b < _HYPOT_B_THRESHOLD:
        if b < _HYPOT_MIN_NORMAL:
            if b == 0.0:
                return a
            t1 = _HYPOT_T1_2_1022
            b = b * t1
            a = a * t1
            k -= 1022
        else:
            a = a * _HYPOT_TWO_PLUS_600
            b = b * _HYPOT_TWO_PLUS_600
            k -= 600
        ha = _hi32(a)
        hb = _hi32(b)
    w = a - b
    if w > b:
        t1 = _with_hi32(0.0, ha)
        t2 = a - t1
        w = math.sqrt(t1 * t1 - (b * (-b) - t2 * (a + t1)))
    else:
        a = a + a
        y1 = _with_hi32(0.0, hb)
        y2 = b - y1
        t1 = _with_hi32(0.0, ha + 0x00100000)
        t2 = a - t1
        w = math.sqrt(t1 * y1 - (w * (-w) - (t1 * y2 + t2 * b)))
    if k != 0:
        return _power_of_two_d(k) * w
    return w
# --- end fdlibm hypot ---


def _bounds(count, resolution):
    if count < 3 or count > _MAX_CONTROLS or resolution < 1 or count * resolution > _MAX_PRODUCT:
        _fail("INVALID_INPUT")


def _wrap(value, period):
    wrapped = math.fmod(value, period)
    if wrapped < 0:
        wrapped = _add(wrapped, period, "NUMERIC_OVERFLOW")
    return 0.0 if wrapped == period else _positive_zero(wrapped)


@dataclass(frozen=True, slots=True)
class _Spline:
    _controls: list
    _count: int
    _resolution: int
    _a: array
    _b: array
    _c: array
    _d: array
    _cumulative: array
    _length: float

    @property
    def length(self):
        return self._length

    @property
    def control_count(self):
        return self._count

    @property
    def subdivisions(self):
        return self._resolution

    def _position(self, span, t, axis):
        count = self._count
        if t == 1:
            return self._controls[(span + 1) % count][axis]
        if t == 0:
            return self._controls[span][axis]
        k = 2 * span + axis
        a, b, c, d = self._a[k], self._b[k], self._c[k], self._d[k]
        code = "NUMERIC_OVERFLOW"
        return _add(_mul(_add(_mul(_add(_mul(a, t, code), b, code), t, code), c, code), t, code), d, code)

    def _tangent(self, span, t, axis):
        k = 2 * span + axis
        a, b, c = self._a[k], self._b[k], self._c[k]
        if t == 0:
            return c
        code = "NUMERIC_OVERFLOW"
        return _add(_mul(_add(_mul(_mul(3, a, code), t, code), _mul(2, b, code), code), t, code), c, code)

    def _write(self, span, t, target):
        if t == 1:
            span = (span + 1) % self._count
            t = 0
        x = self._position(span, t, 0)
        y = self._position(span, t, 1)
        tx = self._tangent(span, t, 0)
        ty = self._tangent(span, t, 1)
        target[0] = _positive_zero(x)
        target[1] = _positive_zero(y)
        target[2] = _positive_zero(tx)
        target[3] = _positive_zero(ty)

    @staticmethod
    def _query(value):
        if not _finite(value):
            _fail("INVALID_QUERY")

    @staticmethod
    def _check_destination(out):
        if not (type(out) is list or (type(out) is array and out.typecode == "d" and out.itemsize == 8)):
            _fail("INVALID_QUERY")
        if len(out) != 4:
            _fail("INVALID_QUERY")

    def sample_parameter_into(self, value, target):
        """Validate value and the exact length-4 target before writing; return None."""
        self._query(value)
        self._check_destination(target)
        wrapped = _wrap(value, self._count)
        span = math.floor(wrapped)
        self._write(span, wrapped - span, target)

    def sample_parameter(self, value):
        target = [0.0, 0.0, 0.0, 0.0]
        self.sample_parameter_into(value, target)
        return {"x": target[0], "y": target[1], "tangentX": target[2], "tangentY": target[3]}

    def sample_distance_into(self, value, target):
        """Validate value and the exact length-4 target before writing; return None."""
        self._query(value)
        self._check_destination(target)
        if self._length == 0:
            self._write(0, 0, target)
            return
        wrapped = _wrap(value, self._length)
        if wrapped == 0:
            self._write(0, 0, target)
            return
        cumulative = self._cumulative
        lo, hi = 0, len(cumulative) - 1
        while lo + 1 < hi:
            mid = lo + (hi - lo) // 2
            if cumulative[mid] <= wrapped:
                lo = mid
            else:
                hi = mid
        numerator = _sub(wrapped, cumulative[lo], "NUMERIC_OVERFLOW")
        denominator = _sub(cumulative[lo + 1], cumulative[lo], "NUMERIC_OVERFLOW")
        u = _computed(numerator / denominator, "NUMERIC_OVERFLOW")
        resolution = self._resolution
        local = _computed(_add(lo % resolution, u, "NUMERIC_OVERFLOW") / resolution, "NUMERIC_OVERFLOW")
        self._write(lo // resolution, local, target)

    def sample_distance(self, value):
        target = [0.0, 0.0, 0.0, 0.0]
        self.sample_distance_into(value, target)
        return {"x": target[0], "y": target[1], "tangentX": target[2], "tangentY": target[3]}

    def sample(self, query):
        if type(query) is not dict or set(query) != {"mode", "value"}:
            _fail("INVALID_QUERY")
        mode = query["mode"]
        if mode != "parameter" and mode != "distance":
            _fail("INVALID_QUERY")
        value = _number(query["value"], "INVALID_QUERY")
        target = [0.0, 0.0, 0.0, 0.0]
        if mode == "parameter":
            self.sample_parameter_into(value, target)
        else:
            self.sample_distance_into(value, target)
        return {"point": [target[0], target[1]], "tangent": [target[2], target[3]]}

    def serialize(self):
        """Export detached controls in supplied order plus subdivisions; retain no export objects."""
        return {"controls": [[point[0], point[1]] for point in self._controls],
                "subdivisions": self._resolution}


def closed_spline_2d(config):
    """Retain a closed uniform Catmull-Rom spline from explicit planar controls with
    direct parameter and approximate distance queries.

    Implements geometry.closed-spline-2d 0.1.0 independently of source code. Motivating
    sketches: survey/out/2018/Generativos/blobs and survey/out/2018/Generativos/databol;
    no artistic control-count or subdivision range is established, see the catalog
    contract for evidence.
    """
    if type(config) is not dict or set(config) != {"controls", "subdivisions"}:
        _fail("INVALID_INPUT")
    supplied_controls = config["controls"]
    if type(supplied_controls) is not list:
        _fail("INVALID_INPUT")
    rows = supplied_controls
    if len(rows) < 3 or len(rows) > _MAX_CONTROLS:
        _fail("INVALID_INPUT")
    r_raw = _number(config["subdivisions"], "INVALID_INPUT")
    if r_raw < 1 or r_raw > _MAX_PRODUCT or r_raw != math.floor(r_raw):
        _fail("INVALID_INPUT")
    resolution = int(r_raw)
    _bounds(len(rows), resolution)

    count = len(rows)
    controls = [None] * count
    for i in range(count):
        row = rows[i]
        if type(row) is not list or len(row) != 2:
            _fail("INVALID_INPUT")
        controls[i] = (_number(row[0], "INVALID_INPUT"), _number(row[1], "INVALID_INPUT"))

    code = "NUMERIC_OVERFLOW"
    a = array("d", [0.0]) * (2 * count)
    b = array("d", [0.0]) * (2 * count)
    c = array("d", [0.0]) * (2 * count)
    d = array("d", [0.0]) * (2 * count)
    for span in range(count):
        for axis in range(2):
            p0 = controls[(span + count - 1) % count][axis]
            p1 = controls[span][axis]
            p2 = controls[(span + 1) % count][axis]
            p3 = controls[(span + 2) % count][axis]
            k = 2 * span + axis
            a[k] = _mul(0.5, _add(_sub(_add(-p0, _mul(3, p1, code), code), _mul(3, p2, code), code), p3, code), code)
            b[k] = _mul(0.5, _sub(_add(_sub(_mul(2, p0, code), _mul(5, p1, code), code), _mul(4, p2, code), code), p3, code), code)
            c[k] = _mul(0.5, _add(-p0, p2, code), code)
            d[k] = p1

    def position_raw(span, t, axis):
        if t == 1:
            return controls[(span + 1) % count][axis]
        if t == 0:
            return controls[span][axis]
        k = 2 * span + axis
        return _add(_mul(_add(_mul(_add(_mul(a[k], t, code), b[k], code), t, code), c[k], code), t, code), d[k], code)

    cumulative = array("d", [0.0]) * (count * resolution + 1)
    total = 0.0
    index = 0
    for span in range(count):
        previous_x, previous_y = controls[span][0], controls[span][1]
        for step in range(1, resolution + 1):
            t = step / resolution
            x = position_raw(span, t, 0)
            y = position_raw(span, t, 1)
            dx = _sub(x, previous_x, code)
            dy = _sub(y, previous_y, code)
            chord = _computed(_hypot(dx, dy), code)
            total = _add(total, chord, code)
            index += 1
            cumulative[index] = total
            previous_x, previous_y = x, y
    length = _positive_zero(total)
    return _Spline(controls, count, resolution, a, b, c, d, cumulative, length)
