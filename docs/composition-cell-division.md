# Cell Division (brief 20)

Status: **implemented on branch `w3/cell-division`, unreleased. Reviewed from rendered output only; not yet
exercised through the real Studio interface, layered in the app, or reviewed for responsiveness there.** Built on
the [stateful snapshot foundation](composition-snapshots.md) (F7), the graph, density-contour and planar-domain
values and the stock `motif` / `pathMaterial` consumers. Guide: `packages/instruments/guides/cell-division.md`.
Code: `composition/cell-division.ts` (model), `composition/cell-division-draw.ts` (treatments, recipe, draw,
prepare), `adapters/cell-division-instrument.ts` (controls); tests `tests/composition-cell-division.test.ts`.

## Artist-facing brief

A colony of discs eats a diffusing, consumed nutrient, grows, divides into two daughters and pushes its neighbours
aside. Sizes and generations record where the food was. One colony feeds four treatments: cells (`motif`), the
division tree (a `Graph`, drawn with `pathMaterial`), contours of the remaining nutrient (`densityContours`) and
each cell's territory (`voronoiCells2D`, outlined and/or hatched with `hatchDomain`, hatch direction turning per
generation). Colour is generation, age, size or founder; an age window hides cells without moving anything.
Honest scope: a flat 2D cellular model, not biology or physics; the separate 3D surface-growth brief is not
attempted.

## Model (frozen; stated in the header of `cell-division.ts`)

Local frame: canvas units, origin at the dish's top-left, y down; placement on the canvas is a translation applied
at draw time and is not construction. Nutrient is in **area units**: one unit becomes one canvas unit squared of
cell area (yield 1). One step, synchronous rules reading the old state:

1. **Growth.** A cell below the division radius `R` claims `uptake` of the nutrient on the field cells it covers.
   Coverage of a field cell is `clamp(0.5 + (max(r, 0.71 c) - d) / c, 0, 1)` (`d` centre distance, `c` field cell)
   scaled so the shares add up to the disc's own area `pi r^2` whatever `c`; cells outside the wall are counted in
   the scale and not returned (a disc at the wall reaches only the nutrient inside it). A field cell claimed by more
   than one unit is shared in proportion; a cell never grows past `R` and takes only what it can use
   (`r' = sqrt(r^2 + gain / pi)`). Order independent.
2. **Diffusion.** `diffusion` is a diffusivity in canvas units squared per step, spent as `ceil(D / (0.25 c^2))`
   passes of the masked five-point stencil (no flux at walls), each a convex average, so mass is conserved and the
   field resolution changes accuracy, not speed.
3. **Sources.** Source cells are reset to concentration 1; the added nutrient is counted in `inflow`.
4. **Division.** Sequential, ascending id, while the live count is below the limit. A cell with `r >= R` is
   replaced by two daughters with fresh ids `cell:n`, `cell:n+1` from the birth counter in the state. Areas
   `f r^2` and `(1-f) r^2` (`f` = *Split*), touching, on the axis with the larger daughter leading, centre of area
   at the mother's centre. Axis: random, along/across the local gradient, radial/tangential to the colony centroid,
   or fixed, plus a jitter, each drawn from the mother's own stream (`ctx.stream("cell:k", "axis" | "jitter")`).
   The mother is kept as an ancestor (position, radius and step at division): lineage is never lost.
5. **Relaxation.** `relax` synchronous passes; neighbours from a `PointGrid`; two cells closer than
   `(r1 + r2)(1 - overlap)` are pushed apart along their line, each by `stiffness x overlap x (other's area share)`,
   summed, capped at half the radius and held inside the wall (whole disc inside the box or ellipse).
6. **Status.** *Full*: live count reached the limit. *Settled* (halts; later steps are the identical state): full,
   every cell at `R`, nothing moved more than 1e-4. *Starved* (halts): no source and less than 1e-6 nutrient left.

Ids never repeat; parents are older than daughters; `cell:k` is born once. Cells never disappear: relaxation only
moves, and the wall constrains rather than deletes. Growth adds area in place, so a colony under pressure overlaps by more
than `overlap` (the push is capped per pass and travels one neighbour per pass): measured at the default, 321
cells, 744 overlapping pairs, mean overlap 12% and worst 32% of `r1 + r2`; 8 passes at stiffness 1 bring the mean to
7%. A dish too small for the cell limit (1,000 cells of radius 13 need 1.75 times the area of a 620-unit dish)
overlaps by about 23% on average; cells are compressed, never removed.

