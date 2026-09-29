# Random Walk Fronts (brief 21)

Status: **implemented on branch `w3/random-walk-fronts`, unreleased.** One instrument, `random-walk-fronts`
("Random Walk Fronts"), built on the stateful-snapshot foundation ([F7](composition-snapshots.md)), the planar-domain
foundation ([F4](composition-domains.md)) and the bundled rasters ([raster structure](composition-raster-structure.md)).
Code: `packages/instruments/src/composition/{walk-grid,walk-fronts,walk-fronts-products,walk-fronts-draw}.ts`,
`src/adapters/random-walk-fronts-instrument.ts`; guide `guides/random-walk-fronts.md`; tests
`tests/composition-walk-fronts.test.ts` (25).

**Scope, stated plainly.** A 2D lattice model of stochastic region visitation, after the flood-fill-by-random-walk idea in
Sighack's comparisons. It is not water or pigment transport (Wet Blooms), not physical growth, and colours never mix.
The rules below are this study's own frozen choices, not a reproduction of any artist's code.

## Model (frozen)

Grid: `columns × rows` cells (≤ 100,000; each side 4 to 400), each *allowed* or not (the region minus barriers). Cell `(x, y)`
has its centre at `(x + ½, y + ½)`; y grows down. Neighbourhood 4 (E, S, W, N) or 8 (adding SE, SW, NW, NE): the fixed order of
`LATTICE_DIRECTIONS`.

State (`FrontsState`): `cells` (Uint8: bits 0-3 owner colour + 1, 0 unclaimed; bit 7 marks an unclaimed allowed cell adjacent to a
claimed one, the *frontier*), `age` (Uint16: the step a cell was claimed, 0 for seeds), the live walkers in ascending id order
(`id, x, y, dir, color, idle`), the seeds, `nextId` (a birth counter), and the counters `claimed`, `open` (frontier size), `births`,
`deaths`, `ended`, `endStep`.

**Initial state** (step 0): seeds are placed, each claims its cell (age 0) and flags its neighbours as frontier; every seed starts
`walkersPerSeed` walkers with ids `walker:0…` in seed order. A snapped duplicate seed cell makes one seed. Seed `k` has colour
`k mod colors`. Placement is by layout: `scatter` (per seed `k`, from `ctx.stream("seed:k","place")`, six random allowed cells, the
one farthest from earlier seeds; ties: first candidate), `grid` (⌈√n⌉ lattice snapped to the nearest allowed cell), `ring` (radius
0.36 of the shorter side), `region` (the anchor of each connected region, largest first, ties by first cell), or `cells` (explicit,
direct API; a seed on a forbidden cell throws). "Nearest" is by centre distance, ties to the lowest raster index.

**One step** (`ctx.step = k`): if the walk has ended, nothing changes. Otherwise walkers are visited **sequentially in ascending id**
(a walker sees claims made earlier in the same step; children born this step act from the next step). For each walker, six draws
from its own stream `(seed, step, "walker:id", "walk")` are always consumed, in this order: greedy, persistence, direction, branch,
shift, pick.

1. *Greedy restriction:* if some neighbour is allowed and unclaimed and `greedy < explore`, only unclaimed neighbours are candidates.
2. *Move* (`latticeWalkStep`): candidates are allowed neighbours, minus claimed cells under `avoid`, minus rivals' cells under
   `own` (own-colour cells stay allowed), nothing further under `any`; with probability `persistence` the previous direction is kept
   when free, else one candidate is chosen uniformly. No candidate: the walker **dies (boxed in)**.
3. *Claim:* if the destination is unclaimed, the walker claims it for its colour at this step (`age = step`); the destination's
   unclaimed neighbours become frontier. Its idle count resets. Only unclaimed cells are ever claimed; a claimed cell is never
   re-claimed or re-aged.
4. *Colour transition:* after a claim, with probability `shift` the walker's colour becomes the next palette colour (`cycle`) or another
   uniformly (`random`); `inherit` never changes it. Colours are in `0…colors-1`.
5. *Branch:* after a claim, with probability `branching`, and if `alive < maxWalkers` (old count minus deaths so far plus births so far this
   step), a child is born on that cell with the walker's (post-transition) colour, no previous direction, and the next birth-counter id.
6. *Patience:* a step without a claim adds one to the idle count; above `patience` the walker **dies**.

