# Pattern Competition (brief 18)

Status: **implemented on branch `w3/pattern-competition`, unreleased. Reviewed from rendered output and package tests only;
not exercised through the real Studio interface, not layered in the app.** It is a composition under the frozen
[composition boundary](composition-reference-slice.md), a stateful study on the [snapshot foundation](composition-snapshots.md)
(F7), and it consumes the [planar domains](composition-domains.md) raster conversion. It is a **2D pattern-formation model, not a
chemical or physical simulation** and not any published author's exact equations.

## Artist-facing brief

Large lobes containing smaller patterns, local symmetries and competing feature scales, instead of the single spot size of a
Gray–Scott system. Several scale pairs of activation and inhibition act on one field; at every cell the pair that disagrees least
updates it. The result is drawn three ways from one state: flat polygon bands coloured by the dominant scale, iso-contours of the
field through the path materials, and marks placed on the peaks and sized by the scale that dominates there. Steps scrub the
evolution; symmetry, boundary rule, scale set, weights and start are the construction.

**Distinct from Reaction Spots / Reaction Stripes** (`systems-a-quality.ts`): those run one Gray–Scott feed/kill pair on a fixed 24 × 24
grid for at most 256 passes, so one characteristic spot or stripe size follows from two coefficients, and draw discs or squares per
cell. Here the scale set itself is the input (2–8 activator/inhibitor radii on up to 192 × 192 cells), the update is a per-cell
selection among scales rather than a reaction, there is no feed/kill chemistry, and the output is a field, a dominant-scale label per
cell, contours, polygons and scale-sized marks.

## Frozen input contract

Instruments persist a technique id, scalar params and a palette. The library defines the typed values: `PatternModel` (+ seed + steps)
in; `PatternSnapshots`, `PatternView` (field, labels, scales, shares), `PatternPath[]`, `PatternSite[]` and `PatternBand[]` (planar
domains) out. The start is chosen from four bundled deterministic constructions (noise, spots, disc, ring) by a validated select;
**no asset is read**. Binding a user's own start field (a mask or raster) or a measured pattern to a Studio layer is future host work.

## Model (stated, not validated)

See the header of `composition/pattern-competition.ts`, which is the authority. In brief, on an `R × R` grid with `u ∈ [−1, 1]`:

| | |
|---|---|
| Scales | `S` pairs, i = 0 finest. Activator half-width `a_0 = smallest`, `a_i = max(a_{i−1} + 1, ⌈smallest · ratio^i⌉)`, inhibitor `b_i = max(a_i + 1, round(a_i · inhibitor))`, increment `d_i = increment · 2^(tilt·(2t_i − 1))`, `t_i = i/(S − 1)` (coarsest/finest = 4^tilt). |
| Blur | Box mean of half-width `r` (`2r + 1` cells), three passes in each axis by running sums. Outside the grid: `wrap` (torus), `mirror` (reflect, edge cell repeated), `void` (0). |
| Variation | `V_i = A_i − I_i`; the dominant scale is the `i` with least `|V_i|`; `|V| ≤ 1e-12` counts as 0, so ties, and flat regions, take scale 0 and +1. |
| Step | Synchronous: `u += sign · d_dominant`; symmetrise (orbit mean) inside each tile; normalise to exactly `[−1, 1]`; recompute dominant scale and sign. A state's labels are a function of its field. |
| Inert | A constant field (empty start) is frozen and drawn as nothing; later steps charge a scan only. This is the explicit termination. |
| Start | Noise `U[−1, 1]` per cell (`ctx.stream("cell:i", "noise")`); spots (`startCount` Gaussians of seeded position and sign, σ = startSize·R/4); disc (radius startSize·R/2); ring (mean radius startSize·R/2, half-thickness max(1.5, 15%)); the last three add noise. After step 0 nothing is random. |
| Symmetry | Exact on the lattice, per square tile (side `R/tiles`): mirror, half turn, both mirrors, quarter turns, eight-fold. |

`R`, `S` and `steps` are declared and bounded; the work of a step is charged honestly (`patternStepWork`: cells × (scales × 15 + 12)).

## Boundary

| Piece | File | Reuses |
|---|---|---|
| Model, snapshots, view, competing fields, contours, sites, bands | `composition/pattern-competition.ts` | `Simulation`/`createSimulationCache` (F7), `marchingSquares2D`, `contourChains`, `nonBranching` (exported from `nodal-plate.ts`), `clipPaths`, `rectangleDomain`, `labelDomains`, `PointGrid`, `componentSeed`, `cachedBy` |
| Composition, consumers, preparation | `composition/pattern-draw.ts` | `strokeWith`, `atEach`, `pathMaterial`, `motif`, `color`, `keyholeRing` |
| Instrument, controls, groups, conditions | `adapters/pattern-competition-instrument.ts` | |

No second stepping, caching or cancellation layer exists: `patternSnapshots` is `cache.get` and `preparePatternSnapshots` is `cache.prepare`.

## Semantics