**Declared quantities (tests):** cell area + field nutrient = initial + `inflow` at every step; `absorbed` equals
the area gained; division keeps area and centre of area; live count grows by exactly one per division and births by
two; the state after `k` steps is a prefix of the state after `k + m`.

## Construction, appearance, seeds

`cellColony(options, seed, steps)` returns a frozen `Colony`: `cells`, `ancestors`, `lineage` (a directed `Graph`,
edge weight = area share, age = steps since birth + 1), `field` (a `DensityField`, concentration as a fraction of
the supply), `totals`, `status`, `snapshots`. It runs through `createSimulationCache` (capacity 6, checkpoint every
25 steps, history every step: totals per step). Construction is `ColonyOptions` only; palette, colour rule, marks,
age window, lineage/nutrient/wall settings and the placement never enter the key, so an appearance edit returns the
identical `Snapshots` (asserted by identity). Hidden controls are pinned by `colonyConstruction` (an unused source
direction, a jitter under a random axis, a seed angle under scatter) so they cannot change the drawing, and the seed
is dropped from the key where no stream is drawn (`colonyUsesSeed`; `usesSeed` follows). More steps extend a cached
run, fewer replay from the nearest checkpoint; `colonyAt(colony, k)` scrubs history.

## Bounds (each names its control)

Field <= 62,500 cells (*Field cell*, *Width*, *Height*); diffusion <= 64 passes and 800,000 cell updates per step
(*Diffusion*, *Field cell*); *Cell limit* <= 2,000; *Steps* <= 1,000; declared work per step
`passes x open cells + limit x (footprint candidates) + relax x limit x 100 + ...` charged with `ctx.charge`, over
which a step throws naming *Cell limit* / *Field cell* / the dish size; total work <= 1.5e9; walls <= 2,000 cells.
Slider intervals are narrower than the hard limits and every combination inside them is admitted (see Timing): the worst slider corner passes validation and prepares in about 1.5 s.

## Controls and groups

Sections: **Nutrient** (source, direction, distance, size, reserve, diffusion, field cell), **Placement** (centre
X/Y; proportional *Size*: width, height), **Seed cells**, **Growth** (proportional *Radii*: start, division; uptake,
cell limit), **Division** (split, axis, fixed axis, jitter), **Mechanics** (boundary, overlap, stiffness,
relaxation), **Time** (steps), **Age selection**, **Color**, **Cells**, **Lineage**, **Nutrient lines**, **Walls**.
Inline `visibleWhen`: source direction by edge/point/pair; distance by point/pair; source size by any source; seed
angle by cluster/ring/line; fixed axis by `fixed`; jitter by every axis but random; cell size/weight by the cell
style; lineage controls by the lineage material; nutrient controls by contours; wall controls by the wall style.

## Checks

`tests/composition-cell-division.test.ts` (30 tests), independent closed forms and invariants: first-step radius
`r0 sqrt(1 + uptake c)` and identical on three field resolutions; conservation at five steps on a fed dish;
division area, centre of area, touching, axis placement and ids; id density and lineage order; relaxation of equal
cells `10 - 6 (0.5)^passes` and unequal cells by the other's area share; cells never vanish and stay inside box and
ellipse; cell-limit termination and stationarity; starvation and exact conversion of a finite reserve to area;
axis rules and source-side lean; split shares; `checkSimulation` on two constructions; scrubbing against fresh
runs and the prefix property; cancellation leaving no cache entry and extension costing only new steps; identity
of the snapshot under 16 appearance edits and pinned hidden controls, recompute for 11 construction edits and the
seed; placement as a pure translation; every bound naming its control; diffusion units; lineage graph; age window;
colour ramps; walls tiling the dish (areas sum to `w x h`) and holding only their own centre; hatch length against
`area / spacing` and the twist per generation; contours inside the wall and equal to the level on the field;
drawing counts; consumer substitution; cooperative preparation and cancellation.

Mutations confirmed to fail (each by 1 to 29 tests, run on a copy of `dist`): growth not shared by claims; footprint
not normalised to the disc's area; daughters not conserving area; daughters centred on the wrong point; relaxation
weighted by radius instead of area; a daughter reusing the mother's serial; a diffusion coefficient doubled; source
inflow not counted; no halt when full and stationary; cells allowed past the limit; the age window boundary changed;
hatch direction ignoring the generation twist. (The shared cache's cancellation and identity guarantees are the F7
ones; `checkSimulation` runs on this model.) Full suite after merging main: 1,073 tests pass.

