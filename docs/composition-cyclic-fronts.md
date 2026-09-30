# Cyclic Fronts (brief 19)

Status: **implemented on branch `w3/cyclic-fronts`, unreleased.** Instrument `cyclic-fronts` ("Cyclic Fronts"), built on the stateful
snapshot foundation ([F7](composition-snapshots.md)). Code, all new files:
`packages/instruments/src/composition/{cyclic-rule,cyclic-structure,cyclic-params,cyclic-fronts}.ts`, the definition in
`src/adapters/cyclic-fronts-instrument.ts`, guide `guides/cyclic-fronts.md`, tests `tests/composition-cyclic-fronts.test.ts`. Shared files touched:
`src/index.ts` (imports, the definitions list, `drawUncomposited`, `canPrepareInstrument`, `prepareInstrument`, `usesSeed`, the default palette, exports) and
`metadata.json` (one entry).

Scope, stated plainly: a **2D cyclic cellular automaton on a bounded square grid** with one specified rule. It is not a chemical
simulation, not the Belousov-Zhabotinsky model and not a reconstruction of Draves's Bomb or McCabe's collections; those give context for the
look, not proof of this rule. There is no wrap-around (torus) mode.

## The model (`cyclic-rule.ts`)

`cyclicSimulation: Simulation<CyclicState, CyclicConstruction, CyclicStep>` run through `runSimulation` / the shared `SimulationCache`; no second stepping,
caching or cancellation layer.

**Rule.** `states` n on the cycle 0 -> 1 -> ... -> n-1 -> 0. A cell in state s becomes s+1 (mod n) iff at least `threshold` cells of its
neighbourhood are in state s+1 *before the step*; otherwise it keeps s. It never moves back or skips.

**Update order.** Fully synchronous: every cell reads the old grid and writes a new one, so the visiting order (row-major) cannot change a result.
Tested against an independent nested-array implementation (five rules, all three shapes, obstacles, 25 steps each) and by a hand-computed case where an in-place update differs.

**Neighbourhoods**, the cell itself excluded, `range` r in 1..6:

| Shape | Offsets | Count |
|---|---|---|
| `moore` | max(|dx|,|dy|) <= r | (2r+1)^2 - 1 |
| `neumann` | \|dx\|+\|dy\| <= r | 2r(r+1) |
| `ring` | round(sqrt(dx^2+dy^2)) == r (annulus, hollow) | 8, 12, 16, ... for r = 1, 2, 3 |

**Boundary.** Bounded: cells outside the grid do not exist and are never counted.

**Obstacles.** A wall cell (`WALL` = 255) never changes and is never counted as a successor. A wall occupies cells; it does not shield line of sight, so with
range r a front can still be seen across a wall thinner than r (an honest consequence of a neighbourhood that is a set of offsets).

**Termination and period.**
- *Fixed point.* If a step changes no cell, `fixedFrom` = the first step whose grid is fixed. Later steps charge one work unit and do nothing (`work(60) - work(6)` = 54 in the test). An absorbing obstacle, a
  tiny grid, a train of stripes that has run off the edge, a target that has swept the grid all end this way; `summary.fixedFrom` reports it.
- *Period.* A grid that cycles without being fixed is detected exactly by Brent's algorithm: one earlier grid is kept and replaced at steps 1, 2, 4, 8, ...; the first step whose grid equals it reports `period` (the minimal
  period of the orbit, checked against brute force on 40 random 4 x 4 grids) and `periodAt`. It is exact equality (no hash), costs one extra grid, and reports at most about twice (start + period) steps in. The grids from `periodAt` on are still
  computed, so `stateAt` stays the true state. A model that has not repeated within `steps` reports 0, which is not a claim about chaos. (Example found while working: with Moore range 1 and threshold 1 every cell changes every step and the
  grid cycles with period n; the default rule finds the same period n once the spirals fill the grid, about step 80.)

**Initial conditions** (construction, all seeded through `ctx.stream(elementId("cell"|"seed"|"block"|"ring"|"bar", serial), purpose)`; a cell's serial is `y * 4096 + x`, so growing the grid keeps every existing cell's draw):

