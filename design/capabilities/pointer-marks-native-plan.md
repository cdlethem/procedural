# PointerMarks native draft plan

Status: prepared for root review. This file authorizes neither a native execution nor an
acceptance claim. It describes one bounded JAVA2D probe for the repository-only
`PointerMarks.pde` draft.

The probe builds a candidate Java JAR from the checkout, officially preprocesses the PDE, and
compiles the generated sketch with the probe. `RegularGrid`, `TargetSprings2D`, and
`Delaunay2D` must all load from that candidate JAR. The runtime must be JAVA2D, 640 by 640,
at density 1.

The deterministic portion begins paused. The probe directly calls the PDE's `mousePressed()`
after setting its mouse fields to `(400,320)`, then directly invokes `stepWithInput(true,400,320)`
24 times. It records target and spring snapshots and dots pixels. It posts **M** to transfer to
the fixed wire, checking that targets, motion, tick, and mesh identity do not change. It posts
**M** again, directly calls the PDE's `mouseReleased()`, and directly invokes the same method
with `held=false` 24 times. It posts **0**, then replays those exact 24 held and 24 released
calls to require equal snapshots and corresponding dots pixels. These direct calls are the
probe's finite scripted input stream; PointerMarks itself records no input history.

The probe verifies that fixed edges retain the initial mesh object and use each edge vertex's
`sourceIndexAt` mapping back to a valid original body. It does not assert a current Delaunay
mesh or non-crossing geometry.

Separately, the probe posts **Space** to start the actual continuously serviced display-loop path. It observes at least
three running draw callbacks, each advancing exactly one tick, posts **Space** to pause, and
checks the subsequent dirty paused draw does not advance. Clean paused callbacks return
before drawing or stepping. It does not assert a wall-clock-derived or
exact running-frame count. It posts **S** only after that paused frame and compares the cached
image to the saved PNG without an additional draw.

Posted keys are M, M, 0, Space, Space, and S. Mouse press/release and all scripted
`stepWithInput` calls are direct callbacks/method calls as described above. The planned report
records the eight bounded frame IDs, actual running-draw count, candidate-JAR origins, and
pixel/snapshot checks. It is not a distribution, port-support, recreation, or release claim.
