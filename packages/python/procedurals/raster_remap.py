"""Owned ARGB8 pull remapping with clamped, straight-channel bilinear sampling,
independently specified by the shared raster.bilinear-remap-2d contract.

Motivating note: survey/out/2016/Generativos/colorRamp/notes.md (active source-
coordinate pull sampling); dimensions, coordinates and pixels are caller data, no
encouraged range is evidenced. Stored channels are interpolated independently
(straight, not premultiplied).
"""
from array import array
from dataclasses import dataclass
import math

__all__ = ["RasterRemapError", "bilinear_raster_remap_2d"]
_INT32_MAX = 2147483647
_MAX_OUTPUT_COUNT = 1073741823
_MAX_UNSIGNED32 = 4294967295
_MAX_SAFE = 9007199254740991


class RasterRemapError(ValueError):
    """Stable catalog code: INVALID_INPUT, INVALID_INDEX or INDEX_OUT_OF_RANGE."""
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _fail(code):
    raise RasterRemapError(code)


def _number(value):
    if type(value) not in (int, float) or type(value) is bool:
        _fail("INVALID_INPUT")
    try:
        value = float(value)
    except OverflowError:
        raise RasterRemapError("INVALID_INPUT") from None
    if not math.isfinite(value):
        _fail("INVALID_INPUT")
    return value


def _dimension(value):
    n = _number(value)
    if n < 1 or n != math.floor(n) or n > _INT32_MAX:
        _fail("INVALID_INPUT")
    return int(n)


def _source_count(w, h):
    if w < 1 or h < 1 or w * h > _INT32_MAX:
        _fail("INVALID_INPUT")
    return w * h


def _output_count(w, h):
    if w < 1 or h < 1 or w * h > _MAX_OUTPUT_COUNT:
        _fail("INVALID_INPUT")
    return w * h


def _unsigned(value):
    n = _number(value)
    if n < 0 or n > _MAX_UNSIGNED32 or n != math.floor(n):
        _fail("INVALID_INPUT")
    return int(n)


def _coordinate(value):
    return _number(value)


def _channel(a, b, c, d, fx, fy):
    top = a + (b - a) * fx
    bottom = c + (d - c) * fx
    value = top + (bottom - top) * fy
    value = max(0.0, min(255.0, value))
    return math.floor(value + 0.5)


def _sample_at(source, width, height, x, y):
    x = max(0.0, min(x, width - 1.0))
    y = max(0.0, min(y, height - 1.0))
    x0, y0 = math.floor(x), math.floor(y)
    x1, y1 = min(x0 + 1, width - 1), min(y0 + 1, height - 1)
    fx, fy = x - x0, y - y0
    p00 = source[y0 * width + x0]
    p10 = source[y0 * width + x1]
    p01 = source[y1 * width + x0]
    p11 = source[y1 * width + x1]
    a = _channel((p00 >> 24) & 255, (p10 >> 24) & 255, (p01 >> 24) & 255, (p11 >> 24) & 255, fx, fy)
    r = _channel((p00 >> 16) & 255, (p10 >> 16) & 255, (p01 >> 16) & 255, (p11 >> 16) & 255, fx, fy)
    g = _channel((p00 >> 8) & 255, (p10 >> 8) & 255, (p01 >> 8) & 255, (p11 >> 8) & 255, fx, fy)
    b = _channel(p00 & 255, p10 & 255, p01 & 255, p11 & 255, fx, fy)
    return (a << 24) | (r << 16) | (g << 8) | b


@dataclass(frozen=True, slots=True)
class _Raster:
    _width: int
    _height: int
    _pixels: array

    @property
    def width(self):
        return self._width

    @property
    def height(self):
        return self._height

    def _index(self, value):
        if type(value) not in (int, float) or type(value) is bool:
            _fail("INVALID_INDEX")
        if type(value) is float and (not math.isfinite(value) or not value.is_integer()):
            _fail("INVALID_INDEX")
        if value < 0 or value > _MAX_SAFE:
            _fail("INVALID_INDEX")
        value = int(value)
        if value >= len(self._pixels):
            _fail("INDEX_OUT_OF_RANGE")
        return value

    def pixel_at(self, index):
        """Return the unsigned32 ARGB8 bit pattern at index."""
        return self._pixels[self._index(index)]

    def pixels(self):
        """Return a fresh detached array('I') of unsigned32 ARGB8 bit patterns."""
        return array("I", self._pixels)

    def to_values(self):
        """Export detached width, height and pixels; retain no export objects."""
        return {"width": self._width, "height": self._height, "pixels": list(self._pixels)}


def bilinear_raster_remap_2d(config):
    """Remap an owned packed ARGB8 raster through explicit source coordinates using
    edge-clamped bilinear interpolation.

    Implements raster.bilinear-remap-2d 0.1.0 independently of source code.
    """
    if type(config) is not dict or set(config) != {"source", "outputWidth", "outputHeight", "sourceCoordinates"}:
        _fail("INVALID_INPUT")
    source_value = config["source"]
    if type(source_value) is not dict or set(source_value) != {"width", "height", "pixels"}:
        _fail("INVALID_INPUT")
    sw = _dimension(source_value["width"])
    sh = _dimension(source_value["height"])
    source_count = _source_count(sw, sh)
    supplied_pixels = source_value["pixels"]
    if type(supplied_pixels) is not list or len(supplied_pixels) != source_count:
        _fail("INVALID_INPUT")
    source_pixels = array("I", (0,)) * source_count
    for i in range(source_count):
        source_pixels[i] = _unsigned(supplied_pixels[i])

    ow = _dimension(config["outputWidth"])
    oh = _dimension(config["outputHeight"])
    output_count = _output_count(ow, oh)
    supplied_coordinates = config["sourceCoordinates"]
    if type(supplied_coordinates) is not list or len(supplied_coordinates) != output_count:
        _fail("INVALID_INPUT")
    xy = [0.0] * (2 * output_count)
    for i in range(output_count):
        pair = supplied_coordinates[i]
        if type(pair) is not list or len(pair) != 2:
            _fail("INVALID_INPUT")
        xy[2 * i] = _coordinate(pair[0])
        xy[2 * i + 1] = _coordinate(pair[1])

    output = array("I", (0,)) * output_count
    for index in range(output_count):
        output[index] = _sample_at(source_pixels, sw, sh, xy[2 * index], xy[2 * index + 1])
    return _Raster(ow, oh, output)
