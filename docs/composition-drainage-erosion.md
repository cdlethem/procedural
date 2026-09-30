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
exactly `columns × cell` by `rows × cell`). Resolution is a real control (4 ≤ columns, rows; at most 262,144 cells; slider 48–200, hard 24–384).

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
   elevation among donors minus `z`; the rest is carried on. `K = erodibility (1 − contrast · hardness)`. Lake cells have almost no slope so they neither
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

## Measured (Node 22, this machine, null surface; ms)

| Case | first | appearance edit | extraction edit | structural edit | steps −1 | steps +5 |
|---|---|---|---|---|---|---|
| default, 112² × 120 steps | 486 | 6 | 6 | 438 | 93 | 38 |
| 112² × 300 steps (slider max) | 544 | 2 | 4 | 936 | 94 | 42 |
| 200² × 300 steps (both slider maxima) | 3037 | 6 | 10 | 2996 | 291 | 104 |

The hard limits (384², 100 steps) exceed the work bound and are refused. A structural edit costs a full run; scrubbing costs only new steps or one checkpoint interval.

## Limits and not done

Not a physical model; D8 routing has grid-aligned artefacts (visible as straight runs and a fringe of short parallel streams along an open edge); no
multiple-flow-direction routing; no lake outflow bookkeeping beyond the epsilon fill; no host-supplied height raster or rain map (future host work: saved
instruments name only bundled landforms and scalar controls). The typed simulation accepts any `ErosionParams`; a resolved height input would replace `initial`.
