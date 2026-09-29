# Value Regions (brief 31)

Status: implemented on branch `w2/connected-value-regions`, unreleased; reviewed from rendered output only (a
throwaway SVG surface rasterised with Chromium), not through the real Studio interface. Built on the merged
[raster and image-structure](composition-raster-structure.md) and [planar domains](composition-domains.md)
foundations and the frozen [reference slice](composition-reference-slice.md) /
[structural operators](composition-structural-operators.md) conventions. Two foundation gaps were closed in the
foundation modules (below); no segmentation, tracing, offsetting, hatching or path-material code was rewritten.

Files: `src/composition/value-regions.ts` (producer: regions, arcs, adjacency, hierarchy, retention),
`value-regions-draw.ts` (fillers, outline, work bound, descriptor, draw/prepare, binding),
`src/adapters/value-regions-instrument.ts` (definition), `guides/connected-value-regions.md`,
`tests/composition-value-regions.test.ts` (24), two added foundation tests in `tests/composition-domains.test.ts`.
Shared-file hunks: `src/index.ts` (imports, exports, one definitions entry, palette, draw/prepare/`usesSeed`, the
`canPrepareInstrument` chain), `metadata.json` (entry), `compartments.ts` (`lightness` exported),
`compartments-draw.ts` (`compartmentInk` accepts anything with color, tone and coverage: a type-only widening).

## Artist-facing brief

A small number of coherent shapes from a picture, rather than disconnected same-color pixels. The artist chooses how
values become bands (equal widths, equal pixel shares, or three cuts), how strongly the values are smoothed first,
whether corner contact connects pixels, how small a shape may be before it is merged into a neighbour (and into which),
how far the boundaries are simplified, which share of the shapes is kept (chance, area, tone, depth) with a gutter
between fills, how each shape is filled (flat, hatching by tone, marks or contours nested in the polygon) and how the
boundaries are outlined (ink, stitches, beads). Output: the region hierarchy, adjacency and boundary graph with stable
ids, the polygons, and the drawing. Four synthetic bundled pictures ship; the default is the portrait cut into about ten
tone-hatched shapes with an ink outline.

## Frozen input contract

The library never fetches or decodes. `ValueRegionOptions.source` is a resolved `Raster`. The instrument stores only
its technique id, scalar controls and palette, so it can only name a bundled sample (`image`, `variant`, `resolution`);
a recipe may also carry `{ kind: "raster", raster }` (identified by content hash, not JSON-serialisable). Binding a
host-owned image to a Studio layer is future host work.

## Frozen semantics (`valueRegionMap`)

Pipeline: crop + place (`coverCrop`, `rasterMapping`) -> value per pixel (`valueField`: lightness, luminance, luma or
saturation; transparent pixels excluded from every region) -> optional Gaussian `smoothValues` (`smoothing`, canvas units) ->
`segmentValueBands` (equal, balanced or explicit cuts; explicit 4 or 8 connectivity; `minArea`/`merge` policy) ->
`labelDomains` (pixel space, `cell` 1, `protectFrame`, `simplify`) -> one shared affine map to canvas -> `planarDomain`
(strict validation) per region.

- **Regions** (`ValueRegionShape`): id `v<index of the first pixel>` in the cropped image, exact `pixels`, polygon `area`,
  `bounds`, `centroid`, `band`, `mean` value, mean color (linear light, alpha weighted, straight sRGB), CIE `tone`, `coverage`,
  long `axis` (radians, [0, pi)) and `elongation` (1 - sqrt(minor/major variance), pixel squares included), `parent`, `depth`,
  `children`, `neighbors` (id and shared length), `open`, and the `domain`. Ordered by first pixel.
- **Connectivity.** Same-band components never join through another band. Under 8, corner contact joins pixels; the region's
  `domain` then has several pieces touching at points (never overlapping).
- **Hierarchy.** `parent` is the region owning the smallest hole that contains the region's largest piece (every outer vertex
  on or inside the hole ring, exact predicates); roots have `parent: null`.
- **Boundary graph** (`arcs`). Every boundary edge is in exactly one arc, oriented with `left` on its left (the domain
  convention); `right` is the other region or `null` (picture frame, transparent pixels). Arcs end where three or more
  edges meet; closed arcs start at the lexicographically smallest vertex. Id `<left>|<right or ~>#<k>`, k by first vertex.
  `adjacency` sums arc lengths per region pair. Vertices are exactly equal on both sides of a shared edge.
- **Simplification.** Douglas-Peucker in Saalfeld's form from the foundation: shared chains are thinned once. Verified: topology
  (ids, parents, holes, adjacency) unchanged, regions tile the picture (areas sum to the footprint to 1e-6), every exact
  vertex within the tolerance of the thinned boundary.
- **Identity.** No appearance value enters the map. `seed` labels regions (`componentSeed(seed, id, "region")`); the partition
  is a function of content and construction alone. Analyses are cached by construction (6), seeded maps per seed (12); all
  values deeply frozen.