**End** (checked after every step and after the initial state, first match wins): `full` (every allowed cell claimed), `coverage`
(`claimed ≥ ⌈coverage × allowed⌉`), `saturated` (no frontier cell: no growth is possible; unreachable pieces stay unclaimed, which is
how "an unreachable pocket stays unfilled" is stated and tested), `extinct` (no walker alive while frontier cells remain). `endStep`
records when. Later steps are no-ops, so the prefix property holds through termination.

## Published values

`walkGrid(source, barrier, columns, rows)` → frozen `WalkGrid` (identity is the allowed-cell content, interned; the same mask by any
route is the same object). `walkFronts(grid, rules, seed, { steps })` → cached `Snapshots`; `frontsField(snapshots, grid)` → frozen
`FrontsField` (`owner`, `age`, `claimed`, `open`, `births`, `deaths`, `ended`, `seeds`, `walkers`; typed arrays are private copies,
read only). Consumers, each frozen and cached per field and geometry key: `territoryDomains` (exact polygon per colour, `maskDomain`),
`bandDomains` (per colour and age band, `labelDomains`), `cellRuns` (row-run rectangles), `frontContours` (age isochrones as closed
paths), `territoryOutlines`, `territoryHatching` (`hatchDomain`), `frontSites` (`atEach` sites with id `cell:x,y`, tone = owner,
scale = age). Line and hatch paths go through the existing `pathMaterial`/`strokeWith`; sites through `motif`/`atEach`.

Units: the walk is in cells and steps; consumers take a `FrontsFrame` (`centerX`, `centerY`, `cell` in canvas units). Ownership: the
solver mutates its own arrays inside `step`; nothing outside sees them. Ids: walkers `walker:n`, seeds `seed:k` (streams only),
regions `front:c<colour>`, `front:t<k>`, paths `<id>/r<ring>`, hatch `hatch:c<colour>/…`, sites `cell:x,y`; all deterministic for the
same construction and, like every birth-counter id, they change when the construction changes.

Masks (all in **cell space**, so shape and walk do not depend on cell size or canvas position): `open`, `disc`, `ring`, `islands`
(1 to 64 blobs on a spiral, unioned), `chambers` (five rooms and four corridors), text via `textDomain`, tone interval of a bundled
raster (`valueField` lightness, bilinear, stretched over the lattice; the layer seed picks the variant), plus direct-API `domain`
(any `PlanarShape`) and `mask` (a `MaskRaster`, thresholded, nearest sample). Domains are rasterised by `hatchDomain` at one-cell
spacing (a cell is in when its centre lies in the closed region, holes out). Barriers (`wall` with a centred gap, `enclosure` with a gap on its
right, `pillars`, or any domain) are painted out of the mask. **Host binding of a user's own image or shape is future work**: persisted
instruments hold only technique id, scalars, text and palette; typed values are accepted by the direct API.

## Bounds and failure

Every failure throws and names the control; nothing is thinned to fit. Steps ≤ 20,000 (the age array is 16-bit; hard). Maximum
walkers ≤ 1,000, seeds ≤ 64, colours ≤ 8. **Work bound** checked before any step: `steps × (maxWalkers × (neighbourhood + 6) + 8)`
plus setup ≤ 90,000,000 units (the foundation charges the same per-step figure and would throw on a step that exceeds it): error
"lower Steps or Maximum walkers". Seeds × walkers per seed ≤ Maximum walkers. An empty region (after barriers) throws ("enlarge Region
size, widen the tone interval or shrink the barrier"). Treatment bounds: ≤ 64 age bands per field ("raise Age interval"), ≤ 60,000
hatch strokes ("raise Hatch spacing"), ≤ 40,000 mark sites ("raise Mark spacing"), ≤ 400,000 row runs. Retention is fixed per grid
(checkpoints every `max(100, ⌈cells / 200⌉)` steps, history every 10) so slider drags extend or replay a cached run; the cache holds 4 runs.

## Key, cache and what recomputes

The key is the foundation's: simulation id (which holds the grid's content hash), canonical rules, the layer seed, retention and
steps. **Construction** (recomputes): Region and its shape/word/image/tone controls, Barrier and its controls, Columns, Rows, Seed layout,
Seeds, Walkers per seed, Neighbours, Persistence, Explore, Revisit rule, Branching, Maximum walkers, Patience, Colors, Colour transition,
Shift chance, Steps (extends or replays), Coverage stop, the layer seed. **Appearance** (same snapshots object, asserted by identity):
palette, Center X/Y, Cell size, Fill and its controls, Lines and their controls, Hatching, Marks, Growth tips. Moving or resizing the
lattice repaints the same walk because the mask and every rule live in cell space.