| Start | Definition |
|---|---|
| `random` `density` | each cell holds a uniform random state with probability `density`, else 0 (one draw per cell: `state = floor(u / density * n)` for `u < density`) |
| `spirals` `count`, `radius`, `noise` | seeded pinwheels: centre, turning direction and phase from `stream("seed:i")`; state = floor(turn x angle / 2pi + phase) mod 1 x n inside the radius; later seeds overwrite earlier where they overlap |
| `stripes` `width`, `angle`, `noise` | state = floor(((x+1/2) cos a + (y+1/2) sin a) / width) mod n |
| `stamp` `pinwheel`, `counter-rotating`, `target`, `triad` | pinwheel: states increase *clockwise on the canvas*, one per 360/n degrees; target: states fall with distance, one cycle across the radius, so each ring is the successor of the ring outside it and the wave runs outward; triad: three pinwheels at 120 degrees |
| `noise` | after the pattern, each cell is reset to a random state with probability `noise` (stream purpose `noise`) |

Obstacles: `blocks` (seeded squares), `ring` (circular wall, `gap` = share of the circumference left open at a seeded angle), `bars` (evenly spaced vertical walls each with a seeded opening),
and `cells` (a resolved mask as alternating start/length run pairs, produced by `obstacleRuns(shape, columns, rows)` from **any planar region or domain** in cell units, or `lettersObstacle(text, ...)` from the bundled outline font via `textDomain`).
A cell is a wall when its centre is inside or on the shape (the closed set of `locateInDomain`), so moving or resizing the drawn grid does not change the walls.

