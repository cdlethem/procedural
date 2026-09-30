# Laplacian Fronts (brief 16)

Status: **implemented on branch `w3/laplacian-fronts`, unreleased. Reviewed from rendered output only; not yet
exercised through the real Studio interface, layered in the app, or reviewed for responsiveness there.** It is a
W3 stateful study built on the [stateful snapshots foundation](composition-snapshots.md) and the frozen
[reference slice](composition-reference-slice.md) boundary. Guide: `packages/instruments/guides/laplacian-fronts.md`.
Code: `composition/laplacian-layout.ts`, `laplacian-growth.ts`, `laplacian-marks.ts`, `laplacian-fronts.ts`,
`adapters/laplacian-fronts-instrument.ts`; tests: `tests/composition-laplacian-fronts.test.ts`.

## Artist-facing brief

Lobed, tip-amplifying fronts and banded dendrites, distinct from random particle aggregation and from offsetting a
contour. A seed region grows through a potential: the potential between the growing region (0) and a source (1) is
solved on a grid, the boundary advances at a speed that follows the potential gradient, and every front is kept.
Four treatments read the same run: history fronts as `pathMaterial` strokes tinted by age, the occupied region as flat
fill or age bands, motifs by front age or at the tips, and equipotential lines. Walls, pillars and sinks can be outlined.

Honest scope: **a 2D moving-boundary model on a square grid** (dielectric-breakdown / Hele-Shaw family), not a physical
simulation of any material. It does not reproduce Nervous System's images; it makes the same kind of relationship.

## Model (frozen semantics)

Full statement in the headers of `laplacian-growth.ts` and `laplacian-layout.ts`; the parts that matter:

- **Domain.** The 640-unit canvas on `grid × grid` cells (grid 24–256; the instrument offers 48–160). Cell classes: free,
  SOURCE (potential 1), SINK (potential 0, never entered), WALL (insulating, never entered). The canvas edge is insulating
  unless it is source. The SEED region is occupied (potential 0, age 0); a seed cell on a source, sink or wall is dropped, and an
  empty seed is an error naming the controls. Sources: far ring, frame, one side, or point sources; sinks: discs; barriers:
  a wall with gaps, or pillars placed in the band `20 + 150 √u` units beyond the seed's reach.
- **Potential solve.** Laplace's equation on the free unoccupied cells (5-point stencil) by red-black SOR with Chebyshev
  acceleration, ω from the geometry's Jacobi spectral radius (power iteration on a coarsened grid, `jacobiRadius`; an
  insulating edge or one-sided source makes the textbook `cos(π/(n+1))` wrong by a lot). **Residual** = largest gap between a
  cell and the mean of its open neighbours, in units of the source potential 1, measured by an independent pass over the final
  iterate; tolerance `10^-precision` (default 1e-7); the first solve may use 4× `maxIterations`, later solves warm-start from the
  previous potential. A solve that does not reach the tolerance throws, naming the residual, the sweeps and *Solver iterations*,
  *Solver precision* and *Grid*; nothing is drawn from an unfinished solution. NaN can never report convergence (a regression:
  isolated unknown cells once gave a NaN Jacobi radius and a "converged" NaN potential).
- **Flux and speed.** At each frontier cell (free, unoccupied, with an occupied 4-neighbour) the gradient is estimated per axis
  (one-sided toward a fixed neighbour, else central; walls mirrored). Normalized flux `ĝ = |g| / max|g|`; speed
  `v = ĝ^η − ℓ κ`, clamped at 0, with `η` the growth bias and `ℓ κ` surface tension times the curvature of the 0.5 level of the
  occupancy blurred by a 1.25-cell Gaussian. `η = 0, ℓ = 0` is a uniform-speed offset of the seed, the reference the fronts
  must differ from. Cell rate = `v · w · mobility`, `w = |g| / max(|gx|, |gy|)` in [1, √2] (staircase length correction),
  mobility = `1 + noise · v` for a seeded value noise on a 24-unit lattice.
- **Advancement.** The fastest cell advances `stepScale` cell widths per step: every frontier cell's fill grows by
  `stepScale · rate / max rate`; cells reaching fill 1 are occupied in ascending id (age = step, potential 0) and share their
  excess equally among free unoccupied neighbours. Nothing is dropped (`lost` reports excess with nowhere to go; asserted
  by area accounting). Order per step: rates from the state, fill, occupy, solve, rates.