- **Retention** (`keptValueRegions`): `chance` (a stable per-region draw below the fraction) or rank rules (`largest`,
  `smallest`, `dark`, `light`, `enclosed`, `outer`; keep the first round(fraction x count)); raising the fraction only adds.
- **Failure.** Explicit errors naming the control: `minArea`/`smoothing`/`bands`/`resolution` (region bound 800, hard 5,000),
  `smoothing` (over 64 source pixels), cuts not rising, `simplify` (300,000 vertices), crop and pixel bounds.

## Consumers (`valueRegionFiller`, `drawValueRegions`)

Fillers draw in world coordinates and receive `{ shape, domain }`, the domain being the polygon pulled in by half the gutter
(`offsetDomain`, exact, mitre joins, each piece shrunk on its own; a region the gutter erases is not drawn; with no fill the gutter is not applied). The exact
offset of a very jagged piece can be rejected by the kernel as too nearly degenerate (`NOT_CONVERGED`, found by the hidden-control property test on the
noise picture with corners joined); the distance is then retried nudged by a relative 1e-7 (then 1e-5), and only if all five tries fail is an error naming
`gutter` or `nestedInset` raised. Flat: `keyholeRing` per piece through `fillRings`
(holes stay open), with a same-color hairline only when there is no gutter and the body is solid. Hatch: `hatchDomain` (exact,
holes respected, anchored to the origin so neighbours with equal spacing and angle continue each other), spacing
`spacing x 2^(toneResponse x (2 tone - 1))`, direction = base angle (+ long axis in `along` mode for regions with elongation
at least 0.2) + `bandTurn x band` + stable jitter, second layer below `crossBelow`. Nested: `regionGeometry` (the `regionFill`
machinery: at most 80 Poisson sites, or contour lines of a seeded field, built for the region's bounding box) kept only inside the
polygon (sites strictly inside the polygon inset by clearance and mark radius; contour lines cut exactly with `clipPaths`), drawn
with `motif` and `pathMaterial`; `mixed` chooses motifs or contours per region by a stable draw. Colors are `compartmentInk`
(shared with Adaptive Compartments) plus a `ramp` through `paletteRamp`. The outline strokes the map's arcs with `pathMaterial`
(every arc bordering a retained region) so a shared edge is drawn once and stitches are never doubled.

Work bound: `MAX_VALUE_REGION_UNITS` = 80,000 units of the counted run work (region loop, polygon pieces, hatch strokes counted
exactly from the cached strokes after a box-based line bound, nested sites/paths, outline vertices and stations); the message names
`hatchSpacing`, `markSpacing or minArea`, `contourLevels or minArea` or `outlineSpacing (or use ink)`. Tested: run work never exceeds
the count.

## Controls (groups; `visibleWhen` inline)

- **Source**: `image`, `variant`, `resolution`, `measure`; **Crop** `zoom`, `focusX`, `focusY`.
- **Placement**: `centerX`, `centerY`; proportional **Size** `width`, `height`.
- **Regions**: `bandMode` (equal / balanced / manual), `bands` (equal, balanced), **Cuts** `cut1..cut3` (manual; must rise),
  `smoothing`, `corners`; **Merging** `minArea` (% of the picture), `merge`.
- **Boundary**: `simplify`.
- **Negative space**: `retained`, `keepBy`, `gutter` (visible when a fill is drawn).
- **Filler**: `fill`, `color`, `body`; **Hatching** (visible under hatch) `hatchDirection`, `hatchSpacing`, `hatchWeight`,
  `hatchAngle`, `toneResponse`, `crossBelow`, `crossAngle`, `bandTurn`, `jitter`; **Nested** (visible under nested) `nestedKind`,
  `mark`, `markSize`, `markSpacing` (motifs, mixed), `contourLevels`, `contourMaterial` (contours, mixed), `nestedWeight`, `nestedInset`.
- **Outline**: `outline`, `outlineColor`, `outlineWeight`, `outlineSpacing` (stitches, beads).

Only **Size** is proportional (footprint width and height). Slider intervals: resolution 48-192 (hard 16-384), bands 2-8 (hard 2-64),
smoothing 0-12 canvas units (hard 200), smallest region 0-10% (hard 60%), simplification 0-12 (hard 200), gutter 0-12 (hard 200); numeric
domains are wider than the sliders wherever the geometry allows. The seed matters where chance is used and only there
(`valueRegionsUsesSeed`): chance retention below 1, hatch jitter above 0, nested fills.

## Foundation changes (in the foundation modules, tested there)

1. `smoothValues(grid, sigma)` in `image-structure.ts`: the separable Gaussian `orientationField` already used, extracted as
   `gaussianSmooth` (bit-identical arithmetic; every orientation-based drawing fingerprints unchanged) and exposed for `ScalarGrid`s.
2. `RasterOptions.protectFrame` in `domains-raster.ts` (opt-in, default unchanged): the four frame corners are anchors, so
   simplification never cuts a corner off the picture.
3. `simplifyRingSet` in `domains-simplify.ts` accepted chords whose swept area contained a small ring: the ring changed sides
   (a hole vanished from its region and the domains overlapped). Found by the coarse-tolerance property test (12 of 1,200 random
   label rasters); fixed with an exact "no live vertex strictly inside the loop formed by the run and its chord" check
   (`enclosesOther`), verified by 20,000 random rasters at tolerances 0.5-12 pixels with strict validation, area conservation and
   unchanged adjacency and hole structure. Timing unchanged (labels 256 / 1,024 / 2,048 squared with simplify: 31 / 48 / 116 ms).

## Evidence

`tests/composition-value-regions.test.ts` (24 tests): concentric squares with hand-computed areas, hole rings, hierarchy, adjacency
lengths and arcs; checkerboards under 4 and 8; regions equal an independent flood fill on six random pictures under both
connectivities; shared-edge partner for every ring edge (before and after simplification 0 / 2.5 / 7), every boundary edge in exactly
one arc with the correct owner, arc interiors never at a junction, arc sides confirmed by exact point location just left and right;
simplification keeps topology and the tolerance; frame corners; merge policies on hand-worked pixels; balanced bands (25/25/25/25);
transparent pixels; freezing, caching, seed independence; retention monotonicity; failures; Gaussian smoothing against direct
convolution; flat fill area and holes; gutter areas (analytic) and clearance; hatch inside exactly one polygon and spacing by tone
against the closed form; outline length equals every perimeter counted once; nested clearance; the default on every bundled
picture; appearance vs structural edits (map identity); hidden controls; counted work covers what is drawn.

**Mutations confirmed to fail** (10 tried): connectivity fixed at 4 (2 tests); hierarchy by the largest enclosing hole (1);
hatch spacing wrong way (1); flat fill without holes (1); gutter grows (3); outline strokes shared edges twice (1); frame corners not
protected (4); island check disabled (2); balanced cuts by equal widths (4); smoothing renormalisation dropped (1). One
candidate ("arcs ignore the region pair when continuing") is equivalent (two edges at a vertex always bound the same pair) and
the redundant check was removed instead.

## Measured (Node 22, this machine)

| Work | Time |
|---|---|
| first prepare of the default (raster generation, segmentation, tracing, hatch) | 56 ms |
| appearance-only edit (color, weights, outline color / hatch spacing / gutter 3) | 1 / 2 / 16 ms |
| structural edit (5 bands / 8 bands, 192 px, minArea .05, simplify 1) | 24 / 63 ms |
| noise, 192 px, 712 regions, corners on (prepare / draw into a no-op surface) | 91 / 54 ms |
| nested contours / motifs on the portrait (prepare) | 66 / 15 ms |

## Defects found by looking (and by the tests) and fixed

- Default boundaries showed pixel staircases at simplification 2.5 (a pixel is 4.4 units): default now 4.
- The picture frame lost corners to simplification (a triangle of paper at a corner): `protectFrame`.
- Simplification made regions overlap when a small ring lay between a chord and the boundary it replaced: fixed in the foundation (above).
- The first work estimate under-counted concave hatch strokes and stitch vertices (run work exceeded it): counts are now exact.
- The first hierarchy default showed no nesting on the portrait; the test now asks the geometric scene, and the guide says so.

Images reviewed: defaults on the four bundled pictures, seeds 1-3 with retention .8, 24 strongly different settings (silhouette,
cut paper with gutter and accent outline, engraving, negative space with stitches, nested motifs/contours/mixed, corners off/on on
noise, smoothing 0/8, manual cuts, enclosed retention, dense 8 bands at 192 px, outline-only beads, ramp color, saturation, zoom 2 and 4,
extreme minArea/simplify/smoothing/gutter, largest/dark retention), one large noise view, and six layered panels with the unmodified
Contour Scores and Motif Ecologies in both orders.

## Open concerns and conservative choices

1. `minArea` is a share of the footprint, not of the crop; a zoomed crop therefore keeps smaller shapes relative to what is visible.
2. Simplification is in canvas units, so it is gentler on a zoomed crop (a pixel is larger); the guide says so.
3. Under 8-connectivity a region may consist of pieces touching at single points; `domain.regions` lists them, `pixels` and `area` cover all.
4. `hierarchy` is by enclosure in a hole only (a region touching two neighbours is not nested); regions touching the frame are `open`.
5. Nested content uses `regionFill`'s own bound of 80 sites per bounding box; large regions get sparse marks by design.
6. Colour grouping by clustering (k-means) is not offered: bands are value quantisation of one scalar; a clustering producer could feed `segmentValueBands` a
   label-like grid later. Palette extraction is deliberately not treated as segmentation.
7. Host binding of user images is future work; `protectedEdges` from the roadmap wording is not built (the frame corners are the only protected vertices).
