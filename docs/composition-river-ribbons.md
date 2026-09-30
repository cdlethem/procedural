# River Ribbons (brief 44)

Status: **implemented on branch `w3/river-ribbons`, unreleased.** Instrument `river-ribbons`; guide
`packages/instruments/guides/river-ribbons.md`. Code: `composition/river-model.ts` (pure geometry),
`composition/river.ts` (the F7 `Simulation`, the frozen `RiverScene`, traces, oxbow paths, age field),
`composition/river-draw.ts` (recipe and consumers), `adapters/river-ribbons-instrument.ts` (controls);
tests `tests/composition-river.test.ts`. A specified artistic 2D model, **not hydrology**: no flow solver,
sediment budget, terrain or physical units. Terrain-free, as briefed; Contour Relief consumers are not wired.

## Model (one step, fixed order, synchronous)

State: centerline nodes `xy` with birth-counter ids, next node id, oxbow records, three seeded erodibility waves,
`settledAt`. Both end nodes are pinned (inlet and outlet at 10% of the valley length inside its end walls).

1. Read the old channel everywhere: arc length `s`, width `w = W sqrt(1 + (Q - 1) s/S)` (discharge grows linearly
   to `Q` at the outlet, width goes as its square root; a function of the *fraction along the channel only*, so
   resampling cannot change it), signed curvature `2 sin(phi/2)/chord` (exactly `1/R` on a circle at any spacing).
2. Smooth curvature along the channel with a stated exponential kernel of length `smoothing` widths, taps up to
   4 lengths each side, weight `(1 + skew) e^(-mh/L)` upstream and `(1 - skew) e^(-mh/L)` downstream, renormalised
   over the interior nodes that exist (a constant curvature stays constant to the ends).
3. Migration: node moves along the left normal by `-mobility * held * erodibility * w^2 * smoothedCurvature`
   (outward, away from the centre of curvature). `held` is a smoothstep ramp over 6 inlet widths from each pinned
   end. A rate per step in widths per unit of width x curvature; a step that would move a node more than half the
   node spacing throws naming mobility, spacing and smoothing.
4. Valley walls: the part of a displacement toward a wall is scaled by a smoothstep of the room left over 3
   widths; a hard clamp backs it up. The four walls (two long sides, two end walls) are honoured.
5. Resample at `spacing` widths (equal segments; `round(length/spacing)` segments). Ids stay on the node nearest
   each old node along the channel (ties: earlier old node); other nodes take the next id. Resampling an already
   uniform channel changes nothing. Width and elapsed time are not touched.
6. Cutoffs, repeated until none remain (at most 12 passes). *Neck cutoff:* two nodes `i < j` closer than
   `cutoff * max(w_i, w_j)` (inclusive) with at least `(pi/2) * limit` of channel between them (the half circle
   whose diameter is the neck): the interior `i+1..j-1` leaves the channel, `i` joins `j`, and the interval becomes
   an **open oxbow** keeping its ids, positions and widths. *Crossing cutoff:* two non-adjacent segments that
   properly cross (what a neck the channel outran becomes): a node is born at the intersection, the channel passes
   through it and the loop leaves as a **closed oxbow**. Topology changes are explicit; nothing is hidden.
   **Tie rules:** candidates sort by (distance, i, j) with crossings (distance 0) first; a candidate whose closed
   interval `[i, j]` touches an accepted one waits for the next pass; nearest queries use `PointGrid` (ties to the
   lowest id). The result is independent of traversal order.
7. A step whose maximum move is below `1e-9 x spacing` and that cuts nothing **settles** (`settledAt`): the state
   is returned unchanged and each later step charges one work unit (explicit termination: straight channel or
   zero mobility).

Every retained step publishes the centerline and ids (`historyEvery: 1`, `checkpointEvery: 40`); an oxbow is
`{ id: "oxbow:<serial>", born, distance, closed, ids, points, width }`, age at step `k` is `k - born`.

## Contract