## Review record

Rendered with a throwaway SVG surface under the native render lease: defaults at three seeds and at early, middle
and late steps; sources ring/edge/point/pair/none; every division axis; scatter/ring/line/cluster seeds; sparse
(few cells, starved) and dense (700 cells, full) colonies; walls outlines/hatch/both, nutrient contours and
lineage combined; and a layered composition with an existing instrument in both orders. Defects found by looking
and fixed:

- a dense colony drew a 4-pole artefact of contour fragments along the wall: fixed as above;
- the slider maximum (diffusion 400 at field cell 5 on a 620 dish) was refused by the diffusion bound: slider floors and maxima tightened so every slider combination is admitted;
- first default barely grew (three cells, no division): uptake, reserve and step defaults raised until the front reaches about 545 cells by step 230;
- sizes were identical once the dish filled; the size colour ramp was against the division radius and showed one colour: it now spans the colony's own smallest to largest;
- a disc smaller than a field cell fell between grid centres and could not eat: coverage uses a kernel of at least 0.71 cell;
- seeded chains reached the wall with uniform radii, hiding the food gradient: lower uptake defaults and slider floor;
- nutrient contour fragments and a staircase along the wall: field extended past the wall and contours cut at the wall inset by half a field cell;
- lineage lines over discs hid the cells: default links are one thin colour.

## Timing (Node, null surface, lightly loaded shared machine; draw cost in a real p5 canvas is higher)

Slider intervals of the cost drivers are chosen so the worst slider corner prepares in about 2 s: **steps 0 to 400,
cell limit 30 to 600, relaxation 1 to 5, field cell 6 to 16, diffusion 10 to 300, dish 200 to 620, seed cells 1 to
24**. Hard limits stay high for exact entry (steps 1,000, cell limit 2,000, relaxation 16, field cell 1, diffusion
100,000, dish 2,000) and stay bounded: over the 1.5e9 declared-work bound, or the field or diffusion bound, the
entry is refused by name. A test checks that every combination of the slider ends of nine cost drivers passes
validation and stays inside the work bound (it found one real hole: a 24-seed slider end against a 20-cell
limit floor, now 30).

| Case (every treatment on: contours, walls with hatch, lineage ink, discs) | First prepare and draw | Redraw | Palette edit | Appearance edit | `steps` ± few | Structural edit |
|---|---|---|---|---|---|---|
| Default (230 steps, about 545 cells) | 0.2 to 0.3 s | 3 ms | 3 ms | 40 ms | 90 to 120 ms | 60 to 360 ms |
| Worst slider corner (400 steps, 600 cells, 620 dish, field cell 6, diffusion 300, relaxation 5, uptake 0.3; about 66,000 draw calls) | 1.5 to 1.7 s | 9 ms | 9 ms | 50 to 60 ms | about 0.4 s | 1.4 to 1.7 s (source change) |
| Same corner, draw side extreme (wall reach 4, hatch 2, 12 contour levels, beads every 3; about 247,000 calls) | 1.6 s | 27 ms | | 80 ms | | 1.5 s |
| Hard limits, admitted (1,000 steps, 2,000 cells, 620 dish, field cell 6, diffusion 300) at relaxation 1 / 2 / 3 | 5.7 / 9.9 / 23 s | 15 to 23 ms | | about 0.5 s | | 6.8 / 11 / 15 s |
| Hard limits, relaxation above 3 | refused: declared work exceeds 1.5e9, message names steps and the model's size | | | | | |

Before narrowing, the old slider maximum (500 steps, 1,000 cells, relaxation 6) took 4.6 to 7.4 s for the first draw and
4.2 to 4.4 s for a source change. Relaxation is the cost (neighbour queries on every pass), then the cell count, then
steps. A structural edit recomputes the whole colony; a palette or appearance edit never does. Cooperative preparation
yields between step slices and cancels cleanly.

## Open concerns and decisions to confirm

- Lineage lines join the mother's division point to the daughter's *current* position, so in a colony pushed hard by relaxation they are long. A per-step position history would draw the path taken; not built.
- Persisted instruments carry scalar controls only; a user-drawn nutrient map or seed layout needs a host asset field.
- Model choices made without confirmation: yield 1, footprint coverage kernel, colony-centroid axis for radial/tangential, halting on settle rather than running on.
- Real-interface acceptance, layered work in the app and interaction cost are root's to exercise.