- **Snapshots.** Keyed by `pattern-competition | model | seed | checkpointEvery | steps`, with `historyEvery: 0` (first and last
  projections only) and `checkpointEvery = max(25, ⌈R²/512⌉)`, a function of the model alone so a steps edit extends or replays the same
  run (a longer run reuses the shorter; a shorter one replays from its nearest checkpoint). Appearance never enters the key: a recolour,
  opacity, level, mark or material edit asks with the same params and receives the same `Snapshots` object (asserted by identity).
  The recipe drops hidden values (start shape values under a noise start, tiles under no symmetry) and the seed when nothing uses it
  (`usesSeed`), so hidden edits do not even fork the cache.
- **Published values.** `patternView(snaps)`: `values`, `labels`, `scales`, `shares`, `activity` (mean |Δu| of the last step), `inert`.
  `patternCompetingFields(snaps)`: the per-scale `V_i` of the final field (the fields whose smallest magnitude chose the labels).
  All cached on the snapshot object; typed arrays are private copies and must be treated as read-only.
- **Contours** (`patternContours`). Levels are explicit field values in (−1, 1). The grid is padded by one cell by the boundary rule,
  traced with marching squares (a sample equal to a level counts as high), each connected piece assembled separately by the existing
  chain assembler, cut at the footprint with the exact clipper, dropped below `minLength` cells. Ids `iso:<level>:<k>` (pieces `#n`),
  `Path.level` the value, `tone` = `PatternPath.scale` = the scale under most of the path's vertices. A piece over 2,200 segments is refused
  naming Resolution, Smallest contour and Levels.
- **Sites** (`patternSites`). Candidates are cells with `u ≥ level` in descending `u` (ties: lower cell); greedy acceptance unless an accepted
  site lies within `gap · (d + d′)/2` (diameters `d = size · radius/coarsest radius`), with a `PointGrid`. Ids `cell:<i>`, `scale` = d/size,
  `tone` = scale, `angle` = level-line direction. At most 40,000 (Mark size, Mark gap, Mark level named).
- **Bands** (`patternBands`). `labelDomains` over `label + 1` where `u ≥ level`: per-scale planar domains with holes, cell-edge boundaries
  thinned by `smoothing` (topology-preserving, shared edges stay shared), `minArea` drops specks. Areas equal cell count × cell² without smoothing.
- **Failure and limits (named in the message).** Grid 24–192 (slider 48–120 in twelves), scales 2–8, steps ≤ 2,000, tiles 1–4 dividing the
  grid, inhibitor radius ≤ 2 × grid, start size ≤ 1.5, spots ≤ 64, contour levels ≤ 12 and strictly inside (−1, 1), total work ≤ 1.5 × 10⁹
  cell reads (a run that exceeds it fails before any step, naming Steps, Resolution and Scales). Nothing is truncated.

## Controls, groups and conditions