## Controls

Groups (declared in `controlGroups`): **Region** (mask, size, ring width, islands, word, image, tone interval; subgroup **Barrier**),
**Placement** (centre X/Y; **Lattice** = columns, rows, `proportional`; cell size), **Seeds**, **Walk**, **Color**, **Growth** (steps,
coverage), **Fill**, **Lines**, **Hatching**, **Marks**, **Tips**. Columns and rows are the only proportional cluster (two cell counts in
one unit, where scaling both is one meaningful edit). Cell size stays outside it: it is canvas units per cell, not a count.

Inline `visibleWhen`: shape size (shape masks and letters), ring width (ring), islands (islands), word (letters), image and tones (image
tones), wall position (wall), barrier thickness and gap (wall, enclosure), enclosure size (enclosure), pillar spacing and radius (pillars),
**explore (revisit Cross own colour or Cross anything; measured: no effect under Avoid)**, shift chance (transition Cycle or Random), fill
geometry, opacity (fill not None), band contrast (fill Age bands), line material and weight (lines not None), stitch spacing (line material
stitch or beads), hatch controls (hatching on), mark controls (marks on). A hidden control never changes the drawing (tested for 43
hidden controls in six configurations, plus the repository's property test and audit). The audit
(`tests/helpers/audit-controls.ts random-walk-fronts`, 2,521 probes): **0 violations, 0 dead controls**, one proposed condition
(`explore`, now declared). Ten controls are left visible because their relevance is a disjunction or numeric: seeds, maximum walkers,
patience, colors, transition (irrelevant when Colors is 1), steps, coverage, age interval (used by bands and by contours), line colour
(used by lines and hatching), tips.

Slider intervals against hard limits: columns and rows slide 24 to 160 (hard 4 to 400, at most 100,000 cells together), steps 0 to
2,000 (hard 20,000, with the work bound), maximum walkers 8 to 400 (hard 1,000), cell size 1.5 to 12 (hard 0.5 to 64), seeds 1 to 16
(hard 64), islands 2 to 24 (hard 64), age interval 5 to 400 (hard 1 to 20,000, at most 64 bands).

## Evidence

**Tests** (`tests/composition-walk-fronts.test.ts`, independent expectations): exact cell counts of a rectangle domain, a hole, a wall and
its gap (15, 14, 180, 188); content-identical masks by different routes are one object; a letter's counter is empty; a disc's cell
count against πr²; empty and oversize masks name the control; connected regions, anchors and tie rules by hand; **an unreachable pocket
stays unfilled and the walk ends `saturated`, with a seed in it `full`**; avoid ends `extinct` on exactly one side of a strip (5 or 6 cells)
while crossing fills it, over five seeds; patience kills a walker that must retrace nine claimed cells (10 or 11 cells claimed), coverage
stops within three cells of the target; every claimed cell is allowed, connected to a seed and no older than a claimed neighbour (3
rules × 2 neighbourhoods); **prefix property** (the shorter walk equals the longer restricted to age ≤ k, for five k); `checkSimulation`
for three seeds; replay from a checkpoint equals a fresh run; ids are a birth counter (unique, ascending, `nextId = initial + births`,
alive = initial + births − deaths, cap respected); **a walker's path does not depend on other walkers** (with no children); the colour
cycle's i-th claim has colour i mod 4; **the revisit rule as seen from outside** (after each of 80 steps of `stateAt`, avoid walkers stand
on a cell claimed this step, own walkers stand on their own colour, and any walkers do stand on rivals); limits name their controls;
**palette and nine appearance edits give the same `Snapshots` object and the same field, and seventeen construction edits and the layer
seed give different ones**; a longer walk extends the cached run, a shorter one replays; **cancelling a preparation leaves nothing cached
and a retry equals a fresh run**; treatment geometry accounts exactly (territory and band areas = cells × cell², row runs total the
claimed count and never cross a colour or band, the last contour's signed ring areas equal the claimed area, contour k encloses exactly
the cells of band < k, hatch lines have the stated angle per colour and lie in their territory, sites carry age and colour); a recolour
draws identical geometry; the authored default is mid-growth in several colours.

