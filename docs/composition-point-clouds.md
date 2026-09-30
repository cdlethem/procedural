# Point-cloud reinterpretation (brief 54)

Status: **implemented on branch `w4/point-clouds`, unreleased. Reviewed from rendered output (SVG through Chromium, 2D projection
and occlusion only) and package tests; not exercised through the real Studio interface and not checked in a WEBGL context.**
Guide: `packages/instruments/guides/point-clouds.md`. It builds on the [spatial foundation F8](composition-spatial.md), the frozen
[composition boundary](composition-reference-slice.md) and [structural operator conventions](composition-structural-operators.md).
Brief 53 (visibility-aware mesh drawing) owns line drawing of meshes; this instrument only borrows the visible-line pass as an
accent over the points.

## What it is

A spatial subject rebuilt from replaceable marks. Points come from bundled surfaces (`sampleSurface` of the F8 figure, vase,
terrain and torus) or two generated clouds (a spiral galaxy, a noise volume). Local structure (curvature, crowding, spacing,
principal direction, height) is estimated from nearest neighbours and drives colour, size and thinning. Points can be cut away
by a plane, thinned by a deterministic rank rule with a chosen ball kept dense, and dispersed. A camera stage projects them with
depth, removes hidden points exactly against the source surface, and draws marks (discs on the normal, strokes and arrows along
a direction, grains, rings, rosettes) and a sparse nearest-neighbour network in one far-to-near sequence, with an optional
visible-line outline. Nothing reconstructs a scan, trains a splat model or infers geometry from an image; host binding of a
user's own mesh or scan is future work (a typed `PointCloud` already goes through every stage).

| Concern | Module | Reuses |
|---|---|---|
| Neighbours (grid k-NN), PCA estimates, ranks, `describePointCloud` | `composition/point-structure.ts` | `derivePointCloud` (added to `mesh-sample.ts`), `memoized` |
| Bundled subjects (mesh samples, galaxy, noise volume) | `composition/point-subjects.ts` | `bundledMesh`, `sampleSurface`, `meshTopology` components, `gradientNoise3D01` |
| Cut, keep (thinning + dense region), dispersion, cut occluder | `composition/point-select.ts` | `selectPoints`, `derivePointCloud`, `meshData`, `mixHash` (exported from `mesh-sample.ts`) |
| Camera fit, viewed points, links, outline | `composition/point-view.ts` | `camera`, `projectPoints`, `visiblePoints`, `hiddenLines`, `meshFeatureEdges`, `meshEdgeCurves` |
| Mark sites, tone ramp, stock marks and link material | `composition/point-marks.ts` | `motif`, `oklabRamp` |
| Composition, stage caches, drawing, preparation | `composition/point-clouds-draw.ts` | `atEach`, `strokeWith`, `pathMaterial`, `tonedMaterial` |
| Instrument, controls, groups, conditions | `adapters/point-clouds-instrument.ts` | |

Two additions to the foundation, made where they belong: `derivePointCloud(cloud, {id?, positions?, normals?, attributes?})` in
`mesh-sample.ts` (the same points, ids and seeds with moved geometry or extra attributes; nothing in F8 could add an attribute or
displace points without renaming them) and `mixHash` exported from the same file (the deterministic integer hash the foundation
already used privately). Everything else is new code that only calls F8.

## Frozen semantics

**Stages and caching.** `pointCloudProducts(recipe)` is the construction chain
`pointSubject -> describePointCloud(neighbors) -> cutPoints -> keepPoints -> dispersePoints -> pointLinks`; each stage is
cached by the construction fields it reads and the whole result by all of them. Camera, palette, marks, sizes, fade, colour, hide
policies, outline and link weight are not in any key: editing them returns the same frozen products (tested by object identity).
`pointCloudScene(recipe, products)` is the camera stage (`pointCamera`, `viewPoints`, `markSites`, `linkPaths`, `outlinePaths`); a
palette-only or mark-only edit reuses the cached view. Fields a choice makes irrelevant (dense region when off, rule strength for
the uniform rule, the cut plane when not cutting, galaxy fields for a vase, an occluder for a subject without a surface) are
normalised away before keying, which is what stops a hidden control from changing the drawing.

