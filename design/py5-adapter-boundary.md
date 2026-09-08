# py5 JAVA2D adapter boundary

Sol investigation, 2026-09-07. This defines the implementation boundary for the first
internal py5 adapter to `drawing.fresh-raster-2d` v0.1.0. It does not establish native
support, change the portable contract, or reuse the desktop Processing adapter as py5
evidence.

## Checked runtime

The checked environment is Python 3.13.15, py5 0.10.11a0, JPype1 1.7.1 and the repository
JDK 17.0.20.1. Import and API inspection used xvfb but allocated no drawing surface. The
installed runtime identities include:

- `py5/jars/core.jar` SHA-256
  `2cd02df8ace61c45af5eddef74dc74608b87a50155e83f20c7b1e28642ddbc85`;
- `py5/jars/py5.jar` SHA-256
  `4447b8098080f83cb4ffa5bf3b2d6c15a4a1bea3265198da75f5ac936f504903`;
- `py5/graphics.py` SHA-256
  `2761b2987666c7d1d70088c70aca9492dd4963abf644d8fa78ee0de9dc4c30f8`;
- `py5/sketch.py` SHA-256
  `39557b47939444710c6cd2480e8dfadc03eddc28c87106c3fb262d2d087a8639`.

The bundled `core.jar` is not the pinned Processing 4.5.6 desktop JAR and its manifest
does not identify a Processing release. The py5 result therefore needs its own native
suite and source binding.

The installed Python wrapper exposes `Sketch.create_graphics()`, `Py5Graphics.begin_draw()`
and `end_draw()`, logical `width`/`height`, and read-only `pixel_density`, `pixel_width` and
`pixel_height` properties. The required drawing methods are `reset_matrix`, `no_clip`,
`color_mode`, `blend_mode`, `no_tint`, `no_fill`, `stroke`, `stroke_weight`, `stroke_cap`,
`line`, `no_stroke`, `fill`, `begin_shape`, `vertex` and `end_shape`. The checked constants
are `JAVA2D`, `RGB`, `BLEND`, `ROUND` and `CLOSE`.

Two native details are decisive. `PGraphics.setParent()` copies the parent sketch's pixel
density, and `PApplet.createGraphics()` then calls `setSize()`. JAVA2D defers creation of
its `BufferedImage` until `PGraphicsJava2D.checkImage()` or `beginDraw()`. Also,
`Py5Graphics` exposes no public readiness or disposal API. Its `_instance` is consequently
a justified, pinned adapter dependency for exact renderer checks, the pre-initialization
readiness probe and complete cleanup. It must not escape this internal module.

JPype resolves `_instance.image` to `PGraphics.image(...)`, the overloaded drawing method,
rather than to the public `PGraphics.image` field. Read and clear the backing image through
`PGraphics.class_.getField("image").get()` and `.set()`; this uses the public inherited
field and needs no accessibility override. Direct attribute access both misdiagnoses a
ready surface and prevents complete cleanup.

## Internal interface and allocation

Use one internal `Py5Frame(sketch, *, _factory=None)` beside the existing Python drawing
state. Production callers pass the explicit current sketch:

```python
frame = Py5Frame(py5.get_current_sketch())
```

Class-mode callers may pass their `Sketch` instance. Do not read an implicit global sketch
inside the portable state. `_factory` is an internal native-fault seam, not a generic
surface-provider API and not a public executor.

`begin()` first calls `FrameState.prepare_begin()`. Static preflight then requires the
installed py5/JPype classes, an actual py5 `Sketch`, callable `create_graphics`, and the
exact JAVA2D renderer constant. Missing static machinery is `UNSUPPORTED_CAPABILITY`.
Current sketch lifecycle or allocation failure is not static absence; a failed
`create_graphics()` call is `RESOURCE_FAILURE`.

Production allocation calls
`sketch.create_graphics(width, height, sketch.JAVA2D)` and immediately retains the returned
wrapper as the adapter's exclusive lease. The result must be an actual `Py5Graphics`, its
native `_instance` must be a `processing.awt.PGraphicsJava2D`, and the native parent must
be the supplied sketch instance.

The profile requires an owned density-one target even when the parent sketch uses density
two. On this newly created production surface only, before `checkImage()`, `begin_draw()`
or any caller exposure, set native `pixelDensity` to one and repeat native `setSize(width,
height)` so `pixelWidth` and `pixelHeight` are recomputed. This is safe for the checked
JAVA2D implementation because no backing image exists yet. It is not permission to mutate
arbitrary caller surfaces. A value returned by `_factory` must receive no density or size
repair; this keeps injected readiness failures observable.

Call native `checkImage()` as the acquisition/readiness probe and always dispose the
returned temporary `Graphics2D`. Then require exact logical dimensions, density one, pixel
dimensions equal to logical dimensions, a non-null native image, and matching image
dimensions. Obtain that image through the checked public-field accessor above. A wrapper,
renderer, parent, density, backing or probe mismatch is
`RESOURCE_FAILURE`. This mirrors the desktop phase boundary while proving the behavior of
py5's separately bundled core.

## Initialization and drawing

After readiness, call `begin_draw()` explicitly. Do not use its context-manager form:
automatic `end_draw()` during an exception would finalize a failed frame and blur the
ownership/error boundary. Initialization then calls `reset_matrix()`, `no_clip()`,
`color_mode(RGB, 255, 255, 255, 255)`, `blend_mode(BLEND)`, `no_tint()` and the three-channel
opaque background. Any exception from this phase is `RENDER_FAILURE` with a null command
index.

