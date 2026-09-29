# Robust planar domains (foundation F4)

Status: **foundation code, 2026-09-29; unreleased, no instrument, no Studio control.** It serves briefs 08
(reserved holes), 13 (region stitch fills), 36 (outline type as a region), 37/47 (packing in silhouettes), 31
(connected value regions), 14 and 03 (non-convex quilt regions) of the [release roadmap](next-release-roadmap.md).
Code: `packages/instruments/src/composition/{domains,domains-offset,domains-paths,domains-raster,domains-simplify,planar-kernel}.ts`,
exported deliberately from `src/index.ts`. Tests: `tests/composition-domains.test.ts`.

The existing simple-polygon routines in `@procedurals/javascript` (`triangulateSimplePolygon2D`, `hatchRegionLines2D`,
`clipSegmentsSimplePolygon2D`, `offsetPolyline2D`, …) are **not** changed and not silently upgraded. This module adds a separate,
exact, hole-aware layer for the composition consumers; it does not call them, because none of them supports a Boolean of
regions with holes or an offset of a polygon (only of a polyline).

## Values

Everything is plain data (arrays of `[x, y]`, numbers, strings), deeply frozen, and round-trips through JSON.

| Type | Meaning |
|---|---|
| `PlanarRegion` | One connected polygon: `outer` ring, `holes[]`, `area`, `perimeter`, `bounds` `[left, top, right, bottom]`, `centroid`, `id`. |
| `PlanarDomain` | Ordered set of regions with pairwise disjoint interiors, with the same measures (`bounds`/`centroid` are `null` when empty) and `id`. |
| `PlanarShape` | Anything an operation accepts: a region, a domain, or plain data `{ id?, outer, holes? }` (validated on entry; values this library produced are trusted). |

**Orientation is normalised and documented.** An outer ring has positive shoelace area `Σ(xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)/2`, a hole negative; the region
is on the **left** of every ring's direction of travel (counter-clockwise with y up, clockwise on the y-down canvas). Input rings may
have either orientation and are reversed as needed; their start vertex and vertex order are otherwise kept. Computed results (Booleans,
offsets, masks) are canonical: every ring starts at its lexicographically smallest vertex, holes and regions are ordered by that vertex,
so results do not depend on ring start, ring orientation, argument order of symmetric operations, or region order. A hole `k` of region
`id` is conventionally named `${id}/h${k}`.

**Ids.** Computed domains are named `options.id`, else `union(a,b)`, `difference(a,b)`, `offset(id,d)`, `hatch(id)`, `mask`, `labels:<n>`, …;
their regions `${id}/${k}` in canonical order. Ids are deterministic functions of the construction; they are stable under appearance
edits (nothing here depends on palette or material) and, like other sources, may change when the geometry changes. Use
`componentSeed(seed, region.id, purpose)` for per-region streams.

