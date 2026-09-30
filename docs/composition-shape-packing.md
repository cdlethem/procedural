# Non-convex shape packing (brief 47)

Status: implemented on branch `w2/shape-packing`, unreleased; rendered-output reviewed with a throwaway SVG surface, not
root-reviewed through the real interface. Built on the merged [planar domains foundation](composition-domains.md) and the frozen
[reference slice](composition-reference-slice.md) / [structural operators](composition-structural-operators.md) conventions. No
polygon, Boolean, offset, clipping or hatching code was written: the exact predicates are the foundation's, containers and pieces are
`PlanarDomain`s, gap footprints are `offsetDomain`, placed pieces are ordinary regions, the negative space is `domainDifference` of
`unionDomains`, hatching is `hatchDomain`, letters are `textDomain`, and the consumer contract is `atEach`.

## Artist-facing brief

Interlocking irregular forms with meaningful negative space and a size hierarchy. The artist chooses a piece family (letters, leaf shapes,
blobs, polygons with holes, or a mix), a container (rectangle, ellipse, ring, the ink of a letter, a leaf), the size range and how it is
spread, the angle set, the gap, the placement rule (grow from the middle, follow the edge, settle in a direction), the order, how hard a
piece that does not fit is pushed (retries at a smaller size) and when to stop. Pieces are drawn filled, outlined, both, hatched, or with
a different technique per color tone; the leftover negative space and the container outline can be drawn. The default is a mixed
population in a round frame: large pieces in the middle, tilted medium ones in the bays they leave, small ones lining the edge.

Distinct from glyph packing (brief 37, sized text in a region): pieces here are arbitrary non-convex outlines with holes, searched
over a set of rotations against a real shape-to-shape collision test.

## Frozen input contract

The library never fetches or decodes. The persisted instrument stores its technique id, scalar controls and palette, so it can only name
bundled pieces and containers: the letters come from the licensed outline font, the leaf, blob and polygon shapes are generated
deterministically from `componentSeed(seed, "p<index>", purpose)`, and the container is chosen from named shapes. The direct API accepts
any valid planar shape: `customShape(id, shape)` moves a region, a domain or plain data to normal form, `customItem(id, shape, size)` makes
an item, `packShapes(container, items, rules, seed)` takes any `PlanarDomain` container. **Binding a host-owned silhouette or container to a
Studio layer is future host work.**

## Frozen boundary and semantics

Files: `composition/shape-pieces.ts` (shapes, items, containers), `composition/shape-packing-grid.ts` (raster search),
`composition/shape-packing-layout.ts` (the solver), `composition/shape-packing.ts` (recipe, drawing, preparation, binding),
`composition/domains-overlap.ts` (foundation predicates, below), `adapters/shape-packing-instrument.ts` (definition),
`guides/shape-packing.md`, `tests/composition-shape-packing.test.ts`, `tests/composition-domains-overlap.test.ts`.

**Values.** A `PackShape` is a `PlanarDomain` in normal form: area centroid at the origin, longest bounding-box side 1, y down. A
`PackItem` is `{ id, index, shape, size }` (size: canvas units of the longest side of the unrotated shape). A `PackedInstance` is
`{ id, item, rank, position, angle, mirrored, size, retries, region, footprint }`: world = position + R(angle)·(±x, y)·size for the
normal-form shape (`angle` in radians clockwise on the y-down canvas, mirror = x → −x first, exactly the `atEach` convention with a
negative scale). `region` is the placed piece as a validated `PlanarDomain` (holes included), `footprint` the piece grown by half the gap
as plain ring data. A `ShapePacking` holds the `instances` (placement order), `unplaced` (`{ id, item, size, attempts, reason }`,
reason `"no-room"` or `"stopped"`), `placedArea`, `containerArea`, `coverage = placedArea / containerArea`, and `stats` (items tried,
raster steps, candidates the exact check refused, exact tests, cell size). Everything is deeply frozen.

**The rule** (fully specified in the header of `shape-packing-layout.ts`):

1. Items in `order`: largest first, smallest first, or shuffled by `componentSeed(seed, id, "order")`.
2. Each item is tried at every angle `k·360°/rotations` (and mirrored when allowed). Its footprint is the piece grown by `gap/2` (round
   join, chord error ≤ 1/16 of the offset), so two pieces are at least `gap·15/16` apart; a piece is at least `margin` (up to the same
   chord error) from the container's edge and holes.
