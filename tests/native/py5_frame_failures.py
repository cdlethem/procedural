"""Registered py5 lifecycle probes using real JAVA2D Py5Graphics resources.

The root-owned sketch driver calls :func:`run_failures` on its sketch thread.
Faults are deliberately injected by temporary Py5Graphics wrapper overrides or
the adapter's private factory seam; this is not evidence of spontaneous JVM or
device failure.
"""
from __future__ import annotations

import traceback
from typing import Any
from unittest.mock import PropertyMock, patch

from procedurals._drawing_state import FrameError
from procedurals._py5_frame import Py5Frame


ENVIRONMENT = {"width": 32, "height": 24, "density": 1, "background": 0x123456}
SEGMENT = {
    "kind": "segment2", "from": [4, 8], "to": [24, 8],
    "rgb": 0xAA3311, "opacity8": 180, "width": 2, "cap": "round",
}
# Different canonical coordinates collapse to the same binary32 coordinate.
CONVERTED_NOOP = {
    "kind": "segment2", "from": [1, 1], "to": [1 + 2 ** -25, 1],
    "rgb": 0xAA3311, "opacity8": 180, "width": 1, "cap": "round",
}


def _check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _expect(code: str, index: int | None, action) -> FrameError:
    try:
        action()
    except FrameError as error:
        _check(error.code == code, f"expected {code}, got {error.code}")
        _check(error.command_index == index,
               f"expected index {index}, got {error.command_index}")
        return error
    raise AssertionError(f"expected {code}")


def _image(raw):
    """Use reflection because JPype maps ``raw.image`` to a draw overload."""
    from jpype import JClass
    return JClass("processing.core.PGraphics").class_.getField("image").get(raw)


def _released(graphics) -> bool:
    raw = graphics._instance
    return (raw.g2 is None and raw.pixels is None and _image(raw) is None and
            getattr(graphics, "_np_pixels", None) is None and
            getattr(graphics, "_java_bb", None) is None and
            getattr(graphics, "_py_bb", None) is None)


def _prepared_factory(sketch, created: list):
    """Return genuine, already-ready Py5Graphics for the adapter test seam."""
    def factory(width, height, renderer):
        graphics = sketch.create_graphics(width, height, renderer)
        raw = graphics._instance
        # The injected factory contract deliberately supplies a ready owned surface.
        raw.pixelDensity = 1
        raw.setSize(width, height)
        probe = raw.checkImage()
        if probe is None:
            raise RuntimeError("could not allocate real JAVA2D test surface")
        probe.dispose()
        created.append(graphics)
        return graphics
    return factory


def _cleanup(frame: Py5Frame | None, created: list) -> None:
    """Release every actual resource even if an assertion itself fails."""
    if frame is not None:
        try:
            if frame.state != "completed":
                frame.abort()
        except BaseException:
            pass
    for graphics in created:
        try:
            Py5Frame.release_completed(graphics)
        except BaseException:
            pass


def _new_frame(sketch, created: list | None = None):
    if created is None:
        created = []
    return Py5Frame(sketch, _factory=_prepared_factory(sketch, created)), created


def _invalid_environment_precedes_static_capability(sketch) -> dict[str, Any]:
    import py5
    called: list[bool] = []
    frame = Py5Frame(None, _factory=lambda *_: called.append(True))
    bad = dict(ENVIRONMENT, width=0)
    _expect("INVALID_ENVIRONMENT", None, lambda: frame.begin(bad))
    _check(frame.state == "aborted" and not called, "invalid environment acquired a surface")
    unsupported = Py5Frame(None)
    _expect("UNSUPPORTED_CAPABILITY", None, lambda: unsupported.begin(ENVIRONMENT))
    with patch.object(py5.Py5Graphics, "line", None):
        missing = Py5Frame(sketch, _factory=lambda *_: called.append(True))
        _expect("UNSUPPORTED_CAPABILITY", None, lambda: missing.begin(ENVIRONMENT))
    _check(not called, "static capability failure allocated a surface")
    return {"invalid_before_capability": True, "static_before_acquisition": True}


def _factory_phase(sketch, host_error: BaseException) -> dict[str, Any]:
    frame = Py5Frame(sketch, _factory=lambda *_: (_ for _ in ()).throw(host_error))
    _expect("RESOURCE_FAILURE", None, lambda: frame.begin(ENVIRONMENT))
    _check(frame.state == "aborted", "allocation failure state")
    return {"state": frame.state}


