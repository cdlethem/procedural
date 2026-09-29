# Stateful snapshots (foundation F7)

Status: **implemented on branch `w3/stateful-snapshots`, unreleased. Foundation only: no gallery
instrument, no metadata entry.** It serves the W3 stateful briefs (09, 15–21, 43–45, 49) in the
[release roadmap](next-release-roadmap.md). Code: `packages/instruments/src/composition/snapshots.ts`,
`snapshot-values.ts`, `spatial-index.ts`, `walks.ts`; tests: `tests/composition-snapshots.test.ts`.

## What it is

A study that evolves state (particles, fields, fronts, cells) declares a `Simulation`: an explicit
initial condition and one fixed-order step. Running it publishes `Snapshots`: retained checkpoints, a frozen
history of a chosen projection, the final projection and a content key. Drawing only reads snapshots. The
functional composition surface stays functional: the solver may mutate its own arrays inside `step`, but
nothing outside ever sees them, and no evolving simulation instance is shared between elements.

It extends the existing cooperative preparation (`prepareInstrument`, `PreparationCancelledError`) rather
than replacing it: the three motion studies and the proximity replay now run through it (below).

## Contract

```ts
interface Simulation<State, Params, Projection = undefined> {
  id: string;                                            // stable; part of every key and stream
  limits(params): { stepLimit; workPerStep; initialWork? };
  initial(ctx): State;                                   // ctx: params, seed, step 0, stream(), charge()
  step(state, ctx): State;                               // ctx.step = k builds the state after k steps
  project?(state, step): Projection;                     // what history retains; pure in (state, step)
  copy?(state): State;   size?(state): number;           // defaults: cloneState, countValues
}
runSimulation(sim, params, seed, { steps, checkpointEvery, historyEvery, cancelled, run, from, max… }) → Snapshots
prepareSimulation(…same, timeSliceMs, yieldToHost) → Promise<Snapshots | null>   // null = cancelled
resumeSimulation(snaps, extraSteps) · stateAt(snaps, k) · finalState(snaps) · projectionAt(snaps, k)
createSimulationCache({ capacity, maxStoredValues }).get / .prepare / .has
checkSimulation(sim, params, seed, steps)                // proves the guarantees below; use it in tests
```

`Snapshots` is frozen and holds `key`, `construction` (the key without steps), `params` (a frozen copy),
`seed`, `steps`, `checkpointEvery`, `historyEvery`, `checkpointSteps`, `history` (`{step, value}` entries),
`final` (the projection at `steps`), `work` and `storedValues`. States are held privately; read them with
`stateAt` / `finalState`, which return a copy the caller owns.

### Rules a step must obey

- **Fixed update order.** Visit elements in a stated order (state order, or ascending id). A synchronous
  rule reads the old state everywhere and writes a new one.
- **No hidden inputs.** Nothing but `params`, `seed`, the state, `ctx.step` and `ctx.stream()`. No clocks,
  `Math.random`, module-level mutable state, or reads of another simulation instance.
- **Seeded IDs.** Elements carry ids allocated from a counter stored in the state (`elementId("cell", n)`
  gives `cell:12`); the id is born once, never reused, and never comes from array position or iteration
  order. A random draw for an element comes from `ctx.stream(elementId, purpose?)`, derived from
  `(seed, step, id, purpose)` through `componentSeed`. Adding, removing or reordering other elements cannot
  move it, and a stream consumes only what its owner draws. The seed must be a uint32 to use streams.
- **State is plain data:** numbers, strings, booleans, arrays, plain objects, typed arrays, `Map`, `Set`, or
  an object with `clone()` (and optionally `valueCount()`), such as `PointGrid`. Cycles and class instances
  without `clone()` are rejected with the path. `step` may mutate its input and return it, or return a new
  state; the runner copies for every checkpoint and projection.
- **Projection is plain and pure.** Plain arrays/objects are copied and deep-frozen; typed arrays are copied
  into a private buffer (the language cannot freeze them: treat them as read-only, they are typed
  `Readonly`). `Map`, `Set` and class instances are rejected with the path. A projection depends on
  `(state, step)` only, never on the run (no "is this the last step" flag: it would change when steps grow).

### Guarantees (each tested; `checkSimulation` re-proves them for a new model)