**Subjects (`point-subjects.ts`).** Point `k` of every subject depends on `(the fields its kind reads, seed, k)` only, so the first
`n` points of a longer subject are the `n`-point subject (tested for all six kinds). Mesh subjects use the F8 samples at a fixed
mesh detail (vase 5, torus 5, terrain 8, figure fixed) with smooth normals and a `part` attribute (the source face's connected
component: the figure has seven). The galaxy is a Plummer bulge plus an exponential disk with logarithmic-style arms (`part` 0
bulge, `arm + 1`); the noise volume is best-of-24 rejection sampling in the unit ball against octave gradient noise, with normals
along minus the noise gradient. Ids are `p:<k>`; the seed is the instrument seed.

**Structure (`point-structure.ts`).** `nearestNeighbors` is exact (grid with refined cell size, shell search stopping when the
k-th distance is within the searched shells; ties by index). `describePointCloud` adds `spacing` (k-th neighbour distance, floored
at 1e-9 of the diagonal), `density` (`k / (4/3 pi spacing^3)`), `curvature` (surface variation, smallest covariance eigenvalue over
the trace), `principal` (largest eigenvector, first non-zero component positive), `height` (normalised y) and tie-averaged
`curvatureRank`, `densityRank` in [0, 1]. A cloud without normals gains estimated ones pointing away from the centroid. Estimates
are made on the FULL cloud, before cutting and thinning, so they never change when points are removed.

**Thinning (`point-select.ts`).** Every point has a fixed rank `r_i = mixHash(seed, source index)`. With `Keep` t, importance `a_i`
and strength b the keep probability is `p_i = t ^ 2^(2 b (1 - 2 a_i))` (`a` 0.5 for the uniform rule, `1 - densityRank` for
crowding, `curvatureRank` for flatness), plus `w_i (1 - p_i)` for a dense ball (`w` 1 inside `radius (1 - falloff)`, a smoothstep
to 0 at `radius`); a point is kept when `r_i < p_i`. Kept sets are nested in `Keep`, ids and attributes are kept, the uniform
rule keeps the same points as the foundation's `thinPointCloud` for the same count, and thinning a prefix equals the prefix of thinning
the longer cloud. The density-based rules read the full cloud's estimates, so they change if the point count does. The kept count
is a measurement (in expectation `t n` for the uniform rule), not a promise.

**Cut.** `cutPoints` keeps the closed half-space `coord <= centre + at x halfExtent` (or `>=`). The hidden-point occluder is cut with
`cutMesh`, which keeps the faces whose centroid is on the kept side (ragged at triangle scale, open at the cut), so points inside a cut
solid are visible through the opening, and the uncut surface never hides them.

**Dispersion.** Offset `amount x spacing_i x ((1 - bias) g_i + bias t_i n_i)`, `g_i` a seeded point in the unit ball, `t_i` in [-1, 1]:
at most `amount` local spacings, along the normal at bias 1, identity at 0, stable per id.

**Camera.** `pointCamera` fits the frame's bounding sphere (radius from the FULL subject, so cutting and thinning never rescale) to
`Size x 160` canvas units in both projections (perspective fits the silhouette). `depth01` is measured against that sphere, not the
surviving points. `viewPoints` projects with F8 `projectPoints`; `Hide back-facing` drops `facing <= 0`; `Hide behind surface` uses
`visiblePoints(occluder, ..., occluders "all")` (exact, no depth buffer; over its work bound the error names the control). The
galaxy and noise volume have no surface: Hide behind and Outline do nothing there (hidden, and normalised away).

**Marks.** Sizes are canvas units at the target depth. Grains, rings and rosettes are the stock `motif`; arrows and strokes are true
world segments of length `size / zoom` projected at both ends (foreshortening is real); discs are 8 to 24-sided polygons in the tangent
plane whose vertices are each projected. Size factor `1 + sizeByDepth (1 - 2 depth01)`, local scale
`clamp((spacing / median)^localScale, 0.4, 2.5)`, opacity `opacity x (1 - fade depth01)`. Colour is an Oklab ramp of the palette (12 steps
between entries); tones index it.