def _readiness_phase(sketch, host_error: BaseException) -> dict[str, Any]:
    import py5
    frame, created = _new_frame(sketch)
    try:
        # width/height are read first; this property is the final readiness probe.
        with patch.object(py5.Py5Graphics, "pixel_density",
                          new_callable=PropertyMock, side_effect=host_error):
            _expect("RESOURCE_FAILURE", None, lambda: frame.begin(ENVIRONMENT))
        _check(frame.state == "aborted" and len(created) == 1, "readiness ownership")
        _check(_released(created[0]), "readiness did not release real backing")
        return {"state": frame.state, "released": True}
    finally:
        _cleanup(frame, created)


def _initialization_phase(sketch, host_error: BaseException) -> dict[str, Any]:
    import py5
    frame, created = _new_frame(sketch)
    try:
        with patch.object(py5.Py5Graphics, "background", side_effect=host_error):
            _expect("RENDER_FAILURE", None, lambda: frame.begin(ENVIRONMENT))
        _check(frame.state == "aborted" and _released(created[0]), "initialization cleanup")
        return {"state": frame.state, "released": True}
    finally:
        _cleanup(frame, created)


def _incompatible_supplied_surface(sketch) -> dict[str, Any]:
    checked=[]
    for mismatch in ('density', 'parent'):
        created=[]
        def factory(width, height, renderer):
            if mismatch=='density':
                graphics=sketch.create_graphics(width,height,renderer)
                created.append(graphics)
                _check(graphics.pixel_density==2, 'test surface did not inherit density two')
                probe=graphics._instance.checkImage()
                probe.dispose()
            else:
                graphics=_prepared_factory(sketch,created)(width,height,renderer)
                graphics._instance.parent=None
            return graphics
        frame=Py5Frame(sketch,_factory=factory)
        try:
            _expect('RESOURCE_FAILURE',None,lambda:frame.begin(ENVIRONMENT))
            _check(len(created)==1 and _released(created[0]),'mismatched supplied backing leaked')
            if mismatch=='density':
                _check(created[0].pixel_density==2,'adapter silently repaired supplied density')
            checked.append(mismatch)
        finally:_cleanup(frame,created)
    return {'rejected_without_repair':checked}


def _draw_phase(sketch, host_error: BaseException) -> dict[str, Any]:
    import py5
    frame, created = _new_frame(sketch)
    try:
        frame.begin(ENVIRONMENT)
        frame.batch([SEGMENT])
        _check(frame.count == 1, "prior batch did not commit")
        with patch.object(py5.Py5Graphics, "stroke", side_effect=host_error):
            _expect("RENDER_FAILURE", 2, lambda: frame.batch([CONVERTED_NOOP, SEGMENT]))
        _check(frame.state == "aborted" and frame.count == 1, "draw failure count/state")
        _check(_released(created[0]), "draw failure did not release backing")
        return {"state": frame.state, "count": frame.count, "index": 2}
    finally:
        _cleanup(frame, created)


def _end_phase(sketch, host_error: BaseException) -> dict[str, Any]:
    import py5
    frame, created = _new_frame(sketch)
    try:
        frame.begin(ENVIRONMENT)
        with patch.object(py5.Py5Graphics, "end_draw", side_effect=host_error):
            _expect("RENDER_FAILURE", None, frame.end)
        _check(frame.state == "aborted" and _released(created[0]), "end cleanup")
        return {"state": frame.state, "released": True}
    finally:
        _cleanup(frame, created)


def _atomicity_and_abort(sketch) -> dict[str, Any]:
    import py5
    frame, created = _new_frame(sketch)
    try:
        frame.begin(ENVIRONMENT)
        invalid = dict(SEGMENT, to=[4, 8])
        with patch.object(py5.Py5Graphics, "stroke", wraps=created[0].stroke) as stroke:
            _expect("INVALID_COMMAND", 1, lambda: frame.batch([SEGMENT, invalid]))
            _check(stroke.call_count == 0, "invalid batch drew before full validation")
        _check(frame.count == 0 and frame.state == "aborted", "invalid batch was not atomic")
        _check(_released(created[0]), "invalid batch release")

        frame, _ = _new_frame(sketch, created)
        frame.begin(ENVIRONMENT)
        frame.abort()
        _expect("INVALID_STATE", None, frame.end)
        _check(frame.state == "aborted" and _released(created[-1]), "abort published output")
        return {"atomic_count": 0, "abort_output": None}
    finally:
        _cleanup(frame, created)