3. SEARCH: a conservative occupancy bitset (a cell is blocked if the closed cell meets any placed footprint or is not wholly inside the
   container) is eroded by the rasterised footprint with bit-parallel row operations; the candidates are the anchors on the boundary of
   the feasible set, the raster no-fit polygon: the footprint touches something there. The one that minimises the rule's potential of
   the piece's centroid wins (`center`: distance to the container's area centroid; `walls`: chamfer distance to the container boundary;
   `settle`: position along a direction), ties by angle index, row, column. The first piece has nothing to touch, so **every** feasible
   place is a candidate for it and the rule alone decides where it starts (this is what makes `center` start in the middle).
4. EXACT CHECK: the winner must lie inside the usable region (`shapeCovers`-equivalent `regionInside`, exact) and its footprint must not
   overlap any placed footprint (`regionsOverlap`, exact; bounding boxes are only a filter). A candidate the exact check refuses is
   discarded and the next is taken (counted in `stats.rejected`; zero in the 100+ layouts inspected, the conservative raster makes a
   refusal a rounding edge case).
5. SETTLE: in continuous coordinates the piece is slid along the potential's descent direction and up to ±90° either side (4 rounds ×
   5 directions), each move found by stepping and bisecting with the exact check, so it ends at the gap from its neighbours rather than
   a cell away. Measured: nearest-neighbour distances are 2.99 median (min 2.93) at `gap` 3 and 7.96 (7.85) at `gap` 8.
6. COMMIT: the footprint's touched cells are blocked and the next item searches the updated raster.
7. An item that fits nowhere is retried at `shrink` × its size, `retries` more times, then reported unplaced; a coverage `stop` ends
   packing at the first piece that reaches the target (the rest are `"stopped"`).

**Semantics decided (conservative).**
- *Counters (holes).* A hole of a piece is free space by default (`counters: "open"`): the raster does not block it and the exact test treats
  it as outside the piece, so a smaller piece placed later may sit in an A or a frame. `"solid"` fills holes (the outer ring only). Which
  pieces are placed later is decided by the order, so nesting needs the smaller piece to come after the one with the counter.
- *Container holes are obstacles*, never entered (ring, letter counters). Islands of a container are ordinary free space.
- *Touching is allowed.* With `gap` 0 pieces may touch along edges and at points; interiors never overlap (closed-set rule of the domains).
- *`margin` measures the piece*, not its footprint: the usable region is the container moved in by `margin`; the footprint may reach
  `gap/2 − margin` beyond it (the search envelope) but the piece may not. A margin at or above half of the container's shorter box side
  is refused up front as leaving no room.
- *Failure to pack is a result.* Nothing throws because pieces did not fit; the honest list is `unplaced`.
- *Identity.* Item `p<j>` depends only on (seed, j, family, letter set, size range, skew); count, palette, colors, rendering and
  footprint never rename or move it. Placement is a global greedy solve: changing the count, a rule or a size may move other pieces (not
  promised otherwise).
- *Bounding boxes are not the collision test.* The tests place two L pieces in a box only they can share when interlocked, and a piece in
  another's counter.

**Seeds.** Chance is only in the population (shape, size, letter) and the shuffled order. `shapePackingUsesSeed` is always true.

**Caching.** `packContainer` (by spec), `packItems` (by construction), `packShapes` (per container value, by rules, seed and item list),
`packNegativeSpace` (per packing). Palette, `colorBy`, `render`, weights, hatch, negative-space, frame and footprint controls never re-solve
(tested by object identity).

## Foundation additions (report)

