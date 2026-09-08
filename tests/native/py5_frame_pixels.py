"""Registered native pixel probes for the internal Py5Frame adapter.

Called by the root-owned actual py5 Sketch driver. This module does not create a
sketch, launch py5, save images, or claim complete profile support.
"""
from __future__ import annotations

import struct
import traceback
from typing import Any

from procedurals._drawing_state import FrameError
from procedurals._py5_frame import Py5Frame

MIN_WIDTH = 1.0 / 256.0
MINIMUM_WIDTH_COVERAGE_PIXELS = None


def _env(width: int, height: int, background: int) -> dict[str, int]:
    return {"width": width, "height": height, "density": 1, "background": background}


def _segment(x1, y1, x2, y2, rgb, opacity8, width) -> dict[str, Any]:
    return {
        "kind": "segment2", "from": [x1, y1], "to": [x2, y2],
        "rgb": rgb, "opacity8": opacity8, "width": width, "cap": "round",
    }


def _quad(x1, y1, x2, y2, x3, y3, x4, y4, rgb, opacity8) -> dict[str, Any]:
    return {
        "kind": "quad2", "vertices": [[x1, y1], [x2, y2], [x3, y3], [x4, y4]],
        "rgb": rgb, "opacity8": opacity8,
    }


def _check(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def _argb(value: Any) -> int:
    return int(value) & 0xFFFFFFFF


def _channels(value: Any) -> tuple[int, int, int, int]:
    pixel = _argb(value)
    return ((pixel >> 24) & 255, (pixel >> 16) & 255, (pixel >> 8) & 255, pixel & 255)


def _near(actual: int, expected: int, tolerance: int = 2) -> bool:
    return abs(actual - expected) <= tolerance


def _raw_pixels(surface) -> Any:
    surface.load_pixels()
    raw = surface._instance.pixels
    _check(raw is not None, "completed surface did not expose raw pixels")
    return raw


def _pixel(surface, x: int, y: int) -> int:
    pixels = _raw_pixels(surface)
    return _argb(pixels[y * surface.width + x])


def _render(sketch, environment: dict[str, int], commands: list[dict[str, Any]]):
    frame = Py5Frame(sketch)
    completed = None
    try:
        frame.begin(environment)
        frame.batch(commands)
        completed = frame.end()
        return completed
    except BaseException:
        if completed is not None:
            Py5Frame.release_completed(completed)
        elif frame.state != "completed":
            frame.abort()
        raise


def _release(surface) -> None:
    if surface is not None:
        Py5Frame.release_completed(surface)


def _next_float(value: float) -> float:
    bits = struct.unpack(">I", struct.pack(">f", value))[0]
    return struct.unpack(">f", struct.pack(">I", bits + 1))[0]


def _previous_float(value: float) -> float:
    bits = struct.unpack(">I", struct.pack(">f", value))[0]
    return struct.unpack(">f", struct.pack(">I", bits - 1))[0]


def _more_negative_float(value: float) -> float:
    bits = struct.unpack(">I", struct.pack(">f", value))[0]
    return struct.unpack(">f", struct.pack(">I", bits + 1))[0]


def _expect_frame_error(code: str, index: int | None, action) -> None:
    try:
        action()
    except FrameError as error:
        _check(error.code == code, f"error code {error.code} != {code}")
        _check(error.command_index == index, f"error index {error.command_index} != {index}")
        return
    raise AssertionError(f"expected {code}")


def _group_background_sizes(sketch, observations: dict[str, Any]) -> None:
    background = 0x123456
    sizes = ((1, 1), (640, 640), (1920, 1080), (2048, 1), (1, 2048), (2048, 2048))
    checked = []
    for width, height in sizes:
        surface = _render(sketch, _env(width, height, background), [])
        try:
            raw = surface._instance
            _check(surface.width == width and surface.height == height, "logical dimensions")
            _check(surface.pixel_density == 1 and surface.pixel_width == width and surface.pixel_height == height,
                   "density/backing dimensions")
            from jpype import JClass
            backing = JClass('processing.core.PGraphics').class_.getField('image').get(raw)
            _check(backing is not None and backing.getWidth(None) == width and backing.getHeight(None) == height,
                   "JAVA2D backing image")
            expected = 0xFF000000 | background
            pixels = _raw_pixels(surface)
            _check(len(pixels) == width * height, "pixel count")
            _check(all(_argb(value) == expected for value in pixels), "background RGB/alpha")
            checked.append({"width": width, "height": height, "pixels": len(pixels)})
        finally:
            _release(surface)
    observations["background_sizes"] = checked
    observations["parent_density"] = int(sketch._instance.sketchPixelDensity())


def _group_bounds_clipping_widths(sketch, observations: dict[str, Any]) -> None:
    environment = _env(64, 64, 0)
    valid = [
        _segment(-64, 4, 128, 4, 0xFFFFFF, 255, MIN_WIDTH),
        _segment(0, -64, 0, 128, 0xFFFFFF, 255, 1),
        _segment(_previous_float(-64), 8, _previous_float(128), 8, 0xFFFFFF, 255, _next_float(MIN_WIDTH)),
        _segment(8, _previous_float(-64), 8, _previous_float(128), 0xFFFFFF, 255, _previous_float(64)),
        _quad(-64, 0, 0, -64, 128, 0, 0, 128, 0xFFFFFF, 255),
        _segment(32, 32, 33, 32, 0xFFFFFF, 255, 64),
    ]
    surface = _render(sketch, environment, valid)
    try:
        _check(_pixel(surface, 32, 32) != 0xFF000000, "maximum-width command")
    finally:
        _release(surface)

    offscreen = _render(sketch, environment, [_segment(-64, -64, -63, -63, 0xFFFFFF, 255, 1)])
    try:
        _check(all(_argb(value) == 0xFF000000 for value in _raw_pixels(offscreen)), "offscreen clipping")
    finally:
        _release(offscreen)

    crossing = _render(sketch, environment, [_segment(0, 32, 64, 32, 0x00FF00, 255, 4)])
    try:
        _check(_pixel(crossing, 32, 32) != 0xFF000000, "central crossing")
    finally:
        _release(crossing)

    minimum = _render(sketch, environment, [_segment(8, 16, 56, 16, 0xFFFFFF, 255, MIN_WIDTH)])
    try:
        global MINIMUM_WIDTH_COVERAGE_PIXELS
        MINIMUM_WIDTH_COVERAGE_PIXELS = sum(_argb(value) != 0xFF000000 for value in _raw_pixels(minimum))
    finally:
        _release(minimum)

    invalid = [
        _segment(0, 0, _next_float(128), 1, 0xFFFFFF, 255, 1),
        _segment(0, 0, _more_negative_float(-64), 1, 0xFFFFFF, 255, 1),
        _segment(0, 0, 1, _next_float(128), 0xFFFFFF, 255, 1),
        _segment(0, 0, 1, _more_negative_float(-64), 0xFFFFFF, 255, 1),
        _segment(0, 0, 1, 1, 0xFFFFFF, 255, _previous_float(MIN_WIDTH)),
        _segment(0, 0, 1, 1, 0xFFFFFF, 255, _next_float(64)),
        _quad(0, 0, _next_float(128), 0, _next_float(128), 1, 0, 1, 0xFFFFFF, 255),
        _quad(0, 0, 1, _more_negative_float(-64), 1, 0, 0, 1, 0xFFFFFF, 255),
    ]
    for command in invalid:
        frame = Py5Frame(sketch)
        try:
            frame.begin(environment)
            _expect_frame_error("INVALID_COMMAND", 0, lambda: frame.batch([command]))
            _check(frame.state == "aborted", "invalid batch state")
        finally:
            if frame.state != "completed":
                frame.abort()

    atomic = Py5Frame(sketch)
    try:
        atomic.begin(environment)
        _expect_frame_error("INVALID_COMMAND", 1, lambda: atomic.batch([
            _segment(0, 32, 64, 32, 0xFF0000, 255, 4),
            _segment(0, 0, 0, 0, 0xFFFFFF, 255, 1),
        ]))
        _check(atomic.count == 0 and atomic.state == "aborted", "invalid batch atomicity")
    finally:
        if atomic.state != "completed":
            atomic.abort()
    observations["minimum_width_coverage_pixels"] = MINIMUM_WIDTH_COVERAGE_PIXELS
    observations["minimum_width_visible_pixel_guarantee"] = "none; recorded native observation only"


def _overlap_pixel(sketch, reverse: bool) -> int:
    red = _quad(8, 8, 40, 8, 40, 40, 8, 40, 0xFF0000, 128)
    blue = _quad(24, 8, 56, 8, 56, 40, 24, 40, 0x0000FF, 128)
    surface = _render(sketch, _env(64, 64, 0), [blue, red] if reverse else [red, blue])
    try:
        return _pixel(surface, 30, 24)
    finally:
        _release(surface)


def _quad_pixels(sketch, reverse: bool) -> tuple[int, ...]:
    command = (_quad(8, 56, 56, 56, 56, 8, 8, 8, 0x336699, 173) if reverse else
               _quad(8, 8, 56, 8, 56, 56, 8, 56, 0x336699, 173))
    surface = _render(sketch, _env(64, 64, 0), [command])
    try:
        return tuple(_argb(value) for value in _raw_pixels(surface))
    finally:
        _release(surface)


def _group_alpha_winding_order(sketch, observations: dict[str, Any]) -> None:
    forward = _channels(_overlap_pixel(sketch, False))
    reverse = _channels(_overlap_pixel(sketch, True))
    _check(forward[0] == 255 and forward[3] > forward[1], "blue-over-red order")
    _check(reverse[0] == 255 and reverse[1] > reverse[3], "red-over-blue order")
    _check(_near(forward[3], 128) and _near(forward[1], 64), "forward source-over")
    _check(_near(reverse[1], 128) and _near(reverse[3], 64), "reverse source-over")

    opaque = _render(sketch, _env(64, 64, 0), [_quad(8, 8, 56, 8, 56, 56, 8, 56, 0x123456, 255)])
    try:
        _check(_pixel(opaque, 32, 32) == 0xFF123456, "opaque fill")
    finally:
        _release(opaque)
    transparent = _render(sketch, _env(64, 64, 0), [_quad(8, 8, 56, 8, 56, 56, 8, 56, 0xFFFFFF, 0)])
    try:
        _check(_pixel(transparent, 32, 32) == 0xFF000000, "transparent fill")
    finally:
        _release(transparent)

    _check(_quad_pixels(sketch, False) == _quad_pixels(sketch, True), "quad winding")
    seam = _render(sketch, _env(64, 64, 0), [_quad(8, 8, 56, 8, 56, 56, 8, 56, 0x663399, 128)])
    try:
        pixels = _raw_pixels(seam)
        interior = _argb(pixels[32 * seam.width + 32])
        for y in range(10, 55):
            for x in range(10, 55):
                _check(_argb(pixels[y * seam.width + x]) == interior, f"quad seam {x},{y}")
    finally:
        _release(seam)
    observations["overlap_forward_channels_argb"] = list(forward)
    observations["overlap_reverse_channels_argb"] = list(reverse)


def _group_style_caps_parent_isolation(sketch, observations: dict[str, Any]) -> None:
    raw_parent = sketch._instance.g
    sketch.background(0x112233)
    sketch.translate(3, 5)
    sketch.clip(0, 0, 20, 20)
    sketch.fill(17, 34, 51, 255)
    sketch.stroke(68, 85, 102, 255)
    sketch.load_pixels()
    parent_pixels = tuple(_argb(value) for value in sketch._instance.pixels)
    parent_transform = str(raw_parent.g2.getTransform())
    parent_clip = str(raw_parent.g2.getClip())
    parent_fill = int(raw_parent.fillColor)
    parent_stroke = int(raw_parent.strokeColor)

    surface = _render(sketch, _env(64, 64, 0), [
        _segment(16, 32, 48, 32, 0xFF0000, 255, 8),
        _quad(20, 12, 44, 12, 44, 24, 20, 24, 0x00FF00, 255),
        _segment(8, 8, 56, 8, 0x0000FF, 255, 2),
    ])
    try:
        _check(_pixel(surface, 13, 32) == 0xFFFF0000, "round cap extension")
        _check(_pixel(surface, 10, 32) == 0xFF000000, "round cap too long")
        _check(_pixel(surface, 32, 18) == 0xFF00FF00, "quad fill transition")
        _check(_pixel(surface, 32, 10) == 0xFF000000, "quad stroke inheritance")
    finally:
        _release(surface)

    sketch.load_pixels()
    _check(tuple(_argb(value) for value in sketch._instance.pixels) == parent_pixels, "parent pixels")
    _check(str(raw_parent.g2.getTransform()) == parent_transform, "parent transform")
    _check(str(raw_parent.g2.getClip()) == parent_clip, "parent clip")
    _check(int(raw_parent.fillColor) == parent_fill and int(raw_parent.strokeColor) == parent_stroke, "parent styles")
    observations["parent_density"] = int(sketch._instance.sketchPixelDensity())


def _run_group(identifier: str, action) -> dict[str, Any]:
    try:
        action()
        return {"id": identifier, "passed": True}
    except BaseException as error:
        return {"id": identifier, "passed": False, "failure": f"{type(error).__name__}: {error}",
                "traceback": traceback.format_exc()}


def run_pixels(sketch) -> dict[str, Any]:
    """Run registered groups 1-4 against an actual density-2 py5 sketch."""
    observations: dict[str, Any] = {}
    groups = [
        _run_group("1-background-sizes", lambda: _group_background_sizes(sketch, observations)),
        _run_group("2-bounds-clipping-widths", lambda: _group_bounds_clipping_widths(sketch, observations)),
        _run_group("3-alpha-winding-order", lambda: _group_alpha_winding_order(sketch, observations)),
        _run_group("4-style-caps-parent-isolation", lambda: _group_style_caps_parent_isolation(sketch, observations)),
    ]
    failures = sum(not group["passed"] for group in groups)
    return {
        "passed": failures == 0,
        "profile": "drawing.fresh-raster-2d",
        "adapter": "Py5Frame JAVA2D",
        "scope": "registered native probe groups 1-4 only; no lifecycle fault injection, CP1 route, or full-profile support claim",
        "runtime_requirement": "py5 0.10.11a0 on Python 3.13/JDK 17 under xvfb",
        "failures": failures,
        "groups": groups,
        "observations": observations,
    }