**Boundary rule.** A region is the **closed** set. `locateInDomain(shape, x, y)` returns `"inside"`, `"boundary"` or `"outside"` by exact
predicates (a point on a hole's ring is `"boundary"`; inside a hole is `"outside"`); `domainContains` is `!== "outside"`.

## Numeric policy (no epsilon anywhere in a decision)

* Coordinates are binary64, must be finite, and either `0` or within `[1e-100, 1e100]` in magnitude (products stay exact and cannot
  underflow). Anything else throws `INVALID_INPUT` naming the coordinate. `-0` is normalised to `0`.
* Every orientation question ("is *c* left of *a→b*?") is decided **exactly**: floating-point filter, then an error-free-transformation
  check, then BigInt arithmetic on the exact dyadic values. There is no tolerance; a point one ulp off a line is off it.
* The only rounding is the position of a *computed* vertex (a proper crossing of two segments), rounded to the nearest binary64 point inside
  both segments' bounding boxes. Because this can move the vertex a few ulps off the exact line, the arrangement is re-examined with the exact
  predicates and any crossing or vertex-on-edge contact the rounding created is split again, up to 32 rounds. Non-convergence throws
  `NOT_CONVERGED` (never observed in the fuzz runs below); it does not return a wrong result. Every output ring is therefore **exactly**
  simple and non-crossing in binary64, verified by property tests that push results back through the strict constructor.
* Face classification uses a sweep with an exact status order (winding numbers per input), so touching, collinear, overlapping, T-junction
  and single-point contacts all follow from the same rule: vertices are on edges iff exact orientation is zero.
* Outputs merge collinear runs unless the vertex is shared with another ring (a touch point); tiny results are kept unless `options.minArea`
  drops regions and fills holes smaller than it.

## Construction and what is rejected

`planarRegion(data)` and `planarDomain(shapes, options?)` throw `PlanarError` (a subclass of `Error` with a stable `code`) for:
non-finite/out-of-range coordinates or fewer than three distinct vertices (`INVALID_INPUT`); a ring that crosses itself, touches itself
(repeated vertex, vertex on another edge of the same ring), or doubles back (`SELF_INTERSECTION`); two rings of a region that cross or
share a boundary piece of positive length (`SELF_INTERSECTION`); zero-area rings, a hole outside the outer ring, overlapping holes, a hole
nested in a hole, or overlapping regions in a domain (`INVALID_REGION`); duplicate region ids. **Allowed:** rings touching each other at
isolated points (a hole may touch its outer ring at one vertex; regions may touch at points or share edges).

**Repair.** `planarDomain(shapes, { repair: "nonzero" | "evenodd" })` accepts self-intersecting or overlapping input, pools all rings (outer
rings and holes keep their role orientation) and resolves them by the fill rule into canonical regions. `ringsDomain(rings, { fill })`
does the same for a raw ring soup such as font contours (`"nonzero"` is the font convention; `"positive"` keeps net counter-clockwise
areas). Rings with fewer than three distinct vertices enclose nothing and are ignored *only* here. There is no silent repair otherwise.

## Booleans

`domainUnion`, `domainIntersection`, `domainDifference`, `domainXor` (two shapes) and `unionDomains` (any number, one exact pass) return a
`PlanarDomain`. Semantics: the result is the set operation on the regions as sets, reported as regions of positive area.
Consequences that are deliberate: intersection of regions that only touch (edge or point) is **empty**; union of regions sharing an edge is
one region without the shared edge or leftover collinear vertices; regions touching only at a corner stay separate regions; a hole touching
its outer ring at one vertex stays one region; rings that would revisit a vertex are split there, so every ring is simple. Symmetric
operations are symmetric to the last bit, and `union(u, u)` is `u` vertex for vertex. Options: `id`, `maxWork`, `run` (a
`CompositionRun`; `check()` is called periodically and a throw surfaces as `CANCELLED`), `minArea`.

## Offsetting

`offsetDomain(shape, distance, { join, miterLimit, arcTolerance })`; `distance > 0` grows (outward = away from the region, so holes
shrink), `< 0` shrinks (holes grow), `0` normalises. Each boundary edge is swept into a rectangle of width `|d|` on the offset side and each
vertex whose offset edges would separate (convex when growing, reflex when shrinking) gets a join wedge; growing is the exact union with the
region, shrinking the exact difference, so thin necks, merging neighbours, collapsing holes and a shape narrower than `2|d|` (it vanishes)
need no special cases. Joins: **round** (default; an inscribed polygon, vertices on the true offset curve, chord error ≤ `arcTolerance`,
default `|d|/50`, so the area is at most that of the true offset), **miter** (extend the offset lines; if the tip would be farther than
`miterLimit × |d|`, default 4 as in SVG, fall back to **bevel** — SVG `miter`, not `miter-clip`), **bevel** (chord between the offset edge ends).
Analytic checks: square side *s*, growing by *d*: miter `(s+2d)²`, bevel `s²+4sd+2d²`, round → `s²+4sd+πd²` within the chord tolerance;
shrinking: `(s−2d)²` for every join; an L's reflex corner: miter 28, bevel 28.5, round `28+1−π/4` for `d = 1`.

## Clipping and hatching

`clipPath(points, shape, { closed, keep, id })` returns pieces `{ id: "<id>#<n>", points, closed, from, to }` (`from`/`to` are path parameters,
segment index + fraction). A segment is cut at every crossing, touch and collinear boundary run (exact predicates); each interval is classified
inside/outside, and boundary runs belong to the closed region. `keep: "inside"` and `keep: "outside"` **partition** the path (length is
conserved; only zero-length cut points disappear). Kept intervals are joined across path vertices and, for a closed path, across its start; a
closed path lying wholly inside comes back closed. Cut points are inserted where they occur, so a polyline touching the boundary keeps that
vertex. `clipPaths(paths, shape)` clips composition `Path`s: an uncut path is returned as **the same object** (stable id); pieces are
`<id>#<n>` with `seed = componentSeed(path.seed, path.id, "clip")` and keep `level`, `levelFraction`, `tone`.

`hatchDomain(shape, { spacing, angle°, phase = 0.5, origin = [0,0] })` returns `{ id: "<id>/h<k>#<n>", line: k, points: [a, b] }` for every
interval of every line inside the shape (holes and multiple regions respected), ordered by line then position. Lines sit at perpendicular
offsets `(k + phase) × spacing` from `origin`: **anchored to the origin, not the region**, so ids are stable when the region changes and
neighbouring regions' lines align. A line is treated as infinitesimally on the +normal side (an edge is crossed when `min v ≤ line < max v`), so a
line along a horizontal boundary edge is kept iff the region is on the +normal side and a line through a vertex is never double counted.

## Rasters

`maskDomain({ width, height, data }, { threshold = 0.5, mode, cell = 1, origin = [0,0], simplify = 0 })` and
`labelDomains(raster, { background = 0, … })` (one domain per non-background label, ascending; `background: null` extracts every label).
Pixel `(i, j)` is the square `[i, i+1] × [j, j+1]` scaled by `cell` and shifted by `origin` (the canvas position of the raster's top-left
**corner**; row 0 at the top; pixel centre `(i+½, j+½)`). Inside means `value >= threshold`.

* `mode: "cells"` (default): the region is exactly the union of the inside pixels (area `count × cell²`). Pixels connect across edges only; diagonal
  neighbours are two regions touching at a point, and a diagonal gap separates nothing. Holes are nested exactly; straight runs are merged.
* `mode: "contour"` (masks only): marching squares on the pixel-centre samples closed by a ring of outside samples, linear interpolation of the crossing,
  the midpoint at the border. Binary masks therefore cut corners by the midpoint rule (a lone pixel is a diamond of area `cell²/2`, a fully inside
  2×2 raster loses `4 × ⅛`); scalar masks give smooth boundaries. Saddles keep inside diagonals separate.
* Labels: shared boundaries between labels coincide exactly, before and after simplification.
* `simplify` (canvas units) and `simplifyDomain(shape, tolerance)`: Douglas–Peucker in Saalfeld's topology-preserving form on chains cut at junctions
  (vertices where ≥3 boundary edges meet). A chord replaces a run only if it neither crosses nor touches any other current segment of any ring (exact
  predicates), so rings never start to cross, touch or collapse; only original vertices survive; every original vertex stays within `tolerance` of the
  simplified boundary; shared chains are simplified once so neighbours stay identical.

## Bridges from existing values

`rectangleRegion` / `rectangleDomain` turn composition `Region` rectangles (`partitionRegions`, `regionTree` leaves) into regions/domains keeping ids and
order. `textDomain(text, { centerX, centerY, width, height })` is the licensed outline font (1–20 printable ASCII) as a domain: contours resolved by
nonzero fill, counters are holes, ink fitted uniformly into the box; cached and frozen. `keyholeRing(region)` merges each hole into the outer ring by a
zero-width cut at the nearest vertex pair, for surfaces that fill one closed shape; the result is intentionally a weakly simple ring (fill it, never
stroke it). `ringsDomain` accepts any transformed contour set. Nothing fetches or decodes: the font is already an owned asset.

## One planar implementation: consumers absorbed into `domains`

The plates stencil and the typographic-rhythm fills previously carried their own geometry. They now use this module:

* `support.ts` (`resolveSupport`, `supportContains`, `clipToSupport`): a `Support` gains `domain`, the stencil as a `PlanarDomain` (footprint ∩ mask, or
  footprint minus mask when inverted, mask rings resolved by nonzero fill). `supportContains` is the exact closed-set location and `clipToSupport` is
  `clipPath` on that domain; the old float winding/`edgeTable` clipper is deleted. `support.edges` keeps its old meaning (footprint + mask ring vertices), so
  every `MAX_CLIP_WORK` preflight and its error text is unchanged. `Support.mask.rings` is still exposed (sand deposition builds its inverted "allowed" stencil from it).
* `keyholeRings`, `keyholeJoin` and `clipRingToRect` moved from `type-text.ts` into `domains.ts` / `domains-paths.ts` (same behaviour, now sharing the exact ring predicates
  and area routine); `keyholeRing(region)` is the same join applied to a `PlanarRegion`. `type-rhythm.ts` and `type-glyphs.ts` import them from there.
* `locateInDomain` and `clipPath` share one cached edge grid (`domains-index.ts`).

**Verification against the previous code.** Draw-call fingerprints (the test suite's `drawFingerprint`, exact JSON of every painted call) of Optical Plates, Typographic
Rhythm, Sand Deposition, Gesture Scores, Path Typography, Dry Bristles and Quilled Paths: default and seeds 1, 2, 3, plus one-control sweeps (every select option, each number's
min and max, each toggle) — 737 drawings, 734 identical to the bit. **Identical: every default and every seed.** Three sweep settings differ, all understood:

1. Optical Plates with `angleA = −90°` and with `+90°`: a dot lattice then lies exactly on the stencil edge. The old float rule counted boundary points by a half-open
   crossing test (two edges of a rectangle inside, two outside) although its own header said the boundary is inside; the stencil is now the closed set on every edge, so
   those boundary dots are drawn (621 more `circle` calls in the default-sized study). This is a deliberate correction, not an accident of the rewrite.
2. Typographic Rhythm `textStyle = lined`: 86 of 2,118 calls differ by at most 5.7·10⁻¹⁴ canvas units. Crossings are now computed against the exact Boolean boundary,
   whose edges may be sub-segments of the original mask edges, so the last bits of a crossing differ. Structure, counts and ids are identical.

Also found and fixed during the comparison (no longer a difference): counters whose every vertex lies on the outline after clipping must count as contained, or the fill
loses them. `keyholeRings` counts boundary vertices and a regression test pins it.

Draw time per seed on the development machine, old → new: Optical Plates 17.6 → 9.8 ms, Typographic Rhythm 1.8 → 2.4 ms, Sand Deposition 29.6 → 28.5 ms, Path Typography 14.5 → 14.6 ms.

**What remains outside `domains.ts`, and why.** Nothing that clips or classifies geometry against a stencil. Left in place deliberately:
`clipRingToRect` (a Sutherland–Hodgman variant that preserves the winding number ring by ring; a Boolean intersection would merge or split the glyph polygons and change the
painted calls) is *in* the domain module but is a separate, documented primitive; `keyholeRings` keeps overlapping outers separate for the same reason (`ringsDomain` +
`keyholeRing` is the unioning alternative); footprint/ellipse construction and mask parsing stay in `support.ts` (they are input descriptors, not geometry); and the older
simple-polygon routines in `@procedurals/javascript` and `insetPolygon` in `tiling-materials.ts` are untouched by design (convex/simple inputs, published operations).

## Limits (measured, not certified slider ranges)

`PLANAR_LIMITS`: `maxWork` default 40,000,000 exact geometric tests (raise per call up to 2·10⁹), `maxEdges` 400,000 boundary edges per operation,
`maxRegions` 100,000; `MASK_DOMAIN_LIMITS.maxPixels` 4,194,304; hatch `maxLines` 200,000 and 1,000,000 strokes; ≤ 4096 arc steps per round join;
generated offset pieces ≤ `maxEdges`. Exceeding one throws `WORK_LIMIT` naming the option to change (`maxWork`, `spacing`, `arcTolerance`, the
raster size). Nothing is thinned to fit. Cheap box rejections cost ⅛ of an exact test. Development-machine timings (Node 22, one thread):

| Work | Time |
|---|---|
| strict validation, 1,000 / 20,000 / 50,000 vertices | 3 / 9 / 32 ms |
| union or difference of two wobbly polygons, 1,000 / 20,000 / 50,000 vertices each | 9 / 70 / 180 ms |
| union of two 200,000-vertex polygons (the edge limit) | 0.7–1.3 s |
| two 3,000-vertex spiky stars with ~10⁵ crossings (difference / union hits the work limit) | 0.5 s / limit |
| 4,000-vertex comb of long bars, union with a shifted copy | 40 ms (20,000 vertices: 0.26 s) |
| text "PROCEDURAL" (729 edges): build / offset +4 / hatch 1-unit spacing | 3 / 11 / 1 ms |
| offset ±10 of a 2,000-vertex polygon, round or miter | 85–95 ms |
| clip a 100,000-point polyline to a 2,000-vertex region | 130 ms |
| mask, 1,024² / 2,048² smooth blobs, cells (with simplify 1.5) | 19 (23) / 76 (92) ms |
| mask, 2,048² random noise (worst case, ~10⁶ boundary edges) | 2.2 s |
| labels, 1,024² / 2,048², ~10 labels with simplify | 32 / 118 ms |
| the default `maxWork` spent entirely on crossing-heavy input | ≈ 0.5–1.6 s |

Worst cases are honest: the crossing search is output-sensitive (a lattice of *n* long horizontals and *n* long verticals really has *n²* crossings);
the sweep runs along the axis with less total extent, so combs of parallel bars stay near-linear.

## Explicit non-goals

No curves (inputs are polylines; round joins are inscribed polygons), no self-intersection tolerance without `repair`, no snap-rounding or fuzzy
epsilon option (predicates are exact), no polygon triangulation or straight skeleton, no Minkowski sum of two shapes, no 3D, no automatic union of the
Studio's other simple-polygon routines. Offsets are Boolean-exact but not "constant distance" for miter/bevel (that is the join definition). Text is
unshaped Latin only (the font's own limits).

## Evidence

`tests/composition-domains.test.ts` (42 tests): hand-computed Boolean shapes and vertex lists, nested holes (four-deep XOR), pinched holes, edge and corner contact,
slivers (1e-9), collinear runs, near-parallel wedges, scales 1e-12…1e12, ring start / orientation / argument-order invariance to the last bit, idempotence, seeded
random area identities (`|A∪B| + |A∩B| = |A| + |B|`, difference, xor) over stars with holes, 1e-13 shifts and integer grids, exact per-pixel Boolean checks on random
masks, orientation predicate against independent BigInt arithmetic on near-collinear points, every rejection with its code and message, repair by both fill rules
(pentagram analytic areas), analytic offsets for each join, Steiner formula, dumbbell necks and merging neighbours, clipping partition and boundary runs (including a
slanted edge whose interval midpoint is not representable), hatch area integration and anchoring, mask/label topology, simplification tolerance and topology,
bridges, keyhole area, work limits, cancellation. Mutation check: flipping the winding side test, the wedge selection, the point-in-ring half-open rule, the offset
join placement, the miter limit, the hatch half-open rule, boundary runs in clipping, the pixel pinch rule, the difference predicate and the simplifier's topology
check each fail at least one test (1–29 failing).