Groups: **Scales** (count, smallest scale, ratio, inhibitor reach, nested *Weights*: increment, tilt), **Start** (start, size, spots, noise),
**Evolution** (steps, resolution, boundary, nested *Symmetry*: symmetry, tiles), **Placement** (center, size), **Bands**, **Contours**, **Marks**
(nested proportional *Scale*: size and line weight; nested *Shape*: petals, opening). Proportional only where two lengths in canvas units
scale together; nothing in the model groups is proportional (counts and radii in cells mix units). Inline `visibleWhen`: start size follows
disc/ring/spots, spots follow spots, start noise follows spots/disc/ring; tiles follow a symmetry; band controls follow bands; contour controls
follow contours (weight for ink/stitch, spacing for stitch/beads, bead for beads); mark controls follow marks (line weight for ring/rosette/arrow,
petals for rosette, opening for ring/rosette, follow for rosette/arrow). Slider intervals differ from hard limits (resolution 48–120 vs 24–192,
scales 2–6 vs 2–8, steps 0–400 vs 2,000, ratio 1.3–2.6 vs 1.05–4, band level −0.6–0.6 vs −1–1). The full control audit (`tests/helpers/audit-controls.ts pattern-competition`) was started but not finished: every probe is a model run, and on the loaded shared machine it did not complete in over an hour. It was stopped and is **not** claimed; the hidden-control property test in the suite (each declared condition's hidden controls changed on a small grid, fingerprint unchanged; visible controls change it) is the evidence.

## Checks (`tests/composition-pattern-competition.test.ts`, 21 tests)

Independent expectations: an independent naive reference (nested loops, three passes, orbits as sets) reproduces every step of eight
configurations (each boundary rule, each symmetry, tiles 1–4) to 1e-9 with equal labels; the scale set at hand-computed radii
(`[2,4,8,16]`, `[1,2,3,4]`), increments 4^tilt; the published competing fields against the reference blur and labels as their argmin;
exact `[−1, 1]` span at every step; exact tile-wise invariance of field and labels under every group (and non-invariance when unforced);
a centred disc evolves identically with and without the eight-fold constraint; the update commutes with translation (wrap), reflection
and transposition (all boundaries); a symmetrised start equals the normalised orbit mean of the free start; a flat region takes scale 0
and +1; disc and ring starts cell by cell; the foundation's `checkSimulation` (replay, prefix, resume, spacing, cancellation); the inert
termination (frozen, cheap, empty for every consumer, nothing painted); appearance edits keep the same snapshot, contour, band and site
objects while eleven initial-condition edits give eleven different fields; cancellation at the start and mid-run caches nothing and the retry
equals a fresh run; every contour vertex on a grid line at the level by interpolation (thousands of vertices); a binary disc's level line is
one closed loop of the digital-circle length; band areas equal cell counts exactly and partition by scale; marks are a maximal, gap-respecting
packing with the top cell accepted, ids, scale-proportional diameters and perpendicular angles; the coarsest scale's patches average more
than 1.5× the finest's across four seeds; coupling controls change the labels; named errors; hidden controls never change a fingerprint and
visible ones do; the seed matters exactly where declared; transparency and preparation. **Mutations that each fail at least one test (14 tried,
all killed):** tie to the last scale, normalise to [0, 1], two blur passes, mirror boundary off by one, tilt sign flipped, inert state not frozen,
labels not made symmetric, orbit mean replaced by one member, marks visited lowest value first, mark angle along the gradient, seed ignored,
hidden start size read, bands ignoring the dominant scale, half-cell contour shift. Two survived the first suite (last-scale tie, orbit mean) and
produced the flat-region/orbit-mean test.

## Review record

Rendered through a throwaway SVG surface under the native render lease: defaults on three seeds; steps 0, 8, 30, 60, 120, 250, 400, 1000; twelve
strongly different settings (eight-fold disc; quarter-turn ring on a mirror boundary; two-by-two tiles of both mirrors; void boundary with
spots; six scales at grid 120; three scales with tilt 2; five fine scales with tilt −2; a sparse stitched accent with a few rings; grid 192 with eight
scales and small marks; pale bands with beads by scale and aligned rosettes; aligned arrows alone; wide flat bands at smoothing 2); a
contour-only sheet; and three layered pairs in both orders with unmodified Motif Ecologies, Dry Bristles and Contour Scores. The images were read.
Defects found and fixed:

1. Flat regions decided their sign by floating rounding (found by the failing test that a symmetric disc evolves alike with and without the symmetry
   constraint): differences within 1e-12 of zero are now exact ties (finest scale, +1), stated in the rule.
2. The first blur used column-strided padded lines and took 3.4 ms per step at grid 96; rewritten to slide whole rows for the vertical pass (1.2 ms,
   identical results, checked by the same reference test).
3. The first defaults had stair-stepped band edges, tiny brick-like contour loops around single cells and a plain stripe structure with little nesting:
   band smoothing 1, smallest contour 6 cells, and the default scale set (finest 3, ratio 1.7, tilt −0.5) chosen from nine candidates because fine rings
   and medium loops sit visibly inside the broad lobes.
4. The first inhibitor bound (window ≤ grid) rejected plausible slider combinations (six scales at the default grid); it is now twice the grid.
5. `marchingSquares2D` rejects typed arrays; the padded grid is converted (found on the first render).
6. Noted, not changed: contours at step 0 are speckle by design (noise start); a box kernel gives diagonal streaks at tilt 0 with fine scales and
   inhibitor reach near 1.5; tiles ≥ 2 give hard seams where neighbouring tiles' dominant scales differ (the tiles interact only through the blur);
   smoothing 2 leaves thin shard triangles.

Timings (Node 22, this machine, null surface, milliseconds; first draw includes the model, contours, bands and marks): see the table.

| Case | First draw | Appearance edit | Structural edit (tilt / seed) | Steps +1 | Steps −30 (checkpoint replay) | Level edit (no model) |
|---|---|---|---|---|---|---|
| Default (96², 4 scales, 120 steps) | 258 | 12 | 190 / 179 | 60 | 68 | 6 |
| Slider maximum (120², 6 scales, 400 steps, marks on) | 1,358 | 6 | 1,376 / 1,326 | 28 | 95 | 2 |
| Hard limits (192², 8 scales, 300 steps, marks on) | 2,694 | 32 | 2,840 / 2,692 | 421 | 764 | 53 |

Measured on a loaded shared machine, best guess of typical cost, not certified. A structural edit reruns the model (about 2.5 ns per cell read); the appearance edit
and a level edit reuse the cached snapshot and products. A steps edit costs the new steps or one checkpoint interval.

## Open items

- Real Studio interface exploration, layered review in the app and responsiveness were not done.
- The blur is a box (three passes), not a true Gaussian: fine-scale structure has a slight diagonal bias.
- Only the four bundled starts exist; a user mask or raster as the initial field, and using the field as a density for Motif Ecologies or orientation for
  stitching from a Studio binding, are host work (the values are published; the descriptors are not).
- Patterns keep evolving slowly; there is no convergence detector beyond `activity`, only the inert (constant) termination.
- Work and slider bounds derive from measurement on one machine.