| Guarantee | Meaning |
|---|---|
| Bit-identical | The same construction gives `Object.is`-identical states, histories and checkpoints in every run and process. |
| Spacing-invariant | `checkpointEvery` and `historyEvery` change retention only. Final state and every retained value are identical. |
| Cancellation-invariant | Cancelling and retrying, or running in time slices, cannot change a result. A cancelled run publishes and caches nothing. |
| Prefix property | Growing `steps` only appends: every earlier state, projection and id is unchanged. |
| Resume = scratch | `resumeSimulation(snaps, n)` (or `from`) equals a run from scratch to the total, including history, checkpoints (an earlier last step that the schedule does not keep is dropped), `work` and `key`, without re-running earlier steps. |
| Replay | `stateAt(snaps, k)` replays from the nearest retained checkpoint at or before `k`, at most `checkpointEvery` steps. |
| Element independence | Ids and per-element streams do not depend on order or on other elements. |

## Content key and cache

The key is `id | canonical params | seed | checkpointEvery | historyEvery | steps`; parameter key order
is irrelevant, `-0` differs from `0`, non-finite numbers and non-plain data are refused. **Appearance never
enters the key**: a study's construction params contain only initial-condition, model and step arguments;
palette, material, mark toggles and line weights stay in the drawing. A recolour therefore asks the cache
with unchanged params and receives **the same `Snapshots` object** (asserted by identity).

`SimulationCache` is LRU-bounded by entry count (default 8) and by stored values (default 8,000,000; the
newest entry is always kept). On a miss it starts from the best cached run of the same construction:
more steps extend it, fewer steps replay from its nearest earlier checkpoint. A slider dragged up costs the
new steps only (measured 5–18× faster than recomputing for the five refactored studies); a slider dragged down costs
one checkpoint interval. Retention arguments are part of the key, so choose them once per study.

Meaningful initial-condition edits (water content, seed geometry, boundary, rule, count, seed) change the key
and recompute. Palette edits do not. Step edits extend or replay.

## Bounds, and the argument to change

Everything is bounded and every failure names what to change:

| Bound | Default | Error names |
|---|---|---|
| `limits().stepLimit` | model's own | `steps`: "lower steps" |
| `steps × workPerStep + initialWork ≤ maxWork` | 50,000,000 | "lower steps or the model's size, or raise `maxWork`" |
| Work charged in one step ≤ `workPerStep` (`ctx.charge`) | model's own | `workPerStep` in `limits()` |
| State values ≤ `maxStateValues` (checked at every retained state) | 1,000,000 | "shrink the model or raise `maxStateValues`" |
| Checkpoint values ≤ `maxCheckpointValues` | 4,000,000 | "raise `checkpointEvery`, lower steps, …" |
| History values ≤ `maxHistoryValues` | 4,000,000 | "raise `historyEvery`, lower steps, …" |
| `steps` hard cap | 1,000,000 | `steps` |
| `checkpointEvery` default 50; `historyEvery` default 1; `0` keeps only the first and last | | |

A step declares work with `ctx.charge(units)`; exceeding the declared per-step bound throws, so the total
bound is real, not decorative. `run` (a `CompositionRun`) supplies cancellation and is charged one unit per
step (at least one), so nested consumers share one budget.

Cancellation is polled before the initial state and before every step. `runSimulation` throws
`SimulationCancelledError`; `prepareSimulation` and `cache.prepare` resolve `null` (the shape
`prepareInstrument` reports as `false`); other errors are never swallowed. `prepareSimulation` runs in time
slices (default 8 ms) with a yield to the host between slices; `now` and `yieldToHost` are injectable.

## Spatial index and walks (repeated needs of stateful systems)

Searched first: `packages/javascript` has only the batch `spatial.radius-pairs-2d`
(`radiusPairs2D`, still the right call for one-off pair lists and used by the proximity studies), and the
composition code has segment grids, not a point index. New:

- `PointGrid` (`spatial-index.ts`): insert / remove / move / `nearest` / `within` on a uniform grid over
  `bounds` with `cellSize`; integer ids; results ascending by `(distance, id)` (**ties go to the lowest
  id, independent of insertion order**); `within` is inclusive on squared distance. Bounded: at most 4,000,000
  cells and `maxPoints`; a query reports its cell and point visits to `onWork` (charge them). It implements
  `clone()` / `valueCount()`, so a state may hold one directly. Verified against brute force on seeded
  data (four cell sizes, removals, moves, lattice ties).
- `latticeWalkStep` / `angleWalkStep` (`walks.ts`): one bounded walk step from a per-element stream.
  Lattice: 4 or 8 neighbours in a fixed order, persistence, blocked cells, explicit `stuck`. Both consume a
  **fixed number of draws per call** (two, one), so a walk never desynchronises when blocked.

