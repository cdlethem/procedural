"""Owned straight-ARGB8 crossfading with caller-supplied second-input weights.

Implements raster.crossfade-2d 0.1.0. Provenance: 2017/Generativos/Eyes/eyes002 image
stamps; spatial weighting and this portable pixel operation are independently specified
project composition work. Working RGB is encoded and premultiplied only for the stated
weighted arithmetic.
"""
import math

__all__ = ["RasterCrossfadeError", "raster_crossfade_2d"]

_UINT32_MAX = 4294967295
_INT32_MAX = 2147483647
_MAX_SAFE = 9007199254740991


class RasterCrossfadeError(ValueError):
    """Stable catalog code for raster.crossfade-2d."""
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _invalid():
    raise RasterCrossfadeError("INVALID_INPUT")


def _exact_keys(record, keys):
    if type(record) is not dict or len(record) != len(keys) or any(key not in record for key in keys):
        _invalid()


def _number(value):
    if type(value) not in (int, float) or isinstance(value, bool):
        _invalid()
    value = float(value)
    if not math.isfinite(value):
        _invalid()
    return value


def _dimension(value):
    n = _number(value)
    if n < 1 or n != math.floor(n) or n > _INT32_MAX:
        _invalid()
    return int(n)


def _count(width, height):
    product = width * height
    if width < 1 or height < 1 or product > _INT32_MAX:
        _invalid()
    return product


def _unsigned(value):
    n = _number(value)
    if n < 0 or n > _UINT32_MAX or n != math.floor(n):
        _invalid()
    return int(n)


def _weight(value):
    n = _number(value)
    if n < 0 or n > 1:
        _invalid()
    return n


def _object_pixels(value, pixel_count):
    if type(value) is not list or len(value) != pixel_count:
        _invalid()
    return [_unsigned(pixel) for pixel in value]


def _object_raster(value):
    _exact_keys(value, ("width", "height", "pixels"))
    width = _dimension(value["width"])
    height = _dimension(value["height"])
    pixel_count = _count(width, height)
    return {"width": width, "height": height, "pixels": _object_pixels(value["pixels"], pixel_count)}


def _quantize(value):
    clamped_low = max(0.0, value)
    clamped = min(255.0, clamped_low)
    return math.floor(clamped + 0.5)


def _channel(first, second, u, v, a):
    p = first * u
    q = second * v
    total = p + q
    color = total / a
    return _quantize(color)


def _composite(first, second, weight):
    if weight == 0.0:
        return first
    if weight == 1.0:
        return second
    t = 1.0 - weight
    first_alpha = (first >> 24) & 0xFF
    af = first_alpha / 255.0
    second_alpha = (second >> 24) & 0xFF
    a_s = second_alpha / 255.0
    u = af * t
    v = a_s * weight
    a = u + v
    if a == 0.0:
        return 0
    alpha = _quantize(a * 255.0)
    if alpha == 0:
        return 0
    red = _channel((first >> 16) & 0xFF, (second >> 16) & 0xFF, u, v, a)
    green = _channel((first >> 8) & 0xFF, (second >> 8) & 0xFF, u, v, a)
    blue = _channel(first & 0xFF, second & 0xFF, u, v, a)
    return (alpha << 24) | (red << 16) | (green << 8) | blue


class _Crossfade:
    __slots__ = ("_height", "_pixels", "_width")

    def __init__(self, width, height, pixels):
        self._width = width
        self._height = height
        self._pixels = pixels

    @property
    def width(self):
        return self._width

    @property
    def height(self):
        return self._height

    def _index(self, value):
        if type(value) not in (int, float) or isinstance(value, bool):
            raise RasterCrossfadeError("INVALID_INDEX")
        value = float(value)
        if not math.isfinite(value) or value < 0 or value != math.floor(value) or value > _MAX_SAFE:
            raise RasterCrossfadeError("INVALID_INDEX")
        value = int(value)
        if value >= len(self._pixels):
            raise RasterCrossfadeError("INDEX_OUT_OF_RANGE")
        return value

    def pixel_at(self, value):
        return self._pixels[self._index(value)]

    def pixels(self):
        return list(self._pixels)

    def to_values(self):
        return {"width": self._width, "height": self._height, "pixels": list(self._pixels)}


def _validated(width, height, first, second, weights):
    pixel_count = _count(width, height)
    output = [_composite(first[i], second[i], weights[i]) for i in range(pixel_count)]
    return _Crossfade(width, height, output)


def raster_crossfade_2d(input_value):
    """Crossfade exact portable first, second, and weights records."""
    _exact_keys(input_value, ("first", "second", "weights"))
    first = _object_raster(input_value["first"])
    second_value = input_value["second"]
    _exact_keys(second_value, ("width", "height", "pixels"))
    second_width = _dimension(second_value["width"])
    second_height = _dimension(second_value["height"])
    second_count = _count(second_width, second_height)
    if first["width"] != second_width or first["height"] != second_height:
        _invalid()
    second = _object_pixels(second_value["pixels"], second_count)

    supplied_weights = input_value["weights"]
    if type(supplied_weights) is not list or len(supplied_weights) != len(first["pixels"]):
        _invalid()
    weights = [_weight(value) for value in supplied_weights]
    return _validated(first["width"], first["height"], first["pixels"], second, weights)