- **Fronts.** The 0.5 level of a coverage field of the fill (`f(m) = m/(0.5+m)` below ½, `0.5/(1.5−m)` above, so the interpolated
  crossing tracks the fill), by marching squares (`maskDomain` contour mode: exact predicates, merges/splits/pockets stay valid
  rings; outer rings positive, pockets negative). Segments along the canvas edge are cut from paths: a front meeting the insulating edge is an
  open chain. Ids `front:<step>/<ring>`.
- **Termination.** Explicit, with a reason: `reached` (a newly occupied cell is beside a source: the circuit closes), `exhausted`
  (frontier empty, e.g. a sealed region filled), `stalled` (no flux, or surface tension exceeds it everywhere). The stopping
  step is `lastActiveStep`; later frames are marked `repeat` with no rings and every consumer reads the last active front.
- **Simulation contract (F7).** `growthSimulation` (`id laplacian-growth`): state = fill, age, phi, rate (typed arrays) plus
  scalars; projection = frame (time, area, residual, sweeps, stop info, ring points and offsets as typed arrays); retention
  `checkpointEvery 25`, `historyEvery 1`; run through `createSimulationCache` (6 entries). Construction params hold only
  boundary/seed/model arguments; hidden selections are replaced by constants in `growthSpecOf` so hidden controls reuse the run.
  The seed is the instrument seed only where it can matter (noise, clustered discs, barriers), else 0.
- **Ownership and units.** Runs, frames, paths, sites and outlines are frozen and cached per run; typed arrays are read-only by
  contract. Canvas units, angles in degrees in options and radians in published site angles, time normalized (distance a unit-speed
  front travels).

## Producers and consumers

| Piece | Where | Contract |
|---|---|---|
| `growthLayout(spec, seed)` | `laplacian-layout.ts` | Frozen cell classes, seed, mobility, neighbour table; LRU 6. |
| `solvePotential`, `jacobiRadius`, `frontRates`, `growthSimulation` | `laplacian-growth.ts` | The solve, the flux/speed rule, the stepped model. |
| `growthSnapshots`, `prepareGrowth`, `growthCached`, `growthDiagnostics` | `laplacian-growth.ts` | Cached / cooperative run; residualMax, sweeps, work, stop reason. |
| `frontPaths`, `frontOutlines`, `occupiedRegion`, `potentialField`, `equipotentialPaths` | `laplacian-growth.ts` | Paths of any retained step, keyhole outlines for fills, final region as a planar domain, scalar potential, equipotentials. |
| `ageSites`, `tipSites`, `boundaryPaths` | `laplacian-marks.ts` | Motif sites (age lattice, speed maxima with outward angle) and wall/sink outlines. |
| `laplacianFrontsComposition`, `drawLaplacianFronts`, `prepareLaplacianFronts` | `laplacian-fronts.ts` | Recipe, drawing through `strokeWith`, `pathMaterial`, `atEach`/`motif`; every consumer replaceable by a callback. |

Reused, not copied: `SimulationCache`, `maskDomain`/`domainRings`/`keyholeRings`, `pathMaterial`/`motif`/`tonedMaterial`, `paletteRamp`,
`chaikinPolyline2D`, `componentSeed`. Nothing new in shared files except registration (`index.ts` one-line spreads, metadata).

Input contract: the instrument persists technique id, scalar controls and palette only. The direct API takes a `GrowthSpec` (a resolved
layout description). **Binding a user's own boundary mask or region (a typed raster/region as seed or wall) is future host work**; the
layout would then be built from `maskDomain`-compatible masks instead of the analytic shapes.

## Controls and groups

