# Physics evidence audit: `araniaaas` target force and nearby motion loops

This is a bounded source-and-note audit for a possible artist capability. It does not
admit an operation, propose an API, recommend a numeric range, or change a candidate
record. Upstream source is inspected only as MIT-licensed provenance; no source code is
copied by this audit. Root's separate source-motion diagnostic stages the original
Point tab under `.work` with its upstream MIT notice.

## Evidence identity

The primary normalized candidate is
`2018/Generativos/araniaaas#1`, `springDrift(initPos, spring=0.025,
decay=0.64-0.72) -> PVector`. Its source report is
[`survey/out/2018/Generativos/araniaaas/notes.md`](../../survey/out/2018/Generativos/araniaaas/notes.md)
(SHA-256 `a755a2a70f81ad86042bd7ec6eeb91ca1832e6858350bf06de1b92b1466f4b11`).

I inspected the local pinned `AllSketchs` revision
`69bdd8513e4482a5e6018e36887d4bc208660eb5`:

| source path | SHA-256 | use in this audit |
| --- | --- | --- |
| `2018/Generativos/araniaaas/Point.pde` | `c02cc6b70f4ccd8d539f9fb1210c3dfe79108eea4f7ac537c03b5672f6e8f298` | state and update ordering |
| `2018/Generativos/araniaaas/araniaaas.pde` | `dab59d3ef2549fa0bfdb8409a5364ad087c8ffc7b17e48c12b72d782844ff5ec` | lifecycle, topology, input, and rendering context |

I also read three related checked-in reports with actual stateful motion rather than
using a broad `physics` tag:

| report and candidate identities | note SHA-256 | inspected source / SHA-256 | why it is a neighbour |
| --- | --- | --- | --- |
| `2018/Generativos/persons06#0` `gridPersons`; `#1` `capsulePerson` | `f2beb3cdc33f72f9e9e97a41b81f961d031bdd5f950f1a662d6068d36946f8d0` | `2018/Generativos/persons06/Person.pde` / `6a6eec13b586a633d1682e065d1dab035b2228d7bf6053d509d73045c647aa2f`; `persons06.pde` / `308a2d84d8fca852620a3d4b4fd0f9babf1f47bf6d3a2193690e299bfd2cd0c0` | target replacement plus bounded kinematic arrival |
| `2018/Generativos/peces#0` `flowFieldAngle`; `#1` `taperedTrail`; `#2` `cyclingPalette` | `8835b9a8c945c38690400846116d0a55adea3d6362ca5068a5d9321941f5ab62` | `2018/Generativos/peces/peces.pde` / `5c1d127514452b57267ea2ff2a07803dedcee5a31256eeeea5910cc76c4540f8` | persistent agents advanced through a field |
| `2014/Generativos/degradefeo#0` `fallingColumn`; `#1` `twoAxisLerpRamp` | `d3c8f9aa72780380e59eca82191566dfb5e4df7d8273698a80097bb55b83f9b0` | `2014/Generativos/degradefeo/degradefeo.pde` / `ef06b807d0c8534d35e92f45642b726ae3a477d9948c6e9121afa8720ee4c86c` | persistent discrete position, wrap, and an independently evolving scalar |

## What `araniaaas` actually retains and updates

`Point` retains `ini`, `acr`, `pos`, `tgt`, `vel`, `acc`, and `decay` (source lines
3--6). `acr` is initialized but never read after construction. `ini` and `tgt` are
copies of the supplied spawn vector; `pos` is the supplied vector itself (lines 8--18).
The global `vertex` list receives that same spawn vector in `generate()` (main source
lines 137--145), so point position is mutable state shared with the geometry input.
Each point receives a fixed per-instance decay from the random expression at construction
(source line 17); it is not redrawn in `update()`.

Per `draw()` call, after clearing the background, the sketch resets Processing's random
stream to `seed` (main lines 16--24) and updates every point. The source's update order is:

1. move `tgt` four percent toward `ini` (`tgt.lerp(ini, .04)`, `Point.pde:22`);
2. create a mouse vector and measure distance from the *current position* (`:23--24`);
3. only when that distance is below 360, move `tgt` toward the mouse by
   `pow(map(distance, 0, 360, .4, 0), 1.6)` (`:26--29`);
4. compute `acc = (tgt - pos) * .025`, add it to velocity, add that updated velocity to
   position, then multiply velocity by the fixed decay (`:32--37`).

This is a per-frame, no-`dt` semi-implicit force/velocity update: damping happens after
position advancement. It has neither collisions nor point-to-point springs, mass, a
rest-length, force accumulation from neighbours, nor a solver iteration. The force is a
single target attraction plus an optional global-pointer perturbation.

Most importantly, source initialization has `pos == ini == tgt` in value and `vel == 0`.
Without a mouse-induced target change, every step remains at that equilibrium: zero
acceleration, zero velocity, and unchanged position. The note's phrase “organic slow
drift” and its statement that drift is visible between frames 1 and 60 are therefore not
supported as autonomous motion. A default Processing mouse location can still attract
sites sufficiently near it, including sites outside the canvas because spawning uses the
extended bounds; that is input-dependent behavior, not a self-starting oscillator.

