# Android redraw integration finding

The actual lifecycle validation has exposed an integration failure in the pinned
Processing Android 4.6.0 / android-412 fragment path. This is not an inference from
Java desktop behavior: the corrective native journal records one real UI-thread touch,
eight restoration-only frames, and zero ordinary pre/draw callbacks after restoration.
The first active lease was released correctly. The remaining lifecycle sequence did not
complete and Android support remains unvalidated.

Evidence is preserved in `android-adapter-lifecycle-{initial,corrective}.json` under
`evidence/conformance/`. The initial failure was a runner diagnostic-field mismatch.
The corrective run used the corrected focused-window gate, resumed the same instance,
and observed restoration idle. Root dismissed the system fullscreen help overlay while
the gate withheld the test input. The subsequent actual test touch reached the helper;
no ordinary drawing followed. Root ended the stalled run using the existing explicit
finish receiver for diagnostic collection. Missing later-stage assertions are therefore
expected termination evidence, not a passed lifecycle sequence.

Pinned source revision `363521a3d83982f540aeade89f3e5777de4226a5` explains the result:

- `processing/android/PFragment.java:258`: `canDraw()` requires `sketch.isLooping()`.
- `processing/core/PSurfaceNone.java:474`: `callDraw()` calls `handleDraw()` only when
  the component permits drawing.
- `processing/core/PApplet.java:1858`: the actual noLoop/redraw decision is inside
  `handleDraw()`; `redraw()` sets a separate flag under the sketch monitor at line1969.

Thus requesting redraw while noLoop is active never reaches its own dispatch guard.
The public Java core, Android frame ownership state and native drawing code are unchanged.
The failed boundary is the fragment scheduling integration assumed by the test app.

Root's proposed correction is a small internal Android2D fragment integration that lets
PApplet apply its own noLoop/redraw guard. A brief sketch-monitor acquisition in canDraw
would also pair with synchronized redraw/noLoop updates; it must not hold that monitor
through native drawing. The existing animation thread already polls at its frame interval,
so this does not require continuous drawing or a new executor. Sol is independently
challenging this proposal before implementation. It is not yet an accepted support route.

The original lifecycle initial and corrective allowances are consumed. Do not overwrite
the evidence or run another copy of the unchanged protocol. A reviewed scheduling change
needs an explicit revised registration that preserves the failures, holds native
assertions constant, adds idle/redraw scheduling checks, and binds the new integration.
No existing passing pixel or injected-failure part should be repeated for that change.

## Root decision after independent challenge

Sol accepts the fragment correction and rejects toggling loop/noLoop in every input
handler. Root adopts `Android2DFragment`, now implemented as an internal carrier. It
acquires/releases the sketch monitor only in `canDraw`, then allows PApplet's existing
guard to decide whether any native drawing is due. Pause still blocks in the surface
thread before dispatch, and destroy still stops that thread. The proposed behavior
requires native validation before use in a supported example.

The alternative would interfere with Processing's own restoration loop/noLoop protocol,
spread scheduling state into sketches, and require exception-safe handling of multiple
input requests. No new public artistic operation or parameter is introduced. The next
protocol revision must prove idle noLoop does not produce extra ordinary frames, a real
input produces exactly one pre/draw, and all prior lifecycle/ownership assertions still
hold with this required carrier. Existing plain-PFragment failure evidence remains valid.