Sections: **Seed** (shape, lobes, lobe depth, seed discs), **Placement** (seed X/Y, proportional *Size*: radius and spread, angle),
**Source**, **Sinks** (proportional *Size*: sink size and ring), **Barrier** (proportional *Widths*: wall width and gap width),
**Growth** (steps, growth bias, surface tension, step size, noise), **Solver** (grid, precision, iterations), **Fronts** (material,
interval, first/last front, proportional *Line weights*, stitch spacing, bead size, smoothing), **Fill**, **Marks**, **Boundary lines**,
**Potential lines**. Inline `visibleWhen`: lobes/depth by lobed seed; discs by cluster/necklace; spread by cluster/necklace/bar; angle by
lobed/necklace/bar; source controls by source kind; sink and barrier controls by their selects; front controls by front material;
fill controls by fill; marks controls by marks; boundary weight and potential controls by their selects.

Slider intervals of the cost drivers (grid 48–112, steps 1–120, solver iterations 100–1000, precision 4–8; growth bias 0–3, tension
0–40) were narrowed so that the worst slider corner, with every treatment on, prepares in about 2 s or less (table below). Hard bounds
stay wider for exact entry (grid 24–256, steps ≤ 2000, iterations ≤ 5000, precision 2–12, bias ≤ 8) and are limited by the declared work
`initialWork + steps · grid² · (iterations + 30) ≤ 10,000,000,000` cell updates. The cap is the worst case (every solve using every sweep);
actual solves need 100–1100 sweeps, and a solve that exhausts its sweeps fails immediately. Every message names
Steps, Grid and Solver iterations. Retained-history and checkpoint memory (16M and 6M values) are bounded by the runner and rethrown naming
Steps and Grid. Drawn front vertices ≤ 1,500,000 (message names Front interval, First/Last front, Front smoothing); mark sites ≤ 30,000.

## Checks

`tests/composition-laplacian-fronts.test.ts` (22 tests), independent expectations throughout: the potential of a disc in a ring against
`ln(r/a)/ln(b/a)` at the cells' effective radii (deviation < 0.02) and an independent residual pass equal to the reported one; maximum
principle, fixed cells never entered, for every source kind with sinks and barriers; an unconverged solve throws naming the controls; a
poisoned (NaN) iterate never converges and a one-cell gap solves finite; the speed law (`w = rate(1)²/rate(2) ∈ [1, √2]`, `rate(0) = w`,
tips faster than notches on a lobed seed mirror-symmetric on the grid, uniform for η = 0); tip amplification on a perturbed circle (η 1 and 2
amplify the lobe amplitude by > 25 units, η 0 does not, tension removes it); exact area accounting per step; merging (two outer rings
become one, a necklace closes pockets as negative rings, signed ring areas add to the enclosed area); explicit termination (stalled,
exhausted in a sealed region, reached with the contact step verified against the layout); `checkSimulation` (replay, prefix, spacing,
cancellation) for two constructions; prefix property on fronts and ages; palette/material/fill/marks/window/potential/boundary edits return the SAME snapshot object
and every structural edit, seed, and hidden-control-free edit recompute or reuse as declared; extension and checkpoint replay; cooperative
preparation with cancellation leaving nothing cached; layout classification, dropped seeds, pillar prefix stability; sinks and one-sided
sources bend growth; tips are frontier speed maxima pointing outward, ages increase outward, equipotentials nest; consumer replacement;
boundary outline areas; bounds naming controls; the slider corner of every cost driver validates, runs to its last step within its residual and draws, while a hard-limit setting beyond every slider still validates and one beyond the work bound names its controls.

Mutations confirmed to fail (each by at least one test): growth bias ignored; a non-converged solve accepted; excess fill dropped;
surface-tension sign flipped; staircase weight removed; reached-source stop removed; hidden controls entering the construction key; NaN
residual treated as convergence.

## Review record

Rendered through a throwaway SVG surface (`render.mjs` pattern) and Chromium under the render lease: defaults at seeds 42, 7, 1234567;
early/mid/late steps; offset (η 0), blunt lobes, fingers (η 2–3), one-sided source with a bar seed, five point sources, three sinks,
wall with two gaps, diagonal wall with sinks, eight pillars, cluster of discs, necklace, tip arrows, age dots with potential lines,
stitches, beads, dense (200 fronts), sparse (3 fronts), extreme (η 3, grid 128), stalled; layered with Contour Scores and Sand Deposition
in both orders. Defects found by looking and fixed:

