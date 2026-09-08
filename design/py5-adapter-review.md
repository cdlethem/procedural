# py5 JAVA2D adapter review

Independent Sol review, 2026-09-07. Accept the py5 target for
`drawing.fresh-raster-2d` v0.1.0 as **validated-scoped** on the recorded py5 0.10.11a0,
Python 3.13.15, bundled core and JDK 17.0.20.1 runtime. This review covers the internal
`Py5Frame` adapter, portable Python validator/state integration, owned-surface transfer and
the CP1 field-marks route. It is not a claim about other py5 or Processing versions,
renderers, physical HiDPI hosts, cross-host pixels or the full corpus.

## Boundary findings

The adapter keeps validation and lifecycle state in Python and uses py5 only after a whole
batch has normalized. It does not route commands through the desktop Java adapter, retain
renderer objects in portable state or expose a generic executor. Production allocation
uses the supplied sketch's explicit JAVA2D `create_graphics`, requires an exact
`Py5Graphics`/`PGraphicsJava2D` pair and parent identity, and modifies density only on that
fresh owned allocation. Integration-supplied test surfaces receive no repair and are
rejected on density or parent mismatch.

Installed `PGraphics.setParent()` copies parent density, while JAVA2D defers its backing
allocation through `checkImage()`. The passed native suite demonstrates that a child which
initially inherits density two is reconfigured to a density-one logical and physical
backing without changing its parent. The test forces a two-times AWT transform under xvfb
and verifies the actual parent density and 64 by 48 physical backing before running; it is
valid evidence for this adapter path, not evidence for untested physical HiDPI systems.

The first pixel execution correctly remained preserved as failed evidence. It found that
JPype resolves `raw.image` to Processing's overloaded drawing method instead of the public
backing-image field. The repair consistently reads and clears the sole inherited public
`PGraphics.image` field through Java `Field.get/set`, without an accessibility override.
The current adapter source is the corrected source bound by every passed native part.

Drawing uses the normalized slot values directly, independent segment calls and a single
four-vertex closed quad. Initialization explicitly resets transform, clip, color/blend,
tint and background. Phase catches resolve allocation/readiness as `RESOURCE_FAILURE` and
initialization, command and end failures as `RENDER_FAILURE`; misleading host `FrameError`
values cannot override the phase or absolute command index. Successful end transfers the
exact live wrapper. Failure, abort and explicit completed-output release detach Java
context/image/pixel fields and py5 NumPy/direct-buffer caches before cleanup attempts.

## Evidence reviewed

- `evidence/conformance/py5-adapter-pixels.json` passes all four registered native pixel
  groups on the corrected source. It covers six rectangular/extreme backing sizes, bounds
  and clipping, minimum-width observation, alpha, winding, encounter order, caps/style and
  parent isolation. The observed minimum-width coverage remains an observation rather than
  a portable pixel guarantee.
- `evidence/conformance/py5-adapter-failures.json` passes 15 lifecycle cases using actual
  `Py5Graphics` resources. It covers validation/static precedence, missing static
  capability, allocation and readiness, un-repaired density/parent mismatch,
  initialization, draw and finalization, misleading phase errors, batch atomicity,
  absolute indexing after a converted no-op, reentry, cleanup failure preservation,
  active abort, live transfer and idempotent release. Injected faults establish handling
  of those phases; they do not claim a spontaneous JVM or device failure occurred.
- `evidence/conformance/py5-adapter-interruption.json` passes the focused Python supplement:
  the exact injected `KeyboardInterrupt` object propagates unchanged while state aborts,
  count remains zero and the actual Java/Python backing is cleared.
- `evidence/conformance/py5-adapter-cp1.json` passes four 25,600-command field-mark cases.
  Their retained-model, converted-geometry and color hashes exactly match the accepted Java
  cases; all outputs are opaque and nonempty, and each registered edit changes pixels.
  Root's visual acceptance is recorded in `design/py5-cp1-decision.md`.
- `evidence/conformance/py5-adapter-ui.json` executes the actual example setup and the L,
  P, B and S key-handler routes. Each displayed RGBA hash matches its CP1 case and the saved
  PNG matches the visible bar result. The harness drives handlers programmatically, so it
  does not claim physical-keyboard or human-usability evidence.

All passed parts bind the same current `_py5_frame.py` SHA-256,
`a889782c5556d7669dba9fe19131226f8a368cc42bbd9224005fc87a37a13295`, and the
recorded py5 wrappers, bundled JARs, portable Python code and profile. Later additive
runner support changes do not alter the adapter/example sources bound by the earlier
parts.

## Decision

No remaining blocker was found for the recorded py5 JAVA2D scope. The catalog may mark
this target `native_adapter_implemented` and `validated-scoped` once its evidence list and
native-review record are checked for freshness. Arbitrary caller-owned `Py5Graphics`,
other renderers or runtime versions, physical display scaling, asynchronous/device loss,
cross-host raster identity and broader corpus reproduction remain outside this acceptance.