`riverRibbons(options)` -> frozen `RiverScene` (`channel` {ids, xy, arc, width, curvature}, `frames[k]`, `oxbows`,
`valley`, `bounds`, `settledAt`, `nodesBorn`), cached by construction in a `SimulationCache` (6 entries).
Construction = everything in `RiverOptions` except appearance, with the ignored planform's fields zeroed and the
seed replaced by 0 when nothing seeded is drawn (`riverUsesSeed`: wandering with amplitude > 0, or
heterogeneity > 0). Palette, opacity, widening, scar/oxbow style, fade, infilling and the age field are appearance:
they receive the **same scene object** (asserted by identity). `riverTraces(scene, every)` and `oxbowPaths(scene)`
return cached frozen `Path`s for any path material; `riverAgeField(scene, cell)` an `Int32Array` of the last
step each cell was occupied. `prepareRiverRibbons` is the cooperative form (`null` when cancelled, nothing cached);
`prepareInstrument` runs it. Lengths are canvas units, except node spacing, smoothing and the cutoff (channel
widths); angles are degrees; time is whole steps.

## Treatments (all read the one scene)

Current channel ribbon (width from discharge, swelled by smoothed curvature with `widening`, held inside 0.9 of the
local radius, mitred banks, bank lines); scars as lines or full ribbons at every `scarEvery` steps, fading with age
(opacity to 15%, width narrowing by `deposition`); oxbows as ribbons (aging the same way) or through the stock
`pathMaterial` (ink, stitch, beads); floodplain age field tinted in 12 age bands. `drawRiverRibbons(p, recipe,
{ ribbon, scar, oxbow })` replaces any consumer with a callback.

## Bounds (all name the control)

steps 0-600 (slider 0-360); nodes <= min(2000, 4 x length/spacing + 2) (sinuosity <= 4 checked as it happens);
kernel <= 100 taps; spacing <= half the inlet cutoff neck (so a limb cannot cross another between steps);
confinement >= twice the widest channel; work `steps x nodeLimit x (2 taps + 150)` <= 150,000,000; history values
<= 4,000,000; age field <= 250,000 cells and 8,000,000 cell tests; migration <= half a node per step.

## Choices on undecided boundaries

The pinned ends are inset 10% from the end walls and ramped in; the neck loop threshold is half a circle; a
crossing is a cutoff too; erodibility is three seeded plane waves (a boundary condition, not a lithology model);
bank migration uses discharge width squared so wide reaches move faster; `mobility` slider capped at 0.3 because
larger values violate the half-node rule for the default spacing.

## Measured (Node 22, null surface, this machine)

First preparation + draw / repeat / appearance edit / structural edit / +5 steps, ms: default (260 steps,
296 nodes, 8 oxbows) 350-490 / 6-8 / 9-11 / 195-230 / 16; slider max 360 steps 310-360 / 3-6 / 10-14 / 280-410 / 16;
hard max 600 steps 540-560 / 2-3 / 9-12 / 415-590 / 4-20; dense slider extreme (width 3, spacing 0.5, smoothing 6,
1166 nodes) 1005 / 5 / 5 / 1021 / 29. A palette-only edit reuses the scene; the age field first costs about 140 ms
more at cell 6. Observations, not guarantees.

## Checks

Independent analytic expectations: curvature `1/R` on circles of several spacings and signs; kernel weights
recomputed independently; migration `mobility w^2 / R` outward for two spacings and both windings; end ramp
smoothstep; width `sqrt` law and spacing independence; resampling positions, ids, and idempotence worked by hand;
neck tie rules, overlap, inclusive limit and width dependence; crossing cutoff worked by hand; wall easing;
per-step no-self-crossing and in-valley invariants for three seeds; id birth and non-revival; `checkSimulation`
(replay, prefix, checkpoint, retention); cache identity under appearance edits; recompute under ten construction
edits and seeds; cancellation leaves no cache entry; settle termination; rate independence of spacing; downstream
lag; every bound message; hidden-control property test. Mutations confirmed to fail: migration sign; cutoff tie
order; id tie rule; hidden planform fields in the key; settle detection; skew direction; crossing cutoffs;
kernel renormalisation; width in dynamics; wall easing (10, each by at least one test).

## Not done

Terrain/contour consumers of the surrounding landscape (the brief's "terrain-free" scope keeps it out); host
binding of user-drawn initial centerlines (future work: a typed polyline value is accepted only by
extending `initial`); no real-interface acceptance claimed.