`mousePressed()` adds one point and recomputes the triangulation (main lines 117--131).
`generate()` also constructs it once (lines 133--149). There is no triangulation call in
`draw()`: subsequent state updates reuse the returned Triangle objects from setup or
click time. The sketch intends those triangles to reference its moving position vectors;
this audit has not verified that aliasing in the imported triangulation library.
The intended result is a deformation
of a fixed triangulation, not a continuously recomputed Delaunay mesh. This distinction is
material to any future retained-state or topology claim.

## Rendering and timing dependence

The update is inseparable in this sketch from P2D redraw and the Delaunay-web renderer:
`draw()` clears the frame, moves points, then uses the stored `Triangle` references to
shade and overlay the web. Randomness after the update is reset every frame and consumed
by `amp1`, `amp2`, palette selection, and triangle rendering (main lines 19 and 29--71),
while point decay was consumed at construction. Thus the source offers deterministic
state evolution only relative to the initial generated state, frame-update count, and the
mouse-event sequence; it does not use wall-clock time. Keyboard input regenerates except
for save; mouse input both changes targets indirectly and can add a topology-changing site.

The only reported substitutions are point count, web inset amplitudes, palette, gradient
white level, and spawn margin. The note reports no controlled substitution of spring
coefficient, decay, return lerp, pointer radius, or update cadence. Its proposed
`spring=0.025`, `decay=0.64--0.72`, and `returnLerp=0.04` are source-derived shorthand,
not independently measured controls. In particular, the moderate/large effects in the
report concern the web, triangle density, palette, and edge coverage rather than this
motion loop.

## Related motion mechanisms: support and boundaries

### `persons06`: target seeking without a velocity state

The nearby `Person` class initializes `position` and `newPosition` equal. On each update,
it chooses a fresh random target only if it is already within one unit and a 3% random
gate passes; otherwise it takes the target-minus-position vector, caps its magnitude at
0.3, and adds it directly to position (`Person.pde:60--74`). This is target replacement
and bounded kinematic arrival, not acceleration, inertia, or damping. Its global
`millis()` time drives limb poses (`persons06.pde:26--46`) and random calls occur during
updates, making its observed state time- and stream-dependent.

The report calls the class an `update(dt)` candidate, but the inspected source declares
`update()` with no `dt`; the note is therefore not an exact source interface. Its measured
changes concern grid density, person count, body proportion, and arm-speed capture at
frame 1; none isolates target-motion behavior. It corroborates that an artist may want a
retained moving target, while contradicting any inference that it supplies spring
semantics or a timestep contract.

### `peces`: field-advection agents with lifetime, not a spring

`Fish` retains head coordinates, size, fixed speed, elapsed lifetime, color phases, an
amplitude envelope, and rebuilt spine lists. It advances logical time by `1/60`, samples
a noise heading at its head, then advances directly by `cos/sin(direction) * velocity`
(`peces.pde:84--121`). It builds a backwards field-following spine for rendering and
removes itself after its sampled lifetime. A new fish is spawned every draw call and a
shader filter is applied without clearing the framebuffer (main lines 15--30).

This is a useful counterexample: it is persistent particle state, but no velocity update
or restorative force exists. The report's five sweeps all register no visible difference
at its promoted frame-10 observation because fish are still in their fade-in and the
accumulation has barely begun. They cannot establish useful values for motion speed,
lifetime, field scale, or body width. Mouse press also injects a fish, so its lifecycle is
not a pure fixed-frame process.

### `degradefeo`: discrete falling state and wrap

Each `Coso` stores integer `x`, `y`, and step width, plus color scalar `val` and increment
`inc`. Every one of 500 inner updates per draw increments `y`, adds `inc` to `val`,
multiplies `inc` by 1.08, resets color state when `val` reaches 256, and on vertical wrap
resets `y`, advances `x` by the stored step, then resamples that step
(`degradefeo.pde:14--52`). It has no vector force or spring. Its animation speed is the
hard-coded inner-loop count, and the drawing call mutates accumulated pixels directly.

The note's `stepsPerFrame` test only exposes a short first-frame trace; its larger
horizontal-shift range affects later wraps and was pixel-identical at frame 1. These are
explicit timing confounds, not measurements of a generalized physics law.

## Evidence boundary and unresolved facts

- The primary record establishes a **single-target, input-conditioned damped velocity
  integrator**, including precise source update order. It does not establish autonomous
  drift, inter-particle forces, or a dynamic Delaunay update.
- The three neighbours establish separate stateful patterns—bounded target seeking,
  field advection/lifetime, and discrete falling/wrap. They do not independently repeat
  the `araniaaas` force-plus-velocity computation. Similar visual motion is insufficient
  evidence to merge those state machines.
- Actual behavior depends on host input, `draw()` call count, Processing vector methods,
  mouse defaults/events, the external triangulation library's retained-point behavior,
  P2D redraw, and random-stream placement. The notes do not provide event traces,
  decay/spring sweeps, different frame-rate measurements, source-library mutation
  guarantees, or cross-renderer evidence.
- The araniaaas candidate remains a source-backed observation with a contradiction in its
  report prose: its stated autonomous “organic slow drift” is false for the initialized
  no-input state. The source shows a pointer-responsive deformation loop instead.