def _reentry_and_cleanup_primary(sketch) -> dict[str, Any]:
    import py5
    frame, created = _new_frame(sketch)
    try:
        frame.begin(ENVIRONMENT)
        with patch.object(py5.Py5Graphics, "stroke", side_effect=lambda *_: frame.end()):
            _expect("INVALID_STATE", None, lambda: frame.batch([SEGMENT]))
        _check(frame.state == "aborted" and _released(created[0]), "reentry cleanup")

        frame, _ = _new_frame(sketch, created)
        frame.begin(ENVIRONMENT)
        target = created[-1]
        original_setattr = py5.Py5Graphics.__setattr__
        fired = False

        def cleanup_setattr(instance, name, value):
            nonlocal fired
            if instance is target and name == "_np_pixels" and not fired:
                fired = True
                raise RuntimeError("injected cleanup assignment failure")
            return original_setattr(instance, name, value)

        with patch.object(py5.Py5Graphics, "stroke", side_effect=RuntimeError("draw primary")), \
             patch.object(py5.Py5Graphics, "__setattr__", cleanup_setattr):
            error = _expect("RENDER_FAILURE", 0, lambda: frame.batch([SEGMENT]))
        _check(fired and frame.state == "aborted", "cleanup injection did not run")
        _check(any("cleanup failures" in note for note in getattr(error, "__notes__", ())),
               "cleanup did not retain primary error")
        raw=target._instance
        _check(raw.g2 is None and raw.pixels is None and _image(raw) is None,
               "cleanup exception prevented native backing detachment")
        return {"reentry": "INVALID_STATE", "cleanup_primary": error.code}
    finally:
        _cleanup(frame, created)


def _completed_transfer(sketch) -> dict[str, Any]:
    frame, created = _new_frame(sketch)
    completed = None
    try:
        frame.begin(ENVIRONMENT)
        completed = frame.end()
        # Allocate the real NumPy/direct view before release, then require clearing.
        completed.load_np_pixels()
        raw = completed._instance
        _check(_image(raw) is not None and completed._np_pixels is not None,
               "completed output was not live")
        _check(completed._java_bb is not None and completed._py_bb is not None,
               "direct-buffer release probe did not allocate buffers")
        _expect("INVALID_STATE", None, frame.end)
        _expect("INVALID_STATE", None, frame.abort)
        _check(_image(raw) is not None, "misuse released completed output")
        Py5Frame.release_completed(completed)
        _check(_released(completed), "release retained Java/Python backing")
        Py5Frame.release_completed(completed)
        _check(_released(completed), "repeated release was not idempotent")
        return {"completed_live_before_release": True, "released_twice": True}
    finally:
        _cleanup(frame, created)


def _run(identifier: str, injected: bool, action) -> dict[str, Any]:
    try:
        return {"id": identifier, "injected": injected, "passed": True, "details": action()}
    except BaseException as error:
        return {"id": identifier, "injected": injected, "passed": False,
                "failure": f"{type(error).__name__}: {error}", "traceback": traceback.format_exc()}


def run_failures(sketch) -> dict[str, Any]:
    """Run registered lifecycle/ownership group 5; the caller owns native execution."""
    misleading = FrameError("INVALID_COMMAND", 777)
    groups = [
        _run("invalid-environment-before-capability", False,
             lambda: _invalid_environment_precedes_static_capability(sketch)),
        _run("allocation-phase", True, lambda: _factory_phase(sketch, RuntimeError("injected allocation"))),
        _run("allocation-misleading-frame-error", True, lambda: _factory_phase(sketch, misleading)),
        _run("readiness-phase", True, lambda: _readiness_phase(sketch, RuntimeError("injected readiness"))),
        _run("readiness-misleading-frame-error", True, lambda: _readiness_phase(sketch, misleading)),
        _run("supplied-density-and-parent-mismatch", True, lambda: _incompatible_supplied_surface(sketch)),
        _run("initialization-phase", True, lambda: _initialization_phase(sketch, RuntimeError("injected init"))),
        _run("initialization-misleading-frame-error", True, lambda: _initialization_phase(sketch, misleading)),
        _run("draw-phase-prior-batch-noop-index", True, lambda: _draw_phase(sketch, RuntimeError("injected draw"))),
        _run("draw-misleading-frame-error", True, lambda: _draw_phase(sketch, misleading)),
        _run("end-phase", True, lambda: _end_phase(sketch, RuntimeError("injected end"))),
        _run("end-misleading-frame-error", True, lambda: _end_phase(sketch, misleading)),
        _run("batch-atomicity-and-abort", False, lambda: _atomicity_and_abort(sketch)),
        _run("reentry-and-cleanup-primary", True, lambda: _reentry_and_cleanup_primary(sketch)),
        _run("completed-transfer-and-idempotent-release", False, lambda: _completed_transfer(sketch)),
    ]
    failures = sum(not group["passed"] for group in groups)
    return {
        "passed": failures == 0,
        "profile": "drawing.fresh-raster-2d",
        "adapter": "Py5Frame JAVA2D",
        "scope": "registered native lifecycle group 5 using actual Py5Graphics; injected wrapper/factory faults only, not spontaneous JVM/device failure",
        "failures": failures,
        "groups": groups,
    }