**Links.** A share of the points are network nodes (fixed hash rank, nested in the share); each node joins its nearest other nodes
within `reach x` the median nearest-node distance when the two normals face the same way; each link is listed once. Links and marks
are painted in ONE far-to-near sequence; a link's painter key is its mean depth pulled toward the eye by 2.5 median point spacings
(otherwise the grains around a link on the surface always cover it: found by looking). The outline (silhouette, or plus creases and
boundary) is chained from mesh edges and classified by `hiddenLines`, drawn last with `pathMaterial` in palette entry 0; covered runs
are dropped or drawn as stitches.

**Ownership and failure.** Producers return frozen values; storage is private and typed arrays are never handed out (accessors copy).
Consumers (`PointCloudConsumers`: mark, link, outline, hiddenOutline) replace stock drawing with ordinary callbacks receiving `PointSite`
and `Path` values. Errors name the control: Points (1 to 40,000; the foundation's limit is 200,000), Neighbors (3 to 16), Link neighbors
(1 to 12), Link nodes, Link reach, Keep, Dispersion, Eye distance (above 1.05 radii), Size, arms, galaxy and noise ranges, the
attribute budget of a cloud passed to `describePointCloud`, more than 100,000 links (`MAX_POINT_LINKS`), more than 250,000 drawn items
(`MAX_DRAWN_ITEMS`), and the visibility solver's work bound (`POINT_VIEW_WORK`, 20 million units). `validateInstrument` rejects
`Points x Link nodes x Link neighbors > 160,000` before drawing. Nothing truncates. Empty results (Keep 0, everything cut, a dense ball
that holds nothing) are valid drawings.

## Controls, by group

| Group | Controls | Conditions |
|---|---|---|
| Subject | `subject`, `vaseProfile`, `terrainVariant`, Galaxy{`arms`, `twist`, `bulge`, `thickness`, `looseness`}, Volume{`noiseScale`, `noiseContrast`, `noiseOctaves`}, Sampling{`count`, `distribution`, `neighbors`} | profile/form/galaxy/volume on `subject`; `distribution` on the four surfaces |
| Placement | `centerX`, `centerY`, `fit` (Size) | one length, no proportional subgroup |
| Thinning | `keep`, `thinRule`, `thinBias`, Dense region{`focus`, `focusX/Y/Z`, `focusRadius`, `focusFalloff`} | bias on a non-uniform rule; region on `focus` |
| Cut | `cut`, `cutAt`, `cutFlip` | plane on `cut` |
| Dispersion | `dispersion`, `dispersionBias` | |
| Mark | `mark`, **Scale** (proportional: `markSize`, `markWeight`), `petals`, `opening`, Direction{`axis`, `axisTurn`, `axisJitter`}, `localScale`, `opacity` | on `mark`: size/localScale/opacity any mark, weight all but grain, opening ring/rosette, petals rosette, direction arrow/stroke |
| Depth | `sizeByDepth`, `fade`, `sort`, `hideBack`, `hideBehind` | `hideBehind` on the four surfaces |
| Links | `links`, `linkNodes`, `linkNeighbors`, `linkReach`, `linkWeight`, `linkColor` | all on `links` |
| Outline | `outline`, `outlineMaterial`, `creaseAngle`, `outlineWeight`, `outlineHidden` | `outline` on the four surfaces; the rest on `outline`; crease angle on Silhouette and creases |
| Color | `colorBy`, `blend` | |
| View | `projection`, `yaw`, `pitch`, `roll`, `perspective` (Eye distance) | eye distance on perspective |

Slider intervals are the convenient span (Points 500 to 12,000, Neighbors 4 to 12, Mark size 0.5 to 24, ...); hard limits are the
measured or semantic ones above. `count` is the only control that sets the population; `keep` and the dense ball only ever remove.
The default is a 6,000-point amphora of discs on the normal coloured by height, depth-faded, with a sparse ink network, hidden points
removed exactly, seen in perspective from 30 degrees yaw and 16 degrees pitch. Seeds: the subject's seed decides where every point
falls (always structural); terrain relief, galaxy arms and noise form change with it, the fixed shapes (vase, figure, torus) are re-dealt.

The shared control audit (`tests/helpers/audit-controls.ts point-clouds`, 3,435 probes, 64 controls) reports **0 violations**. It lists
nine controls as dead at the default (`thinRule`, `thinBias`, `focus*`, `dispersionBias`): each does nothing while `keep` is 1 or `dispersion`
is 0, a numeric disabling that a conjunctive `visibleWhen` cannot state (numeric drivers are not supported), so they stay visible and are
disclosed here; sixteen more are disjunctive or numeric (`count`, placement, camera, depth, colour) and stay visible.

## Checks (`tests/composition-point-clouds.test.ts`, 47 tests)

Independent expected values: neighbours equal brute force exactly (random, clustered with isolated points, and a lattice, ties by
index); a cubic lattice interior has spacing 1, ball density `6 / (4/3 pi)` and curvature exactly 1/3; a planar lattice has zero
curvature, the long-spacing axis as principal direction and a normal along z; estimated normals on a sphere; the eigen-solver
residual, orthonormality, ordering and trace; tie-averaged ranks; the prefix property of all six subjects (both distributions);
unit normals; torus samples on the torus within the faceting error; figure part shares proportional to component area; the
galaxy's bulge and arm shares and straight spokes at zero twist; noise-volume containment and concentration on high noise;
cut half-spaces and the cut occluder's faces against brute force; kept sets nested in `Keep` for every rule with and without a
dense ball; the uniform rule equal to the foundation's seeded thinning and prefix stable; the keep probability equal to
`t^2^(2b(1-2a))` exactly for crafted weights, and the ball's `w (1 - p)`; rule direction (flat first, crowded first); dispersion
bounds, normal-only offsets at bias 1 and per-id stability; links of a full grid equal its edges, reach and side rules; nested node
sets and the link limit naming its controls; orthographic and perspective projection to closed form (canvas position, depth range, the
tangent point of the fitted sphere, ratio of spreads `(D + z) / (D - z)`); depth invariance under thinning; hidden-point removal
against brute-force Moller-Trumbore ray casting in both projections; Hide back-facing exactly `facing > 0`; interior visible only
through the cut occluder; stroke and arrow length for a world axis (full across the view, zero along it), disc polygon area equal
to full area times the cosine of the tilt (and 0 edge-on); size, fade and local scale formulas; ramp indices; camera/appearance edits
returning identical products and the stage identity of views; painter order and link lift; drawing calls per mark and link,
transparency, replaceable consumers; the outline as a separate switch; empty and tiny clouds; admission bounds naming the
controls; declared visibility and the hidden-control invariant on 23 pairs (and the converse on eight).

Mutations proven to fail (failing tests in brackets): keep exponent sign flipped (2), normalised depth divided by R instead of 2R (2),
links ignoring normal facing (1), k-NN stopping a shell early (1), cut keeping the wrong side (2), dispersion ignoring the normal bias
(1), Hide back-facing keeping back faces (1), disc radius doubled (1), link lift removed (1), rank ties not averaged (1), and the uncut occluder used
with a cut (0 at first, which showed the interior test built its own cut occluder; a products-level test now fails it, 1).

## Review record

Rendered through a throwaway SVG surface under the native lease: the default and three seeds; nine strongly different structures
(goblet, faceted figure with strokes and silhouette, crater arrows by facing, dense torus by curvature, five-armed galaxy, noise
volume of rings, thick-skin bottle, cut urn of rosettes, features-thinned amphora with network); camera moves (yaw 0, 60, 120, 180,
pitch 70 and -25, roll, close and far eye); extremes (40,000 one-pixel grains, 300 large discs, a combined dense-head/network/silhouette/
cut figure, unsorted translucent, 25,000 strokes on dunes, bold banded discs); and layered pairs in both orders with the unmodified Polygon
Watercolor, Contour Scores and Motif Ecologies. Depth is real in the images: the interior wall of the vase appears from above and the
base from below, the far half of the torus is hidden by its own surface, discs turn to slivers at grazing angles, and strokes and arrows
foreshorten.

Defects found by looking, and fixed:
1. The first network drew every link between neighbours a few pixels apart in the colour of the grains around it: invisible. Links now join a
   sparse set of NODES (nearest other nodes, reach in multiples of their spacing), default ink colour.
2. Even so the links were buried: grains nearer by a hair covered lines lying on the surface. Links are painted lifted 2.5 median spacings
   toward the eye.
3. Curvature colouring of a smooth surface is sampling noise (a speckle); it is honest, and shows edges and folds where they exist (the
   figure, the thinning bands on the vase). Documented with the control; larger Neighbors smooth it.
4. Ten-sided discs were visibly faceted at 34 pixels: sides now scale with screen radius (8 to 24).
5. The occluder was not cut in the first draft of the products, so a cut solid hid its interior: the cut occluder is part of the products and
   the interior test failed the un-cut mutation.
6. The estimate step cost 190 ms for 6,000 points cold: distance comparisons were `Math.hypot`; squared distances and an allocation-free
   Jacobi eigen-solver brought it to 75 ms cold, 25 ms warm.

Known and left: `Hide back-facing` removes the inside wall of an open vessel (use Hide behind surface); silhouette edges of a cut solid include
the ragged boundary of the cut occluder; the noise volume has no depth cue but colour, size and fade; the vase, figure and torus are the same
shape for every seed.

## Timing

Node 22 on the review machine, which was busy with other workers (so repeated runs varied by up to 2x), drawing into a surface that
discards calls, so these are library costs only; the SVG surface used for review is several times slower and a real canvas differs.
First `prepareInstrument` on a new seed in a warm process; then a camera-only edit (yaw 100), an appearance-only edit (palette and
colour by depth, which reuses the cached view and every construction stage) and a structural edit (a nearby Points value), each
followed by a full draw:

| Case | Points | Marks drawn / links | First prepare | Camera edit | Appearance edit | Structural edit |
|---|---|---|---|---|---|---|
| Default (vase discs, network) | 6,000 | 2,647 / 266 | 0.36 to 0.5 s | 0.15 to 0.17 s | 0.07 s | 0.24 to 0.3 s |
| Large | 12,000 | 5,291 / 491 | 0.36 to 0.77 s | 0.09 to 0.22 s | 0.03 to 0.13 s | 0.34 to 0.39 s |
| 40,000 one-pixel grains | 40,000 | 17,616 / 1,622 | 0.6 to 1.4 s | 0.24 to 0.27 s | 0.06 to 0.14 s | 0.55 to 0.72 s |
| Figure discs, 10% nodes x 4 neighbours | 40,000 | 15,245 / 2,895 | 0.9 to 1.3 s | 0.19 to 0.71 s | 0.12 to 0.34 s | 0.56 to 1.1 s |
| Terrain strokes | 30,000 | 16,704 / 0 | 0.7 to 1.6 s | 0.2 to 0.6 s | 0.08 to 0.2 s | 0.44 to 0.84 s |
| Galaxy grains | 40,000 | 40,000 / 0 | 1.1 to 1.4 s | 0.18 to 0.41 s | 0.11 to 0.16 s | 0.9 to 1.5 s |

Stage costs at the default, warm: sampling 24 ms, neighbour search and PCA 25 ms (cold 75 to 90 ms, 235 ms at 40,000 points), thinning 11 ms,
links 10 ms, projection with exact hidden-point removal 35 to 55 ms, mark sites 9 to 45 ms. A camera edit recomputes the last three;
nothing before them. These are observations, not certified slider ranges: the slider maximum of Points is 12,000, the hard limit 40,000.

## Boundaries and open concerns

- Real Studio interface, layered acceptance in the app and WEBGL are not exercised; a 2D canvas draws the projected geometry.
- Only bundled subjects are selectable; host binding of user meshes and scans is future work, as is reading points from an implicit
  ray march (the F8 doc's route for brief 56: `pointCloud` of hit points and normals already fits this pipeline).
- The occluder for a cut solid is ragged at triangle scale; exact clipping of the surface is not attempted.
- Density-based thinning depends on the whole cloud's estimates, so it changes with `Points`; the uniform rule does not.
- The network is a nearest-neighbour graph of the nodes, re-formed (not merely thinned) as the node share changes.
- `index.ts` gains one import pair, one export block, a palette entry, and one line each in the definitions list,
  `canPrepareInstrument`, draw, prepare and `usesSeed`; no existing drawer changed. Merges with other briefs will touch the same lines.
