# Processing Android ANDROID2D adapter boundary

Independent Sol investigation, 2026-09-07. This proposes the first internal Processing
Android adapter for `drawing.fresh-raster-2d` v0.1.0. It is based on Android Mode 4.6.0,
release `android-412`, source commit
`363521a3d83982f540aeade89f3e5777de4226a5`, and the checked
`PGraphicsAndroid2D`, `PApplet`, `PGraphics` and `PImage` sources under
`.work/toolchains/android/processing-source-412`. It does not implement the adapter or
claim Android support. SDK, device/emulator and raster behavior still require native
validation.

## Backend identity and decisive differences

The Android compatibility token is surprising but intentional. In this core,
`PConstants.JAVA2D` is the string `processing.core.PGraphicsAndroid2D`; no class with that
name is required. `PApplet.makeGraphics()` special-cases that token and constructs the
actual `processing.a2d.PGraphicsAndroid2D`. Static preflight must therefore check the token
and the actual class separately. It must not try to load the compatibility string as a
class or substitute desktop `processing.awt.PGraphicsJava2D`.

ANDROID2D is not the desktop JAVA2D lifecycle with different drawing calls:

- Android `PGraphics.setParent()` only assigns the parent. It does not copy the parent's
  pixel density. A new `PGraphicsAndroid2D` inherits `PImage.pixelDensity == 1`, and
  `setSize()` computes matching logical and pixel dimensions. Android `PApplet` has no
  public `pixelDensity()` settings operation in this source. The owned offscreen surface
  is naturally density one; no parent-density mutation or desktop density repair belongs
  in this adapter.
- `PGraphicsAndroid2D.setSize()` records a pending resize but does not allocate its bitmap.
  Protected `checkCanvas()` creates or reconfigures an `ARGB_8888` `Bitmap`, creates the
  `Canvas`, clears the resize flag and performs renderer restoration bookkeeping.
- Offscreen `endDraw()` calls `loadPixels()`, so successful completion has both a live
  bitmap and a full `int[] pixels` snapshot. It does not dispose or detach the canvas.
- `PGraphicsAndroid2D.dispose()` recycles a non-null bitmap but does not call
  `PGraphics.dispose()`. It consequently leaves the bitmap field pointing at the recycled
  object and leaves the parent attached. Cleanup must detach these fields explicitly.
- `PApplet.onPause()` saves only the primary renderer. `PApplet.onDestroy()` disposes only
  the primary renderer. Neither lifecycle method owns adapter-created offscreen surfaces.
  Android integration must close those leases itself.

## Internal components

Use the existing Java `DrawingFrameState` and normalized slots unchanged. Native objects
remain in two Android-only internal components:

1. `Android2DFrame` owns one unfinished offscreen surface and implements
   `begin(environment)`, `batch(commands)`, `end()` and `abort()` with the same state and
   error results as the other adapters.
2. One `AndroidFrameHost` per sketch registers the Android lifecycle callbacks and tracks
   unfinished frame leases plus completed leases that integration has not released. It is
   an ownership coordinator, not a renderer-neutral scene, field or recipe executor.

`Android2DFrame` receives the explicit `PApplet` and its `AndroidFrameHost`. Do not look up
a global sketch. Production and test factories remain package-private. The portable core
never stores the applet, canvas, bitmap, surface or callback.

All frame methods run synchronously on the sketch animation thread captured by the host.
The host serializes its frame operations with lifecycle callbacks. A call from another
thread is host misuse and resolves through the portable state as `INVALID_STATE`; it must
not marshal drawing onto the UI thread. Batches remain capped at 4096 input records, so a
pause/destroy callback is not blocked behind unbounded adapter work.

This matters especially in a `noLoop()` sketch: Android `PApplet.postEvent()` dequeues
events immediately when the sketch is not looping, so key/touch callbacks may run off the
animation thread while the primary renderer is not inside `beginDraw()`. Such callbacks
may mutate only the plain artist model and call `redraw()`. They must not invoke this
adapter or draw. The resulting `draw()` callback performs the render on the animation
thread.

## Fresh allocation and readiness

Use a tiny adapter-owned subclass of `PGraphicsAndroid2D` only to expose a package-private
call to protected `checkCanvas()` and the protected primary flag. It must not override any
drawing, color, path, pixel or lifecycle behavior. Constructing this subclass directly is
acceptable only in the pinned adapter: inspected `PApplet.makeGraphics()` performs exactly
construction followed by `setParent(parent)`, `setPrimary(false)` and `setSize(width,
height)` for JAVA2D. Reproduce that sequence and document it beside the code. This avoids
reflection and preserves the contract's acquisition/readiness phase before `beginDraw()`.
It is not permission to accept or configure an arbitrary caller surface.

Static preflight requires the pinned Android core classes, the JAVA2D compatibility token,
an actual live Android `PApplet` whose primary renderer is `PGraphicsAndroid2D`, the
required `Bitmap`/`Canvas` APIs and all required drawing methods/constants. A configured
P2D/P3D sketch does not satisfy this first ANDROID2D profile. Static absence is
`UNSUPPORTED_CAPABILITY`. A paused, destroyed, unfinished or wrong-thread host is a runtime
lifecycle failure, not evidence that the backend is absent.