`FrameState.prepare_batch()` remains the only command validator and binary32 normalizer.
Do not route through `DrawingValues` or the Java `Java2DFrame`; doing so would validate a
second time under different Java carrier rules and would fail to test the Python/JVM
bridge. The adapter consumes the immutable Python slots directly, skips slots whose
outcome is `noop`, and invokes py5 in encounter order.

For a segment, set no fill, pass the exact normalized byte channels and `opacity8` as
four Python floats to `stroke`, then set the already-normalized width, `ROUND` cap and one
independent `line`. For a quad, set no stroke, pass the same channel/opacity values to
`fill`, and issue one `begin_shape` / four `vertex` / `end_shape(CLOSE)` path. Do not use
two triangles. The established RGBA color mode makes py5 interpret the alpha byte as
`opacity8 / 255`; no packed signed color or host color mode enters portable data.

Each native command exception resolves through `FrameState.fail_batch(plan,
source_offset)`, preserving the original absolute input index across preceding no-ops.
Only after all emitting slots succeed may `commit_batch()` advance the count. JAVA2D has
no asynchronous context-loss surface analogous to Canvas2D; do not invent one.

## Exceptions, completion and cleanup

Every Python or JPype `Exception` thrown by an acquisition, initialization, command or end
operation must resolve through the matching state phase. Never rethrow a native
`FrameError` merely because its type looks portable: a host/test callback can throw a
misleading code or index. If a callback reenters the frame, the nested transition has
already aborted it and the phase resolver correctly produces `INVALID_STATE`.

`KeyboardInterrupt`, `SystemExit` and other non-`Exception` `BaseException` values are not
native render failures. The outer boundary must still abort and release the unfinished
lease, then rethrow them unchanged. Use exception chaining for the native cause. Cleanup
exceptions may be retained as non-normative notes, but must not replace the stable primary
`FrameError`.

On failure or explicit abort, detach the wrapper from the adapter before cleanup. From its
native instance, snapshot `g2` directly and the backing image through the public-field
accessor, then clear native `g2`, public-field `image` and `pixels` before attempting
`Graphics2D.dispose()`, `Image.flush()` and native `dispose()`. Clearing first makes repeated
cleanup safe even if a native action throws. Also clear py5's optional
`_np_pixels`, `_java_bb` and `_py_bb` caches so a retained wrapper cannot keep its NumPy or
direct-buffer views. Attempt every cleanup action and release exactly once.

Successful `end()` calls `end_draw()`, resolves the end token, detaches the wrapper from
the adapter and returns that exact live `Py5Graphics` to integration. A failed `end_draw()`
is `RENDER_FAILURE`, releases the lease and returns no surface. Later adapter end or abort
must leave a completed surface untouched. `release_completed()` is the single idempotent
integration cleanup route after display/save; it performs the same native and Python-cache
detachment. Its contract applies only to a surface returned by this adapter.

## Artist example path

Keep the field model in `packages/python/examples/field_marks/mark_field.py` independent of
py5. It imports the public Python `regular_grid`, `gradient_noise_2d_01` and
`cyclic_palette` operations, retains the five field attributes once, and yields plain
segment or quad dictionaries. A neighboring py5 sketch is the host entry point:

1. create the retained field once in `setup()`;
2. construct `Py5Frame(py5.get_current_sketch())` and begin a 640 by 640 density-one owned
   frame;
3. collect the generator into ordinary list batches of at most 4096 records and call
   `batch()` synchronously;
4. call `end()`, immediately display the returned graphics with py5 or save it through the
   integration, and call `release_completed()` in `finally`;
5. use the same retained field for the length, palette and segment-to-bar edits.

The adapter must run on the sketch thread and must not marshal work to another thread.
The example should use explicit `import py5` module mode so the current-sketch dependency
and output transfer remain visible. Its pure composition code must not import py5 or touch
`Py5Graphics`.

## Evidence required before support

Native validation must bind the adapter, Python state/validator, example, harness, py5 and
JPype metadata, both py5/core JARs, JDK, Python, platform and xvfb identities. Include a
density-two parent case that proves the fresh output is density one without changing the
parent. Re-run the registered geometry, clipping, color/alpha/order, winding, cap/style and
parent-isolation groups against actual `Py5Graphics` pixels.

Lifecycle cases must cover static absence, allocation, wrong wrapper/native renderer,
wrong parent, density/dimensions/backing mismatch, readiness-probe failure, initialization,
draw and `end_draw` failures, invalid-batch atomicity, absolute indices after no-ops,
reentry, misleading native `FrameError` values, cleanup exceptions, explicit abort,
still-live transfer through later adapter misuse, and idempotent release including cleared
NumPy/direct-buffer caches. CP1 then needs the four preregistered edits, retained-model and
converted-geometry/color comparisons, changed-pixel checks and root inspection.

Until those checks pass, this is an implementation boundary only. It does not support an
arbitrary Py5Graphics supplied by a caller, other renderers, other py5/bundled-core versions,
headless JVMs, cross-host pixel identity, or full-corpus reproduction.

The first registered native pixel execution exposed the JPype field collision above. Its
documented corrective execution passed all four pixel groups against the corrected adapter,
including six backing sizes and a density-one child created from an actual density-two
parent. The test JVM used `-Dsun.java2d.uiScale=2`; installed `ShimAWT` derives display
density from the AWT graphics transform, and the driver required both parent density two
and a 64 by 48 physical backing for its 32 by 24 sketch before any group ran. This is
forced AWT/Xvfb density-two evidence, not a claim about untested physical HiDPI hosts.
Lifecycle fault injection and CP1 acceptance remain separate gates.