## Refactored: existing instruments now run through the API

| Instrument | Before | Now |
|---|---|---|
| Contact network, Agent trails (`proximity-replay-instruments.ts`) | `replay()` and a one-slot cache | `proximitySimulation` (state: points, velocities, pairs; projection: points and flat pair list per tick), `createSimulationCache`. `buildProximityReplay` keeps its shape; `cachedProximityReplay` exposes the cached one. |
| Lingering links, Sensing trails, Flocking marks (`external-motion-sources.ts`, `external-dynamics.ts`) | three generators, a hand-rolled LRU and yield loop | three simulations, the shared cache (`checkpointEvery: 20`, final projection only), `prepareSimulation` for cooperative preparation |

Removed as obsolete: the generators, `motionKey`, the local LRU and `yieldToUi`. The public
`PreparationCancelledError` and `prepareInstrument` contract are unchanged. Default and seeded drawings
are unchanged: 111 draw fingerprints (`tests/helpers/draw-fingerprint.ts`) over five instruments, three seeds
(42, 7, 1234567) and 6–9 settings each (ticks 0 to maximum, all source shapes, open chains, dots, links,
maximum counts including three over-budget cases that must throw the same error) were hashed from main's build and
again after the refactor: 0 differences. A further 150 (each study, three seeds, ten tick counts in an order
that forces extension, replay from a checkpoint and from scratch) also matched main's build exactly.

## What a W3 study must do

1. **Write down the model.** Declare `Simulation` with an `id`, `limits` (honest per-step work and a step
   limit), an `initial` that reads only `params`/`seed`, and a fixed-order `step`. Charge real work. Document
   the update order (synchronous or sequential, and the sequence) in the study's own doc.
2. **Publish state, checkpoints and projections.** State is what the model needs to continue (fields as typed
   arrays, agents with birth-counter ids, RNG-free). The projection is what consumers read at each retained
   step (front paths, agent positions, contacts, categorical grid), plain and small. Pick `historyEvery` and
   `checkpointEvery` so bounds hold; large fields belong in checkpoints and are read with `stateAt`, or in a
   sparse history. Publish ids so consumers can attach marks, materials and graphs without depending on order.
3. **Keep appearance out of construction.** The `Params` given to `cache.get` hold model and initial-condition
   arguments only. Palette, mark, material, opacity, contour level for a *display* threshold and which historical
   fronts to draw are read from `Snapshots` at draw time. That is what makes a palette-only edit repaint the
   same snapshot object. If a control changes what the model computes it is construction; if it only selects
   or styles what was computed it is appearance.
4. **Recompute deliberately.** Changing initial conditions, boundary, rule, seed or any model argument changes
   the key. Do not try to patch a snapshot; a longer or shorter `steps` reuses checkpoints automatically.
5. **Run `checkSimulation`** for a few seeds and sizes in the study's tests, and add independent-expectation
   tests for the model itself (conservation, termination, ids, ordering). Add cancellation through
   `prepareInstrument`: a preparer calls `cache.prepare(sim, params, layer.seed, { steps, cancelled })` and
   reports `false` on `null`.
6. **Use the shared tools:** `PointGrid` instead of all-pairs scans, `ctx.stream` for randomness,
   `latticeWalkStep` / `angleWalkStep` for walks, `radiusPairs2D` for one-off pair sets. Do not add a second
   cache or yield loop.

Brief-to-primitive map (guidance, not built here): 09 and 45 grid fields as typed-array state (water edits
recompute, colour repaints); 15 and 20 `PointGrid` with birth-counter ids and parent links; 16 and 44 front
or centerline paths as the projection with retained history; 17 sensor/motor stepping like the sensing
trails extended with a field in the state; 18 and 19 grid state with a categorical projection; 21
`latticeWalkStep` with occupancy and age; 49 fixed-step bodies with the contact event list in the
projection; 43 is a construction, not a time evolution, and needs only the ids/seed conventions.

## Non-goals

- **Not a physics engine and not a general graph library.** No solver, integrator, collision or topology
  code; those belong to each study (49, 16, 43). A study provides the step.
- No wall-clock or free-running simulation; no shared mutable simulation instance between elements.
- No serialization of snapshots or closures. Params are JSON-like; the simulation itself is code.
- No automatic decision about which edits are construction. The study says so by what it passes as params.
- No cancellation of a step in flight (steps are the cancellation grain) and no partial publication.
- Typed arrays inside projections are private copies but not frozen; consumers must not write them.

