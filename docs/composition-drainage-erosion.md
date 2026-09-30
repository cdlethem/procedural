# Drainage and erosion fields (brief 45)

Status: **implemented on branch `w3/drainage-erosion`, unreleased.** Instrument `drainage-erosion` ("Drainage and Erosion"), guide
`packages/instruments/guides/drainage-erosion.md`. It is a W3 stateful study: the model runs through the F7 `Simulation` API
([snapshots](composition-snapshots.md)); nothing here adds a stepping, caching or cancellation layer.

Honest scope: a **2D model** of the transport/update relationship (stream power, carry-and-drop deposition, hillslope diffusion) on a square
grid. It is not a calibrated landscape-evolution code, not physically accurate and not a hydrological prediction. Ordinary octave noise is only the
starting land; the computation is routing, accumulation and the erosion update.

Code (`packages/instruments/src/`): `composition/drainage-flow.ts` (outlets, Priority-Flood, D8, accumulation), `terrain.ts` (initial land, rain,
bedrock), `drainage-erosion.ts` (the simulation), `drainage-network.ts` (routing product, stream graph, basins), `grid-contours.ts` (linear-time
marching-square chains), `drainage-shade.ts` (hillshade bands, lakes, basin colours), `drainage-settings.ts` (controls → construction and view),
`drainage-draw.ts` (composition, products, consumers, preparation), `adapters/drainage-erosion-instrument.ts` (definition). Tests:
`tests/composition-drainage.test.ts`.

## Units and grid

The longer side of the grid is 1: spacing `h = 1 / max(columns, rows)`, cell area `h²`; elevation, area and volume use that unit. The instrument
maps the grid to the canvas with `footprintFor` (`cell = max(width, height) / resolution`; the shorter side snaps to whole cells; the footprint is
exactly `columns × cell` by `rows × cell`). Resolution is a real control (4 ≤ columns, rows; at most 262,144 cells; slider 48–140, hard 24–384).

## Model, in update order (one step, synchronous)

1. Fill depressions of the terrain `z` into `F ≥ z` (Priority-Flood with epsilon 1e-7, seeded at the outlets, flooding over the 8-neighbourhood;
   `F[n] = max(z[n], F[c] + ε)`).
   **Tie rule:** the queue orders by `F` then by queueing order (first in, first out); outlets are queued ascending; neighbours in the order E, SE, S, SW,
   W, NW, N, NE. The pop order is returned and is a topological order. Consequences (tested): `F ≥ z`; every non-outlet cell has a strictly lower
   neighbour on `F` (no sinks or flats, so no cycles); a pit fills to its spill level plus ε per cell flooded.
2. D8 receiver: steepest descent on `F` (diagonal distance `√2`), ties to the first neighbour in the same order. Discharge `A` = rain accumulated
   upstream (rain multiplier of mean 1) × `h²`.
3. Walking from the highest `F` to the lowest: `q = A^m S^n`, erosion `E = min(K q, max(0, z − F_receiver))` (never below the receiver's filled
   level), capacity `carrying · K q · A`, `out = load + E h²`, deposit `D = min(deposition · max(0, out − capacity) / h², room)` with room the lowest filled
   elevation among donors minus `z` (a lake bed rises at most to the lake surface); the rest is carried on. `K = erodibility (1 − contrast · hardness)`. Lake cells have almost no slope so they neither
   erode nor pass sediment on; they trap it.
4. `z += D − E + uplift · ramp`; outlets stay 0. `ramp` is the coastal ramp (0 at outlets, smoothstep to 1 over 0.3 of the map), so uplift does not build a cliff.
5. Creep: explicit diffusion `κ = creep · 1e-5` between non-outlet 4-neighbours in `ceil(4κ/h² / ½)` sub-steps (at most 64), each a convex average; pairs
   exchange equal and opposite amounts.

**Mass ledger** (in the state, tested to rounding error, seven configurations): Δ(Σ z h²) = uplifted − eroded + deposited, and exported = eroded − deposited
(sediment reaching an outlet leaves the model). Fill and creep never change the total. Erosion alone never raises ground and settles (the state records the
largest change of the last step; `hasSettled`). With nothing to do the first step is already a fixed point; with uplift it settles only where erosion
balances uplift. There is no separate "no growth possible" condition beyond this: a run with steps requested beyond a fixed point simply keeps the same state.

## Stream graph, basins, contours

- Stream cells: flow ≥ threshold × total rain (threshold 0.1–4 % on the slider). Nodes: sources, confluences, mouths (outlets). Reaches run between nodes.
  Stable ids from cells: node `n:<cell>`, reach and graph edge `e:<upstream node cell>`, basin `b:<reach id>`. The published `Graph` is directed downstream
  (`graphFromParts`), edge weight = flow share, age = Strahler order. Reach paths follow cell centres and are smoothed by fixed-end corner cutting, so reaches
  still meet exactly at nodes.