After the environment and static profile pass, create the owned subclass, attach the exact
parent, mark it non-primary and call `setSize()`. Do not assign `pixelDensity`; instead
require its fresh value to be one. A package-private injected factory must receive no
density, parent, size or backing repair, so fault tests can prove readiness rejection.

Call the exposed `checkCanvas()` as acquisition/readiness. Allocation errors, including
`Bitmap.createBitmap()` and memory failures, are `RESOURCE_FAILURE`. Then require:

- exact parent identity and `primaryGraphics == false`;
- exact logical width and height, `pixelDensity == 1`, and pixel dimensions equal to the
  logical dimensions;
- `surface.canvas` is the returned non-null canvas, with exact width and height;
- `(Bitmap) surface.getNative()` is non-null, mutable, not recycled, exact width/height and
  `Bitmap.Config.ARGB_8888`.

Any wrapper, parent, density, dimension, canvas or bitmap mismatch is
`RESOURCE_FAILURE`. Do not promise that every profile-sized bitmap will allocate on every
Android device. The profile's chosen 1 through 2048 dimensions are the admission policy;
actual target support requires all registered boundary allocations on each claimed native
host.

## Initialization and drawing

After readiness, call `beginDraw()`. On a fresh surface it reuses the checked bitmap and
canvas, applies default settings and resets the matrix. Then explicitly establish the
profile state: identity matrix, RGB color mode with four maxima of 255, `BLEND`, no tint,
and the opaque RGB background.

Do not blindly copy desktop `noClip()`. Android's implementation expands the clip with
deprecated `Region.Op.REPLACE`, whose behavior is API-dependent. A fresh bitmap canvas
already begins with its full bounds. After `beginDraw()` and `resetMatrix()`, verify with
`Canvas.getClipBounds(Rect)` that the clip is exactly `[0, 0, width, height]`; a mismatch is
`RENDER_FAILURE`. Native validation may permit calling `noClip()` only if the pinned SDK
and runtime prove it safe, but the contract requires the full clip result rather than that
particular call.

Any `RuntimeException` or `Error` from `beginDraw()`, state initialization, clip
verification or background is `RENDER_FAILURE` with a null command index. Preserve the
native cause as suppressed diagnostic evidence; a native exception that happens to be a
portable `FrameError` cannot choose its own phase.

`DrawingFrameState.prepareBatch()` remains the sole validator and binary32 normalizer.
After the complete batch succeeds, visit its immutable slots in encounter order and skip
converted no-ops. Pass RGB bytes and `opacity8` through the four-float `stroke()` or
`fill()` overloads under the established color mode; never use Android packed-color
overloads.

For `segment2`, issue `noFill()`, stroke color, normalized width, `ROUND` cap and one
independent `line()`. For `quad2`, issue `noStroke()`, fill color and one closed four-vertex
`POLYGON` path with `beginShape()`, four `vertex()` calls and `endShape(CLOSE)`. The pinned
renderer sends that path once to `Canvas.drawPath()`; do not split it into triangles or
join independent segments into a polyline.

A native command failure calls `failBatch(plan, sourceOffset)` so its index includes prior
batches and no-op input records. No batch count commits until all emitting slots succeed.
Android `Canvas` drawing is synchronous; this proposal does not invent a GPU/context-loss
signal. A lifecycle stop detected while a command phase is in progress resolves as
`RENDER_FAILURE`, with an index only if the host can identify the in-flight command.

## End, transfer and cleanup

`end()` calls offscreen `endDraw()`. Its `loadPixels()` allocation/copy is part of native
finalization, so failure is `RENDER_FAILURE` with a null command index and returns no
surface. On success, resolve the end token and atomically move the exact
`PGraphicsAndroid2D` from the frame into the host's completed-lease registry before
returning it. A concurrent pause/destroy must see the surface in either the unfinished or
completed registry, never neither.

Returning a tracked raw surface is not permission to use it directly. A UI-thread pause can
otherwise recycle the bitmap between `end()` and the caller's next statement. The only
supported access is
`AndroidFrameHost.consumeCompleted(surface, Consumer<PGraphicsAndroid2D>)`. It verifies
identity membership, the animation thread and the current lifecycle epoch under the same
ownership lock, marks the lease consuming, invokes one synchronous native display/save
action, and releases the surface in `finally`. If pause already won the lock, consumption
does not invoke the callback. If consumption won, pause waits until final release and can
never recycle the bitmap during the callback.

The callback's surface reference is valid only for its dynamic extent. It must not retain
the reference, call another frame/host operation or perform unrelated work. Reentrant
consume/release of a consuming lease is rejected. A callback exception is an integration
failure after the frame already completed; release it and propagate the native cause
without changing the completed portable state or inventing a profile `RENDER_FAILURE`.
`releaseCompleted(surface)` remains the idempotent route for discarding an output without
consuming it, and uses the same lock and identity registry.