- the first defaults (η 1.4, tension 4) let one finger race across the canvas and splat flat against the source ring: added the `reached`
  stop, retuned defaults (η 1.3, tension 3, noise 0.3, 80 steps) after comparing nine candidates over three seeds; tension ≥ 8 gave
  featureless blobs, η ≥ 2 a single tendril;
- bands were opaque brown mud (opacity 0.3 × 8 bands): 0.16 × 6;
- walls and pillars were invisible, so bent fronts had no visible cause: the *Boundary lines* treatment;
- pillars were placed by maximum distance from the seed, i.e. in the corners: now seeded in the band the growth reaches;
- a solver bug found by a stalled-looking run (thin gap: NaN Jacobi radius, NaN potential reported as converged): fixed and tested;
- one-sided sources needed > 600 sweeps: default 1000, slider up to 1000 (grid and steps sliders narrowed to keep the worst corner near 2 s);
- a beads-every-step corner failed with the unnamed "Composition work budget exceeded": the drawing budget is now 1.9M with the stroke work estimated up front (the densest hard setting, beads every 0.5 units on every front, draws inside it; a test) and its error names the controls;
- lattice anisotropy: on a plain disc with η ≥ 2 and little noise the fingers align to the grid axes, and η = 0 gives a slightly
  octagonal offset (22.5° radius 4.5% above 0°). Not fixed: it is a property of the square grid and the cell-wise flux estimate;
  noise, off-axis lobes and finer grids reduce it (stated in the guide).

## Timing (Node, null surface, this machine)

Measured while other agents kept the 24-core machine at load 20–24, as **process CPU milliseconds** (wall time was 1.5–2× worse), so an
idle machine should be about twice as fast: the default measured 305 ms at load 14 and 620 ms at load 24. A test
(`the slider corner of every cost driver validates…`) builds the corner from the definition's slider maxima and runs it.

| Case | First preparation | Recolour / material+fill+marks edit | Structural edit |
|---|---|---|---|
| Default (grid 96, 80 steps) | 620 ms (305 ms at lower load) | 2 ms / 100–270 ms with every treatment on | 340 ms |
| **Slider corner**, one-sided source, grid 112, 120 steps, 1000 sweeps, precision 8, every treatment (beads every step, smoothing 3, 12+ potential lines, age marks, bands, outlines) | 2.1 s solve + 0.4 s drawing | 200 ms | 340 ms drawing / 2.4 s if the construction changes |
| Slider corner, ring source (120 steps, no contact) | 1.2 s | 220 ms | 1.2 s |
| Slider corner, frame source (contact at step 108) | 1.5 s | 230 ms | 1.4 s |
| Slider corner, five point sources (contact at step 87) | 2.3 s | 130 ms | 2.2 s |
| Slider corner, wall with gaps + one-sided source (worst measured, 1620 sweeps in the first solve) | 2.8 s | 96 ms | 2.2 s |
| **Hard max**: grid 160, steps 240, 1500 sweeps, precision 10, every treatment (1.9–4.1 billion cell updates) | 8.8 s wall / 13 s CPU under load | 290–620 ms | 9–16 s |

Those loaded figures divided by about two give 1.1–1.4 s for the worst slider corner on an idle machine; they are a conversion, not a
measurement. A drawing prepared through `prepareInstrument` is time-sliced (steps are the cancellation grain, about 15–25 ms each at the
corner); a direct `drawInstrument` on an unprepared setting blocks for the first-preparation time. Stitch/bead drawing work is bounded by an
explicit estimate (`points + 2 × stations ≤ 1,800,000`, error names Front interval, Stitch spacing, First/Last front and Front smoothing).

## Open concerns and decisions to confirm

- Real-interface acceptance, layered work in the app and interaction cost are root's to exercise.
- `reached` ends growth when any front touches a source, even if other lobes were still running. Conservative choice; letting the rest continue would need a rule for cells touching the source.
- Lattice anisotropy (above) and cell-sized jaggedness (hidden by *Front smoothing* 1 by default).
- The Laplacian model has no per-cell randomness inside a step (the seed decides only the seed geometry, barriers and the mobility noise), so replays are bit-identical without streams; if a later variant needs stochastic acceptance it must use `ctx.stream(cellId)`.
- The declared-work cap is a worst case; a per-step measured budget could raise it.