**State.** `cells: Uint8Array`, `last: Uint16Array` (step of each cell's last change), the Brent `mark` grid and counters, `changed`, `fixedFrom`, `period`, `periodAt`: plain typed data, no ids beyond cell coordinates
(cells do not have births). The per-step **projection** is four numbers (`step, changed, fixed, period`); grids are read with `stateAt` (checkpoint every 25 steps, at most 24 steps of replay).

## Producers (`cyclic-structure.ts`): frozen, cached by grid

`cyclicGrid(snapshots, step?)` (a read-only copy of the state after `step`, cached per snapshot, at most 8 kept) feeds:

- **`stateRegions(grid, geometry, seed)`**: exact cover of the grid by rectangles of equal cells (walls too, as state `WALL`), rows cut into runs, a run that repeats the columns and state of the run above extends that rectangle. Each is a composition `Region` plus `state, column, row, spanColumns, spanRows`; id `run:<state>:<column>,<row>` (`run:wall:...`).
  Disjoint, areas add up to `columns x rows` (tested on hand grids and random ones); `inside(...)` consumes them.
- **`frontPaths(grid, geometry, { kinds, smoothing, seed })`**: every cell side between two different non-wall states, **exactly once**, chained into `Path`s.
  Edge extraction rather than marching squares, so the boundary between two cells is one shared object. A side is directed so the *invading* state is on the left of travel (canvas, y down); an interface is `advance` when the states are neighbours on the cycle (invader = the successor) and `defect` otherwise (higher state on the left).
  Edges of one state pair join head to tail; where two chains of one pair cross they go straight through; a chain ends only at a triple point (shared exactly with the other pairs' paths that end there), the grid edge or a wall, and a closed chain is a loop. Fields: `from, to, kind, edges, start`; id `front:<from>><to>:<column>,<row>` of the first vertex, `tone` = invading state, `level` = invader, `levelFraction`.
  Smoothing 0 keeps the cell corners with straight runs merged; smoothing k is 4k passes of Taubin's shrink-free lambda|mu filter on the full lattice path with both ends fixed (Chaikin corner cutting left a visible staircase and shrank small loops; see defects).
  Tested against brute force: the set of unit sides equals the set of differing adjacent pairs, none twice, invader on the left by geometry, triple points shared exactly (also after smoothing).
- **`spiralCores(grid, geometry, seed, reach)`**: winding number of the outer ring of the 2r x 2r block around each interior vertex (sum of the shortest cyclic differences of consecutive cells, clockwise on the canvas); +/- n is a vortex. Vertices with equal winding that touch are one cluster; a core is one `Site` at the cluster centroid,
  `winding` +/-1 (+1: states increase clockwise), `support` vertices, id `core:<column>,<row>` of the cluster's first vertex, `tone` 0 or 1. Loops with a wall cell in the block or a difference of exactly n/2 (even n: direction undefined) are skipped, so a core is only reported on unambiguous evidence and never around an obstacle. The first version tested only the four cells round a vertex (reach 1) and
  missed most real cores (tight pinwheels have them, relaxed spirals do not: 1-2 of 14 found); reach 2 finds them and reach is a control.
- **`cellSites(grid, geometry, seed)`**: a `Site` per non-wall cell (angle = state / n of a turn, tone = state) for a per-cell mark.
- `stateCounts(grid)`, `statePalette(palette, states, "ramp" | "cycle")` (ramp: the palette as a closed loop sampled at s/n), `stateHatch(bounds, angle, spacing)`.

Units: canvas units for positions and lengths (`gridGeometry(columns, rows, frame)`: square cells of side `width / columns`, the grid centred on the frame); cells for the model; degrees for stripe/hatch angles, radians for `Site.angle`.
Failure: invalid values throw naming the control (`Threshold must be an integer in [1, 24]`, `The grid would have 320 rows ... lower Columns or the height-to-width ratio of Size`, `... lower Steps, Columns or Range`); nothing is truncated or replaced by a fallback picture.

## Bounds (explicit and measured)

| Bound | Value | Names |
|---|---|---|
| States / Range / Columns / rows | 3-24 / 1-6 / <= 240 / <= 240 | the control |
| Threshold | 1 .. neighbourhood size | Threshold |
| Steps | <= 2000 (slider 300) | Steps |
| Run work = steps x cells x (neighbours + 2) | <= 800,000,000 | "lower Steps, Columns or Range" |
| Checkpoints | every 25 steps, <= 16M values, cache <= 4 runs / 20M values | |
| One drawing's mark operations (regions, cell marks, hatch lines, front paths and stitches over the current and earlier fronts, cores) | <= 900,000 | Columns, Earlier fronts, Stitch spacing, Hatch spacing |
| Earlier fronts | <= 7 (the per-snapshot grid cache holds 8) | |

The work bound is deliberately a predictable upper bound: cells stop scanning a neighbourhood once the threshold is met and settled grids do no work, so measured time is about 10x lower than the bound suggests at typical settings
(one worst-case scan measured about 1 ns per unit).

## Consumers and composition (`cyclic-fronts.ts`)

`cyclicFrontsComposition(input)` -> `CyclicFrontsComposition { seed, palette, construction, steps, frame, ink }`; `drawCyclicFronts(surface, recipe, { fill, cell, front, core })`; `prepareCyclicFronts(recipe, cancelled)`; `cyclicFrontsProducts(recipe)` (grid, regions, all fronts, cores, and a `CyclicSummary`:
`changed` per step, `fixedFrom`, `period`, `periodAt`, state histogram, wall cells, core count, advancing and defect edge counts).
Draw order: walls, state fill, cell marks, earlier fronts (oldest first, thinner with age), current fronts, cores. Treatments use the existing consumers: `inside` for regions, `atEach(motif)` for cell marks and cores, `strokeWith(pathMaterial)` for fronts.
Regions are drawn by a small per-state filler rather than `regionFill`, because `regionFill` picks its ink per region id and fills leaves with hatch, motifs or contours, not with a colour that follows a categorical state; "regions select different fillers" is offered as per-state hatch angle and as the replaceable `fill` consumer, which receives the cached `StateRegion`.

**Construction versus appearance.** The construction key holds only model, grid, start, obstacles and `steps`. Palette, fills, marks, front material, smoothing, earlier fronts, colors, placement (centre, uniform scale) and core reach never enter it, so an edit of them gets **the same `Snapshots` object** (asserted by identity), and so does a seed change for a construction that draws no seeded value (`usesSeed`).
Width and Height change the number of rows (`rows = round(columns x height / width)`), so their ratio is construction; a uniform scale is not. Hidden controls never change a drawing (property test over 300+ hidden-control changes, 7 drivers, plus the repository-wide conditional-controls property test).

## Instrument controls

Defaults: seeded pinwheels (5), 8 states, Moore range 2, threshold 3, 96 columns, 70 steps, flat ramp fill with dark smoothed fronts and rings at the cores.

| Group | Controls | Notes |
|---|---|---|
| Rule | states, neighbourhood, range, threshold | |
| Grid and time | columns, steps | slider 24-160, hard 8-240; slider 0-300, hard 0-2000 |
| Placement | centerX, centerY, **Size**: width, height (`proportional`) | |
| Start | initial; density (random); seedCount (pinwheels); seedSize (pinwheels, stamp); stamp, stampX, stampY (stamp); stripeWidth, stripeAngle (stripes); noise (pinwheels, stripes, stamp) | `visibleWhen` on `initial` |
| Obstacles | obstacles; obstacleSize (blocks, ring, bars); obstacleCount (blocks, bars); obstacleGap (ring, bars); obstacleText (letters); obstacleDraw (all but none) | |
| Cells | fill; fillOpacity (flat); **Hatching**: hatchSpacing, hatchWeight, hatchAngle (hatch); **Cell mark**: cellMark, cellMarkSize, cellMarkWeight (not none) | |
| Fronts | fronts; frontMaterial, frontColor, frontWeight, frontSpacing (stitch, beads), smoothing; **Earlier fronts**: echoes, echoSpacing | chain `fronts` -> `frontMaterial` -> `frontSpacing` |
| Cores | coreMark; coreReach; **Scale**: coreSize, coreWeight (`proportional`, both canvas lengths) | |
| Color | colors | |

Proportional groups are only Size (canvas width and height) and the core mark's diameter and line weight. Numeric drivers cannot be expressed, so `echoSpacing` stays visible with no earlier fronts (documented in the guide as "only matters with earlier fronts").

## Verification

`tests/composition-cyclic-fronts.test.ts`, 28 tests, independent expectations: neighbourhood sizes; hand-computed step-by-step train of stripes to a fixed point (changed cells per step, `fixedFrom` = 5); simultaneous update; threshold `>=`; the exact cells one lone cell converts for three shapes and two ranges; walls stopping a front;
an independent direct implementation compared on five configurations for 25 steps; cyclic order and wall invariants over three rules x 30 steps; termination work accounting (54 later steps = 54 units); a hand-checked 2 x 2 cycle of period 3 and Brent against brute force on 40 random grids (periodic and fixed both present); `checkSimulation`
(replay, prefix, spacing, resume, cancellation) on three constructions; per-cell seeded draws independent of grid width, density statistics, closed-form stripes and pinwheels; pinwheel core at its centre with the winding its turn implies and a counter-rotating pair with both; exact cover by regions; every interface side exactly once with the invader on the left; closed loop and shared triple points (also smoothed);
winding by hand, ambiguity, walls and mirrors; snapshot identity under appearance edits and its absence under structural ones; scrubbing as a prefix; defaults draw the same cached objects to fills, fronts and cores; palette repaint vs structural edits by draw fingerprint; hidden controls; obstacle masks from a planar shape; every limit's message; cancellation before, during and after (`hasCyclicSnapshots`); colours and hatching.

Mutations, each confirmed to fail at least one test (11 of 11): in-place update (3 tests), threshold `>` (10), walls counted as successors (1), out-of-grid neighbours clamped instead of ignored (2), period detection disabled (1), settled grids doing full work (2), winding sign flipped (2), regions not merged vertically (1), front direction reversed (1), seed always in the snapshot key (1), the cycle not wrapping n-1 to 0 (7).

## Looking at it (SVG surface rasterised with Chromium; images read, not just produced)

Reviewed: the defaults at three seeds (42, 7, 1234567) and at steps 3, 25, 300; twelve strongly different structural settings (labyrinth from random cells, 3-state thin scrolls, 12-state ramps, ring neighbourhood with blocks, high-threshold frozen speckle,
stripes with disturbance, counter-rotating pair, barred walls, lettering, target, sparse random seeds, triad); twelve treatment, sparse, dense and extreme cases (hatching, arrows, rosettes over a faint fill, beads, stitches with six earlier fronts, cores over hatching, cycle colours, 24 states with range 6, a 24-column coarse grid, a combined hatch + stitched echoes + ring wall setting, 160 columns with 16 states, an off-centre 2:1 grid);
and three layered pairs in both orders with unmodified instruments (fronts and cores over Contour Scores, a soft fill and Motif Ecologies, state hatching and Graph Roles).

Defects found by looking, and fixed:
1. Hairline seams between merged rectangles (anti-aliased edges meeting on fractional pixels): opaque fills now carry a hairline stroke of their own colour. A residual of about 2/255 in an all-navy area remains in the headless SVG render; below 1 opacity faint seams can still show (documented on the control).
2. Fronts were visibly staircased and Chaikin corner cutting still left the stair rhythm and shrank tiny loops: replaced by shrink-free Taubin smoothing with fixed ends (a 4-cell loop keeps its size).
3. Only 1-2 of 14 visible spirals had a marked core: the 2 x 2 winding test misses relaxed spirals; the loop radius is now a control (default 2) and cores are clustered to one mark each.
4. A target stamp collapsed inward and left one flat colour (rings rose outward, so each was invaded from outside): states now fall outward and the wave runs outward, and the target is documented as one wave that sweeps the grid and settles.
5. The quadrant stamp jumped a quarter of the cycle between neighbours and froze completely (no cell had a successor neighbour): replaced by a triad of pinwheels.
6. Fronts in the invading state's colour vanished on a state fill: front colour is now a choice (invading state, darkest, lightest), default darkest.
7. Walls were the same navy as state 0: obstacle colour is now darker than the darkest or lighter than the lightest palette colour, or not drawn.
8. The first default (threshold 5 of 24 neighbours) collapsed the pinwheels into a few large flat domains by step 80; threshold 3 keeps the spirals winding to step 300.

## Timing (Node 22, this machine under load from other builds, null drawing surface, best of three)

| Case | Cold first draw | Palette edit | Steps - 1 | Steps + 5 | Structural edit |
|---|---|---|---|---|---|
| default, 96 columns, 70 steps | 33 ms | 1 ms | 16 ms | 14 ms | 16 ms |
| default columns, slider maximum 300 steps | 46 ms | 1 ms | 17 ms | 11 ms | 45 ms |
| slider maximum, 160 columns, 300 steps | 134 ms | 2 ms | 33 ms | 25 ms | 158 ms |
| slider maximum with Moore range 4 (80 neighbours), threshold 20 | 172 ms | < 1 ms | 6 ms | 6 ms | 264 ms |
| hard grid 240 x 240, range 2, 390 steps | 320 ms | 2 ms | 52 ms | 46 ms | 260 ms |
| random start, 160 columns, 300 steps, ring range 3, threshold 4, fronts and defects | 146 ms | 1 ms | 22 ms | 14 ms | 81 ms |

A first use of a new front smoothing or cell mark rebuilds that extraction for the cached grid (15-50 ms measured at the default and slider maximum); repeat edits of line weight, opacity or colour do not. Real-interface acceptance is not claimed.

## Open concerns and conservative choices

- Bounded grid only; a torus would remove edge effects but change the meaning of "bounded" in the brief. Hard-wall edges are visible in stripe runs (fronts leave the grid and the last band wins).
- The neighbourhood is a set of offsets, so a wall does not block a longer-range vote across it.
- The work bound over-estimates typical cost; it was kept predictable rather than tightened to measured speed.
- Fronts of earlier steps need an earlier grid each (replayed from the nearest checkpoint, at most 24 steps); 7 earlier fronts is a limit of the per-snapshot grid cache, not of the model.
- Period detection reports late by design (up to about twice start + period) and finds only the orbit it can see within `steps`.
- `regionFill` was not reused for state regions (see above); "regions select different fillers" is per-state hatching and the replaceable consumer.
- Pinwheels are placed at uniformly random positions and can overlap or be clipped by the grid edge; later seeds overwrite earlier ones where they overlap.
- Saved instruments name only bundled starts and obstacles; binding a user's mask or initial grid needs host work.
