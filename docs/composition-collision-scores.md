# Collision Scores (brief 49)

Status: **implemented on branch `w3/collision-scores`, unreleased.** Instrument `collision-scores`; guide
`packages/instruments/guides/collision-scores.md`. Code (all in `packages/instruments/src/`):
`composition/collision-walls.ts` (wall elements, exact times of impact), `collision-solver.ts` (one frame,
laws, tie order), `collision-containers.ts` (bundled containers, barriers), `collision-room.ts` (room
resolution), `collision.ts` (the `Simulation`, cache, `CollisionScore`), `collision-draw.ts`
(recipe, five treatments), `adapters/collision-scores-instrument.ts` (controls). Tests:
`tests/composition-collision-scores.test.ts`.

## What it makes, and the F7 contract

Disc bodies move in a bounded planar container (rectangle, ellipse, diamond, L-room, box-with-island; pins or
slats; any `PlanarShape` from the direct API) with elastic-or-lossy wall and disc contacts. It runs through the
stateful-snapshot foundation ([composition-snapshots.md](composition-snapshots.md)) and builds no stepping,
caching or cancellation layer of its own:

| F7 item | Here |
|---|---|
| `Simulation` state | born count, next birth step, log length, typed arrays `x y vx vy r m` (body `k` at index `k`) and the records of the last step |
| Projection (history) | per step: born count, positions, and the packed contact records of that step (`EVENT_STRIDE` = 20 numbers each: kind, bodies, time, point, normal, impulse, approach, velocities before and after, radius, mass) |
| Ids | `body:k` birth counter; `contact:n` in log order; `wall:n`, `corner:n`, `post:n` for static elements; per-body draws from `ctx.stream("body:k", purpose)` (size, placement, launch) |
| Cache key | `collisionModel` (container rings, posts, bodies, emitter, physics), seed, steps; **never** palette, marks, window, colours. Fields an emitter mode ignores are zeroed in the model and the seed is 0 when nothing is drawn from it, so an unused control or seed shares the snapshot |
| Retention | `checkpointEvery` 100, `historyEvery` 1 (fixed, part of the key) |
| Score | `collisionScore(snaps)` builds the frozen `CollisionScore` once per snapshot object (`WeakMap`): bodies, trails (a vertex at every whole frame and every contact, so bounces are exact corners), contacts, `maxImpulse`, walls |

## The model (2D, not physical accuracy)

Time is in frames (one simulation step). At the start of a frame gravity adds one velocity kick. Inside the
frame the earliest contact of any disc with a wall segment, reflex corner (a radius-0 round), post or another disc is
found **exactly** (a linear or quadratic solution), all discs fly to that instant, the contact is resolved and
the search repeats. Candidate pairs come from a `PointGrid` (rebuilt when the speed bound is exceeded) and
wall elements from a per-frame cell list, so cost is not all-pairs.

- **Tunnelling / overlap policy.** No tunnelling at any speed; positions come only from exact flight times, nothing
  is pushed apart. A disc must be placed clear of walls and other discs (gap 0.5), otherwise setup throws naming the
  control. A contact counts only while the approach speed exceeds 1e-9.
- **Simultaneous contacts.** Contacts within 1e-9 frames are resolved one at a time: walls before discs, then by lower
  disc number, then by higher disc number or lower wall-element index. Each resolution changes velocities before the next
  search. This is a sequential-impulse convention, not a physical claim.
- **Disc law.** Approach `u = (v₁ − v₂)·n`, `J = (1 + e) u / (1/m₁ + 1/m₂)`, `v₁ −= J/m₁ n`, `v₂ += J/m₂ n`; tangential
  velocities untouched (no spin). Momentum is conserved; kinetic energy too for `e = 1`.
- **Wall law.** `v += (1 + e) u n`, then Coulomb friction removes `min(μ(1 + e)u, |v_t|)` of the tangential speed. For
  `e = 1`, `μ = 0` the angle of reflection equals the angle of incidence.