**Mutations proven to fail** (ten, each caught by at least one test): re-claiming claimed cells (8 tests fail), walkers entering forbidden
cells (5), the frontier counter never decremented (1: the pocket test), births ignoring Maximum walkers (9), ages one step late (4),
own-colour walkers crossing rivals (1: the revisit-rule test), no frontier around seeds (7), band index off by one (1), rasterising at the
interval start instead of the cell centre (1), seed-snapping ties to the highest index (1).

**Defects found by looking and by measuring, fixed:** (1) the first default (700 steps, five colours, colour shift 0.01) finished the whole
disc within about 365 steps into a uniformly speckled patchwork, so most of the Steps range did nothing and the picture had no front;
the default is now a mid-growth catch (100 steps, four colours, shift 0.004, six seeds of two walkers, Explore 0.8, Persistence 0.3, age
interval 10); the step slider was re-read against measured fill times (fills take a few hundred steps at 60 to 100 cells across). (2)
Region anchors used cell corners, so a 3 × 3 block's anchor tied to its corner cell instead of the centre; caught by the anchor test, fixed
to the centroid of cell centres. (3) The 160,000-cell bound equalled 400 × 400 and so bounded nothing; now 100,000. (4) The audit
found `explore` inert under Avoid; it is now conditional. (5) Looking at Letters: with the default Patience 60 a thin word ends
`extinct` with parts of a letter bare (the W read as a V); that is the stated rule, so the guide and Try-this recipe raise Patience to
400. (6) A one-seed Avoid walk died within a few steps; the guide's circuitry recipe uses more seeds, branching and colours.

**Timing** (Node 22, this machine, null drawing surface, milliseconds; first draw includes the walk and all geometry):

| Case | first | recolour | age-interval edit | structural edit (persistence) | steps + 50 |
|---|---|---|---|---|---|
| Default (96 × 96, disc, 100 steps) | 59 | 2.3 | 11 | 24 | 27 |
| 160 × 160, 2,000 steps (slider max), 400 walkers that never die | 383 | 15.7 | 49 | 275 | 79 |
| 316 × 316 (100k cells), **20,000 steps (hard max)**, 400 walkers that never die | 3,042 | 233 | 228 | 3,040 | 224 |

The structural edit at the hard maximum re-runs 8 million real walker-steps (the walk did not end); extending by 50 steps reuses the
last checkpoint (224 ms against 3,040). Recolouring never touches the walk; its cost is repainting the cached polygons.

**Images reviewed** (SVG surface rasterised with Chromium under the render lease; layers `.work/` scripts deleted after): default with
seeds 42, 7, 1234567; step timeline (0 with tips, 20 with tips, 45, 100, 200, 900); about 30 configurations across four sheets (disc,
ring, islands ×12 and ×14, chambers, letters GROW in two settings, open lattice with wall, with sealed enclosure and with pillars,
tone bands of the landscape and portrait images, 8-neighbour creep through a small gap, avoid-rule circuitry, dendrite, dense
160 × 160 with 16 seeds and row runs, sparse coverage-0.2 marks and tips, beads, stitches, hatching, marks); and Random Walk Fronts
with Contour Scores, Region Quilts and Graph Roles in both orders (transparent layers, negative space kept). Not real-interface
acceptance.

## Decisions taken on undecided boundaries

- Sequential in-step update by ascending id (not synchronous); children act from the next step; the birth cap is measured against the
  step's start count minus deaths so far, plus births so far.
- Only unclaimed cells are claimed; there is no overwrite or "revisit repaints" rule. Front age is therefore final.
- Ids come from one birth counter, so adding a seed shifts later children's ids; independence of walkers is guaranteed for the same ids.
- Walkers and seeds are not re-seeded when the frontier remains but walkers are extinct (`extinct` is a legitimate end).
- The mask is built in cell space, so lattice position and cell size are appearance; the layer seed varies `tones` masks and scatter seeds.
- Growth tips are hidden once the walk has ended.
- A `text` control holds the word (1 to 20 printable ASCII); the font is the licensed outline font of `textDomain` (unshaped Latin only).

## Open concerns

- Tips are drawn as circles per walker; at 1,000 walkers this is many shapes.
- `cellRuns` and `bandDomains` are rebuilt when *Age interval* changes; at 100,000 cells the edit costs about 230 ms, mostly repainting.
- Fronts are lattice fronts with a stair-stepped edge; `maskDomain`'s contour mode (smooth edges) is not used because adjacent colours
  would leave gaps under marching squares.
- The age array is 16-bit, capping steps at 20,000 (well below 65,535).
- Real-interface review and the private host's slot for the region input (a user's own mask or image) remain future work.