The first CP1 example should call `consumeCompleted` for the synchronous draw into the
primary renderer inside the same setup/draw callback. A later save action can save the
already-drawn primary surface rather than retain the offscreen result. It must retain only
its plain field model across Android lifecycle events and rerender a new surface after
resume.

Release is identity-based and idempotent for adapter-produced leases. Before any
irreversible action, snapshot the native bitmap, then detach the surface from every owner
and clear:

- `surface.canvas`;
- `surface.pixels`;
- the protected bitmap through public `surface.setNative(null)`;
- the parent through `surface.setParent(null)`.

Only then recycle the captured bitmap if it is non-null and not already recycled. Calling
`surface.dispose()` after detachment is harmless but cannot replace these steps. Android
`Canvas` has no desktop-style `dispose()`; dropping its reference is the release. Attempt
all detach/recycle actions, attach cleanup failures to a synchronous primary error, and do
not publish an aborted or recycled surface. Calling release twice must not recycle twice.

## Pause, resume and destruction

The host registers one coordinator, rather than every transient frame, for public
`pause()`, `resume()`, `pre()`, `onDestroy()` and `dispose()` callbacks. This avoids
callback-list mutation and listener retention. `dispose()` is an idempotent fallback
because Android `PApplet.onDestroy()` calls registered `onDestroy` handlers before its
final `dispose()`.

At the start of `pause()`, mark the host non-accepting before waiting for an in-progress
frame call. Under the common ownership lock, abort and release every unfinished surface
and release every completed lease still held by integration. A method already drawing may
finish its current bounded native call, but it must check the host epoch before committing
or transferring; a pending pause prevents success. Do not preserve an active adapter
across pause. PApplet saves/restores only the primary renderer, so the portable model is
the authority for constructing a new frame after `resume()`. A completed-consumption
callback which already owns the lock may finish and release before pause proceeds; the
coordinator must not recycle its bitmap concurrently.

The registered `resume()` callback only marks `resumePending`: this pinned `PApplet`
invokes it before `g.restoreState()` and before restarting the animation thread. Reopen
from the coordinator's registered `pre()` callback instead. `handleDraw()` invokes `pre()`
on the animation thread after primary `g.beginDraw()` and only after any special
restoration-only frames have returned. The frame-zero `setup()` path skips `pre()` but is
already inside primary `beginDraw()`, so a host first constructed there starts accepting.

In a resumed `noLoop()` sketch, restoration may finish without an ordinary frame and hence
without `pre()`. Keep the host non-accepting. A key/touch handler updates plain state and
calls `redraw()`; the next ordinary frame reaches `pre()` before `draw()` and may then
accept a new frame. No adapter call is allowed directly from that event handler. Reopening
never resurrects an aborted frame or recycled bitmap. `onDestroy()` marks the host
permanently closed, aborts/releases all leases and prevents later begin. Lifecycle cleanup
callbacks must attempt every release and record diagnostics without throwing back through
Android's activity callback. Explicit synchronous abort/release may report a cleanup
exception after ownership has still been detached.

The coordinator may retain native objects only while they are real outstanding leases. It
must remove them on failure, explicit abort, successful integration release and destroy;
it retains no command batches or portable environment after resolution.

## Evidence required before support

Compile against the pinned Android Mode release and record source/core AAR or JAR, adapter,
portable core, fixture, SDK/build-tools, emulator image/device, ABI and Android API hashes.
The current SDK 33/build-tools 30.0.3 and API-33 emulator setup are infrastructure facts,
not conformance evidence by themselves. Software emulation is acceptable if its identity
and acceleration mode are recorded; it must not be represented as physical-device breadth.

Run the existing profile groups on actual `PGraphicsAndroid2D` pixels: all registered
surface sizes, bounds and binary32 edges, width limits, background opacity/RGB, clipping,
alpha/source-over order, both quad windings and single-fill seam check, segment cap/style
isolation, parent isolation and ordered batches. Record minimum-width coverage as an
observation only. Verify that the actual object class is `processing.a2d.PGraphicsAndroid2D`
despite the JAVA2D alias.

The lifecycle suite must additionally prove real bitmap ownership: fresh density one,
readiness failures without injected-surface repair, bitmap/canvas/pixel/parent detachment,
`Bitmap.isRecycled()`, batch atomicity and absolute indices, initialization/draw/end
failures, misleading host errors, reentry, cleanup failures, live completed transfer and
idempotent release. Exercise the end-to-consume race in both lock orders, reject
reentrant/foreign/released consumption, and prove callback failure still releases while
portable state stays completed. Injected failures must be labeled as such.

Exercise actual activity pause/resume and destroy separately. Hold an active frame across
pause and require abort/recycle; hold an unreleased completed lease and require lifecycle
release; require a new frame after resume; require destroy to close the host permanently.
Use synchronization/timeouts so this tests the ownership race rather than relying on
sleeps. Finally route and inspect all four CP1 edits and an actual editable Android example.

Until those checks pass and receive independent review, `processing-android` remains
`pure_validator_and_state_only` / `unvalidated`. This proposal does not claim arbitrary
Android devices, renderers, densities or lifecycle persistence, and it does not change the
portable profile or add a generic drawing DSL.