- **Energy.** `e = 1` without gravity conserves total kinetic energy to rounding (tested to 1e-9 relative over a 500-step
  scatter, equal and area masses). Gravity is a kick per step (semi-implicit): not conservative. `e < 1` contacts with
  approach speed below `max(0.02, 2|g|)` are perfectly inelastic, so a lossy disc settles; resting contact under gravity is
  resolved but **not logged** (otherwise a pile logs a micro-impulse per body per frame).
- **Launch.** `heading ± headingSpread` degrees, speed `speed (1 ± speedSpread)`; ring headings are measured from the outward
  direction. Nozzle births happen at the start of a step, one per `Release every` steps, only when the spot is free.
  Nothing is dropped; a blocked nozzle waits.
- **Line and ring.** Disc `k` has a fixed site (evenly along the line, or around the ring). At step 0 and at the start of each later step
  (at most 8 births a step) discs are born in serial order while the next site is free, stopping at the first that is not. A line or ring too
  small for all discs at once therefore releases them one after another; sites are fitted to the room first (see Bounds).

## Bounds, and the slider-ends rule

Every numeric control at its slider minimum and maximum, alone and all together (also over each emitter), validates and draws; a test
iterates them, and every select option and combination of container, barriers, emitter and mass draws at the defaults.

Refused, naming the control: Bodies ≤ 96, steps ≤ 3000, wall elements (edges + corners + posts) ≤ 4000, radius ≤ 60, speed ≤ 40, and
a room in which no disc of the largest radius has any clear place.

Never refused, fitted or deferred instead:
- **Emitter places.** Line, ring and nozzle places are fitted by `snapToClear` (`collision-walls.ts`): a place clear of every wall element
  by `radius × (1 + spread) + 0.5` stays exactly; any other moves to the nearest clear cell centre of a 96 × 96 grid over the container's
  bounding box (ties to the first cell in row order). The grid is built only when a place needs it (at most 9,216 cells, each an
  even-odd scan of the edges), once per model.
- **Crowding.** Line, ring and scatter discs that cannot be placed are born later in serial order, at most 8 births and a bounded number
  of scatter tries a step. Nothing is dropped; a disc that never leaves keeps the rest unborn.
- **Recording end.** The log holds at most 30,000 records (checked after each step, so it may exceed that by one frame's contacts), and a
  frame may resolve at most 32 + 8·bodies contacts and 2000 + 1200·bodies work units. At the first step where the log is full
  (`stopReason "log-full"`) or a frame exceeds its bound (`"frame-limit"`: the frame is discarded whole, bodies stay where it found them,
  its contacts are not logged), the recording ends: later steps change nothing and `CollisionScore.stoppedAt`/`stopReason` say when and why.
  Prefix and replay hold (a longer run has the same log). This is the model's explicit termination.

## Treatments (all read one `CollisionScore`)

Trails through `pathMaterial` (ink, stitch, beads) or the extracted dry-bristle material (`bristleMaterial`); marks at
contacts through `motif` (turned to the normal, size `floor + (1 − floor)√(J/Jmax)`); reflected and arrived-from rays and
graph edges through `pathMaterial`; graph nodes through `motif`/`nodeSites`; discs at the end of the window as sites. The
recording window, contact kind and minimum impulse filter marks, rays, graph and trails identically. Colours: body,
kind, or time (trails cut into palette-many exact bands).

## Controls and dependencies

Groups: Container, Placement (proportional Size), Bodies, Emitter (Launch), Collisions, Time, Contacts, Drawing (Discs,
Trails, Marks with proportional Scale, Rays, Graph). Inline `visibleWhen`: barrier count/size on Barriers ≠ none, tilt on
slats; emitter position/size/angle/Release-every by emitter; disc outline on outline; trail weight/spacing/bead/brush by
trail kind; mark size/weight/petals by mark; ray and graph controls by their toggles. The property test changes every hidden
control on random configurations and requires an unchanged drawing.

## Honest scope

Frictionless discs in 2D with exact reflection laws; no spin, deformation, stacking stability or general rigid bodies. User
containers/regions and host binding are future work (the direct API accepts any planar domain). The instrument stores a
bundled container name plus scalars only.