## Measured (Node 22, this machine, null drawing surface)

Best of three runs per case, milliseconds, against the pre-refactor build (baseline) on the same machine.

| Case | New (first draw / recolour / ticks − 1 / ticks + 5) | Baseline |
|---|---|---|
| Contact network default; 160 × 100 | 16 / 0.1 / 8 / 2.4; 61 / 0.1 / 26 / 3.7 | 12 / 0.1 / 8 / 10; 54 / 0.2 / 53 / 58 |
| Agent trails default; 126 × 120 | 24 / 0.2 / 6 / 1.8; 78 / 0.5 / 12 / 4.2 | 22 / 0.2 / 21 / 21; 74 / 0.5 / 72 / 74 |
| Lingering links default; 90 × 80 | 24 / 0.1 / 10 / 3.2; 122 / 0.3 / 27 / 7 | 23 / 0.1 / 19 / 20; 119 / 0.3 / 119 / 126 |
| Sensing trails default; 240 × 90 | 41 / 0.2 / 11 / 5.4; 89 / 0.7 / 23 / 17 | 43 / 0.2 / 34 / 36; 70 / 0.6 / 69 / 74 |
| Flocking marks default; 90 × 90 | 34 / 0.1 / 8 / 5.1; 223 / 0.3 / 48 / 27 | 30 / 0.1 / 22 / 26; 203 / 0.2 / 197 / 217 |
| Aggregation with the index, 800 steps × 8 walkers, about 1,200 grains, 9 checkpoints | 250; resume +100 steps 33 against 272 from scratch; `stateAt(750)` 15; 760 steps from the cache 19; cache hit 0; a time-sliced run is identical | n/a |
| `PointGrid`, 200,000 points | insert 78, 200k `nearest` 258, 100k `within` 137, clone 65 | n/a |
| Runner overhead, full history | 0.2 µs per step | n/a |

The first draw is 0–27% slower (state copies and frozen projections; the biggest cost is the largest
sensing state, whose paths are copied at each of five checkpoints). It buys the reuse in the last two
columns: extending or shortening `ticks` costs the new steps or one checkpoint interval instead of a full
recomputation, and a recolour never touches the model.

## Checks

`tests/composition-snapshots.test.ts` (29 tests): closed-form model against `stateAt`, history and
checkpoint steps; replay cost counted exactly; frozen and copy-on-read values; typed-array projections;
prefix property; checkpoint-spacing invariance (six spacings); resume equals scratch, including step counts,
unscheduled last steps, key and work; replay from a longer run's checkpoint; per-element streams under
reordering and omission; the checker on correct models and on hidden clock, `Math.random` and aliased
copies; cancellation at five points with poll counts; composition run charge and cancellation; time-sliced
preparation against the synchronous result (yield counts derived from an injected clock); cancellation while
yielded; cache identity under appearance edits, key order, seed and structural edits; extension and
checkpoint-replay reuse; LRU and value bounds; every bound naming its argument; state helpers; stream
statistics; `PointGrid` against brute force with removals and moves; lowest-id ties under three insertion
orders; bounded query work (< 400 units against 20,000 points); index errors; lattice and angle walks
(fixed draw count, blocked cells, persistence, uniformity); an aggregation built on the foundation
(parent is the nearest earlier grain by brute force, birth-serial ids, growth only appends); the refactored
proximity replay (identity under appearance, seed relevance, extension reusing frames, equality with a fresh
build); preparation and cancellation of the three motion studies through `prepareInstrument`.

Mutations confirmed to fail (each by at least one test): resume keeping an unscheduled last step; key order
sensitivity; per-element stream ignoring the element id; nearest ties preferring the higher id; no
cancellation between steps; projections aliasing live typed arrays; a walk skipping draws when blocked; an
over-aggressive nearest-ring bound; appearance in the proximity construction; `stateAt` replaying one step
too many; the cache never extending a shorter run.

## Open questions

- Retention (`checkpointEvery`, `historyEvery`) is part of the key by design; a host that varies it per
  request would fragment the cache. Studies should fix it.
- Typed arrays in projections are not frozen. If Studio ever passes projections to untrusted callbacks,
  those should receive copies.
- `stateAt` replays sequentially; a model with very expensive steps and few checkpoints needs a smaller
  `checkpointEvery`, at the cost of stored values.
- The proximity replay was not added to `canPrepareInstrument` (its work is small and unchanged behaviour
  was the goal); it is now a one-line `cache.prepare` if the host wants it.