- Basins: each cell belongs to the reach it first drains into; `depth` picks which reaches root a basin (depth 0: reaches ending at an outlet). Basins holding
  less than 3 stream thresholds of rain merge into the basin downstream (a root that small is unlabelled). The label grid goes through `labelDomains`
  (planar regions with holes; shared boundaries coincide exactly) with topology-preserving simplification of 1.5 cells.
- Contours: `gridContours`, a table-lookup chain assembler (the older assembler is quadratic and capped at 2,200 segments a level); watertight, saddle by
  cell mean; ids `contour:<level>:<smallest edge id>`. Drawn by `pathMaterial` ink; index contours heavier.
- Hillshade: central-difference slopes → the existing `shadeSlope` → the same nested level-set polygon bands and `ShadedPatch` shape as Stroke Relief,
  painted by its `shadedPatch` consumer. Lakes: contour of `(filled − z)/max z` as planar regions.

## Treatments of one state

Contours, rivers (ribbon by flow, or `pathMaterial` ink/stitch/beads by order), basin wash/hatch/divides, lakes, node marks (`motif` through `atEach`) and
hillshade all read the same retained snapshot; each is a frozen value cached on the snapshot's height array and its own options.

## Snapshots, keys and recompute

Construction (the cache key) is grid, landform, water, bedrock and erosion settings, steps and seed. Hidden controls are normalised so they neither key nor draw
(roughness for noise only, rain contrast/angle/storms by mode, bedrock settings by kind, carrying with no deposition; the seed is 0 for a fully deterministic
construction). Palette and every view control (contours, shading, streams, basins, lakes, marks) never reach the run: a recolour asks the cache with unchanged
params and receives the **same `Snapshots` object** (asserted by identity). Retention: checkpoints every 25 steps, history only first and last. Scrubbing steps
up extends a cached run; down replays from the nearest checkpoint. Cancelled preparation caches nothing (`prepareInstrument` returns false).

## Bounds (all throw, naming the control)

`steps ≤ 5000`; work `cells × 6 + steps × cells × (8 + creep sub-steps) ≤ 150,000,000` (names steps, resolution, creep); creep sub-steps ≤ 64 (creep or
resolution); contour levels ≤ 200 and vertices ≤ 1,500,000 (contour interval, resolution); shading vertices ≤ 800,000; stream cells ≤ 60,000 and graph size
(stream threshold); hatch strokes ≤ 150,000 (hatch spacing).

## Measured (Node 22, null surface; ms)

**Measurement caveat.** The machine was not idle: the load average was 75–90 (24 cores shared with other agents) during the re-measurement, which inflates wall time three- to fourfold. The table gives
CPU time (`process.cpuUsage`) and the wall time seen, and states the calibration used to estimate idle wall time: the configuration measured earlier on a quiet machine at 1.3 s wall
(140², 250 steps, creep 1.5, all treatments) cost 3.1 s of CPU under this load, a factor of about 2.4. Idle figures below are CPU divided by that factor and are estimates, not idle measurements.

**Cost structure.** The simulation is 75–80 % of the time at the corner (one step is a fill, a route, an accumulation and a creep pass over every cell); the treatments (contours, shading bands, streams,
basins, lakes) are 20–25 %. A real canvas adds the cost of painting about 50,000 vertices and 900–1500 shapes, which is the same at the default and at the corner (counted: 56,082 vertices at the default,
50,057 at the all-maximum corner), so the slider corner is limited by the simulation.

Every treatment on. A structural edit is a full run of a new construction.

| Case | first draw (cpu / wall seen) | structural edit (cpu / wall seen) | estimated idle |
|---|---|---|---|
| default: 112², 120 steps | 544 wall on a quiet machine | 501 wall on a quiet machine | 0.5 s |
| **every numeric control at slider maximum** (resolution 128, steps 200, creep 1.5 → 3 sub-steps, shading depth 8, stream threshold 4 %, and so on) | 2197 / 3398 | 2095 / 2267 | about 0.9 s |
| every slider at its maximum, with the costliest treatment drivers instead (finest contour interval 0.006, threshold 0.1 %, hatch 2, shading depth 8, lake depth 0.002, beads at spacing 3, smoothing 4, basin detail 4) | 2523 / 9826 | 2440 / 2695 | about 1.0 s |
| every numeric control at slider minimum, finest treatment drivers | 316 / 363 | 178 / 151 | 0.15 s |
| hard corner, shading off: 384², 100 steps, creep 0 | 4659 wall on a quiet machine | 4640 | 4.7 s |
| hard corner with the default shading depth | refused: "Shading would draw more than 800000 polygon vertices; lower the resolution or the shading depth" | | |