The planar domains foundation had Booleans but no cheap yes/no predicate; asking `domainIntersection(...).regions.length > 0` per candidate
is too slow for a search. `composition/domains-overlap.ts` adds `regionsOverlap`, `regionInside` (ring-level, for unvalidated transformed
rings) and `shapesOverlap`, `shapeCovers` (shape-level, validated). They decide by exact orientation predicates: box test, proper crossing,
a vertex strictly inside, no contact at all; and fall back to the Boolean for degenerate contact (edges only touching or collinear), so they
equal `domainIntersection(a, b).regions.length > 0` and `domainDifference(inner, outer)` being empty. Tests compare them with the Booleans on
4,000 + 1,500 random pairs (integer grids force touching); the first version of that test found a real bug (a strictly inside vertex on the
common box's edge was skipped). They are exported from `src/index.ts`; `docs/composition-domains.md` should absorb this paragraph.

## Limits (measured, not certified slider ranges)

`SHAPE_PACKING_LIMITS`: 600 pieces, 24 angles (48 with mirrors), search resolution 320, 8 retries, 60,000,000 raster search steps, 150,000
hatch lines. Steps are counted per (row, run) actually combined and are a deterministic function of the input, so a refusal never depends on
timing. Each refusal names the controls to change ("lower Pieces, Rotations, Retries or Search resolution"; "raise Hatch spacing or lower
Pieces"; "lower Edge margin"). Development-machine timings (Node 22, one thread; `prepare`, then a draw against a no-op surface):

| Setting | First prepare | Appearance-only edit (incl. negative-space Boolean) | Structural edit (gap + 1) |
|---|---|---|---|
| default (80 pieces, 8 angles, resolution 150) | 323 ms | 50 ms | 225 ms |
| 200 pieces, 16 angles, resolution 256 | 1,042 ms (12.7 M steps) | 75 ms | 1,046 ms |
| 400 pieces, 12 angles, resolution 320 | 2,103 ms | 125 ms | 2,203 ms |
| letters, 24 angles + mirror, 150 pieces | 947 ms | 25 ms | 904 ms |
| letter container S, 300 small pieces, resolution 256 | 844 ms | 63 ms | 888 ms |
| hatch spacing 1.5, 150 pieces | 370 ms | 30 ms | 340 ms |
| 600 pieces, 24 angles, mirror, resolution 320 | refused after ≈ 3.6 s at the step limit | | |

### Slider corners (root finding: all sliders at their maximum took 22 s in the real app)

Cause: at the old slider ends (200 pieces of 120 to 260 units in a 640 box, 24 angles, 6 retries, resolution 256) almost every piece is a large one that fits nowhere,
and every failed attempt paid the whole raster search for every angle and both mirrors. Two exact speedups (layouts are bit-identical): a footprint whose touched-cell
count exceeds the remaining free cells is skipped without a search, and a piece's row runs are ANDed longest first so most anchor rows die on the first run. Slider
intervals then narrowed to the cost drivers: **Pieces** 8–100 (was 200), **Largest piece** 40–200 (260), **Smallest piece** 8–50 (120), **Rotations** 1–12 (24),
**Search resolution** 64–160 (256), **Retries** 0–3 (6). Hard limits and named bounds are unchanged for typed values.

Measured on the development machine, load average ≈ 100 from other workers (wall times were 2–6× CPU time, so CPU time is given; searches are single-threaded):

| Corner | Search steps | CPU time (prepare + draw) |
|---|---|---|
| defaults (80 pieces) | 0.75 M | 0.32 s idle; 1.2 s CPU under the load above |
| every slider at min | 4.9 k | 0.11 s |
| old all-max (before the fix), mixed, seed 42 | not finished within the 60 M step limit with mirror; 22 s without | 22 s wall |
| every slider at max, mirror on, seeds 1–4, six family/rule/order/render/counter combinations (24 layouts) | ≤ 3.04 M | ≤ 2.0 s (typically 1.8–2.2 s; the finest hatch, 1.5, adds ≤ 0.25 s of drawing) |
| every control at its hard max (typed values: 320 resolution, 600 pieces, 24 angles, 8 retries, 2,000-unit pieces) | 20.2 M | 37.5 s CPU before answering: legal but not a slider position |

The test `every slider corner is admitted and stays inside the declared work bound` sets each numeric control alone to its slider min and max, all at max (four
mirrored expensive settings, three seeds), and all at min: `validateInstrument` passes, the search steps stay ≤ 3.5 M (≈ 2.3 s of CPU) and the drawing stays inside its bounds.

Coverage reached at the defaults over three seeds: 0.58, 0.63, 0.59 (blobs 0.67, leaves 0.67, polygons 0.60, letters 0.45, an S-shaped
container 0.38). Sparse and dense settings are inspected in the review list below.

## Controls

See the [guide](../packages/instruments/guides/shape-packing.md). Groups: `Container` (container, letter, ring hole), `Placement`
(center X/Y, proportional `Size` width × height, rotation), `Pieces` (family, letters, count, proportional `Size range`, bias, counters),
`Packing rule` (order, rule, settle direction, rotations, mirror, proportional `Spacing` gap × margin), `Search` (resolution, retries,
shrink, stop, coverage), `Drawing` (render, color by, line weight, `Hatch`, negative space, container outline). Conditions (inline
`visibleWhen`): letter set ← family letters/mixed; counters ← family with holes; container letter ← container letter; ring hole ← ring;
settle direction ← rule settle; coverage ← stop coverage; hatch spacing/angle/follow ← render hatch/mixed. Hidden controls never reach the
recipe.

## Explicit non-goals

No true no-fit polygon (the raster no-fit boundary plus exact settling is used); no relaxation or optimisation pass after the greedy
placement; no hole-aware "fit smaller piece into the counter first" ordering beyond the order control; no physics; no per-piece override of
angles, sizes or techniques from Studio (the direct API takes items and consumers); no user-supplied silhouettes through the persisted
instrument (future host work); no port claim. Rectangles and circles are cheaper with the existing packed shapes and circle placement.

## Evidence

`tests/composition-shape-packing.test.ts` (25 tests) and `tests/composition-domains-overlap.test.ts` (6). Independent expectations, not the packer's own
numbers: two L trominoes (area 3 each, 2 × 2 boxes) placed in a 340 × 240 box that two boxes could not share, their bounding boxes overlapping and
their Boolean intersection empty; a square placed in a frame's counter (open) and refused (solid); coverage equal to Σ piece area / container area
and to `1 − negativeSpace.area / container.area` (a Boolean-derived cross-check); brute-force vertex-to-segment distances at least `gap·15/16` between
all near pairs and at least `margin·15/16` from the container (median nearest neighbour ≤ gap + 0.3, i.e. actually settled); no piece overlaps the
hole of a ring or the counters of B and 8; every bundled container × family layout has pairwise `domainIntersection` area 0 and `domainDifference`
against the container 0; the first piece of each rule rests where the rule says (bottom, top and right margin for `settle` at 90°, 270°, 0°; the
container centre for `center`; a wall for `walls`); the angle set is honoured and the transform maps the normal-form shape exactly (area, centroid,
transformed vertices on the placed region, mirrored included); `retries` shrink to 78 = 130 · 0.6 and record 1 retry; the coverage stop ends at the
first piece that reaches the target; order is a permutation by size or seed; cache identity under look and palette edits; hatch length within 6 % of
area / spacing (Cavalieri) and every hatch midpoint on a piece; hidden controls never reach the recipe.

**Mutations proven to fail the suite** (each reverted): overlap predicate ignoring strictly-inside vertices (1 failing), no Boolean arbiter for degenerate
contact (2), bounding boxes as the collision test (10), no gap footprint (1), container containment skipped (4), counters always solid (1), first piece
needing contact (1), no settling (3), item size depending on the count (1). One deliberately equivalent mutation (touching boxes counted as overlapping)
does not fail, because the exact fallback still decides: recorded as not a defect.

**Control audit** (`tests/helpers/audit-controls.ts shape-packing`, 35 controls, 1,362 probes): 0 violations of an inline condition; `retries`, `shrink` and
`weight` are relevant only under a disjunction or a numeric threshold (left visible on purpose); `stop` reported irrelevant at the default coverage target,
which the default packing never reaches. The existing property test that changes hidden controls passes for this instrument.

## Defects found by looking or by the property tests, and fixed

1. Every first piece went to the container wall (contact-only candidates), so `center` did not start in the middle: the first piece now takes any feasible place.
2. Leaf shapes read as round serrated blobs (half-width 0.28–0.6 of the length): narrowed to 0.16–0.34, sharper tips, milder serration.
3. `regionsOverlap` skipped a vertex strictly inside the other region when it lay on the common box's edge (found by the random equivalence test): fixed.
4. With `margin` below `gap/2` a piece could protrude from the container by the offset chord error (found by the fuzz against the Boolean): containment is now decided on the piece,
   the footprint only guides the search.
5. A very large `margin` reached the offset's 40 M-test limit as a bare foundation error: refused up front as "Edge margin leaves no room", with the offset limit rewrapped naming Edge margin.
6. Preparation rejected with "Composition cancelled" when cancelled mid-solve: it now resolves `false`.

## Images reviewed (throwaway SVG surface, Chromium under the native render lease; not real-interface acceptance)

Defaults for seeds 42, 1, 2 and for each family and the ring and letter containers; walls, settle (down, up, left), center; ring, letter S, R, B, leaf (turned), rectangle,
ellipse containers; gap 0 with 24 angles, gap 16 with margin 40; 240 pieces at resolution 256 with 16 angles (dense), 12 pieces of size 90–220 (sparse), coverage stop 0.35;
smallest-first order; fill, outline, fill and outline, hatch, mixed technique, negative-space wash and outline; and layered pairs in both orders with the unmodified optical
plates, contour scores and substitution tilings (outlines read over a dot lattice; the opaque tilings hide what is under them, as they do for every layer).