Scrubbing `steps` reuses the cached run: +5 steps costs 45–100 ms at the default and corner sizes, −1 step costs one checkpoint interval.

**Slider intervals versus hard limits.** The slider intervals of the cost drivers were narrowed twice. First (200² × 300 steps took 3.6 s and 200² × 300 × creep 4 was refused outright): resolution 48–140, steps
0–250, creep 0–1.5. Then, after the real interface showed 5.5 s with every range control raised at once (the second corner also raises every drawing control and the storm and bedrock settings, which the first did
not): resolution 48–128 (hard 24–384), erosion steps 0–200 (hard 0–5000), creep 0–1.5 (hard 0–100; at most 3 sub-steps on the slider, 64 at the hard limit). The drawing controls needed no narrowing:
none of them costs more than a fifth of the corner, and each drives its own named bound (contour levels, shading vertices, stream cells, hatch strokes). A test draws every numeric control together at
slider minimum and at slider maximum, and both again with the finest treatment drivers, and requires all of them to validate and draw; it also requires at most 3 creep sub-steps and under a quarter of the work bound.
Exact entry beyond the slider stays valid up to the hard limits and the work bound (150,000,000 units: 384² × 100 steps with no creep is inside it; 384² × 130 steps is refused, naming steps and resolution).

## Looked at (rendered through the SVG surface, Chromium under the render lease; not real-interface acceptance)

Defaults at seeds 42, 7 and 1234567; six strongly different structures (dome to all edges with hatch basins and ink streams; ridge with storms and divides
only; escarpment over hard layered bedrock; noise to a single outlet with deposition; slope exponent 2 to side outlets with beads and marks; gradient rain
over blob bedrock with stitches); steps 0, 12, 40 and 300; sparse (48², threshold 4 %) and dense (200², threshold 0.1 %); combined ghost contours, hatch, marks and
lakes; no uplift; high creep with uplift; and the drainage layers over and under Motif Ecologies and Optical Plates, in both orders.
Defects found and fixed: (1) terrain ended in a cliff at the outlets, which uplift then made a wall: added the coastal ramp to terrain and uplift; (2) the first
defaults (relief 0.3, erodibility 0.05) eroded to a few parallel gullies: lowered erodibility and creep and raised uplift so the defaults show branching valleys at
120 steps; (3) hundreds of one-cell basins shattered the wash: basins under 3 stream thresholds merge downstream; basin outlines simplified by 1.5 cells; (4)
erodibility, creep and contour interval slider ranges were far too wide for the model and were narrowed to the observed useful span (hard limits stay wide).
Remaining visible artefacts: D8 routing leaves a fringe of short parallel streams along an open outlet edge and parallel rills on very smooth planes (high creep with
uplift); stitch and bead streams are thin and pale against a wash; unlabelled tiny root basins leave straight-edged gaps in the wash on a single-outlet map.

## Checks

`tests/composition-drainage.test.ts` (40 tests, independent expectations): priority flood against a hand-derived pit and an independent minimax spill; no cell lower than its
receiver and a valid topological order in all four outlet modes; D8 steepest descent with the diagonal weight and every tie; accumulation against a per-cell walk and conservation at the
outlets; closed-form plane and dome terrain, rain mean exactly 1, gradient direction; stream power `K A^m S^n` on a plane for three exponent pairs; the erosion floor; carry-and-drop deposition
cell by cell; lakes neither erode nor rise above their surface; creep of a spike and an independent multi-sub-step diffusion with exact mass; the mass ledger over five configurations and
40 steps; monotone settling; `checkSimulation` (replay, prefix, checkpoint spacing, resume); bound errors naming their control; contours of a ramp (exact position) and a cone (closed rings,
vertex count = crossed edges), saddles, and a 220² noisy level; hillshade sides; lakes; basin colouring; a hand-made Y network (ids, Strahler, weights), smoothing endpoints, basin merging; on
eroded terrain flow = rain + donors, reaches partition the stream cells, every basin cell drains to its river's mouth; snapshot identity under palette and view edits (by reference), recompute for
initial-condition edits and reuse for hidden ones, scrubbing, cancellation caching nothing, the definition's conditions and slider intervals, footprint arithmetic.

Mutations confirmed to fail (each by at least one test): D8 tie taking the last neighbour; fill without the epsilon rise; diagonal distance ignored; erosion allowed below the receiver;
deposited sediment still carried on; creep share halved wrong; saddle decided the other way; Strahler order raised by every confluence; a hidden bedrock scale reaching the key.
