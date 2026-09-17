# Genart survey recreation coverage and missing operations

## Current reconciliation — 2026-09-17

The [reviewed reconciliation](../evidence/coverage/reconciliation-2026-09-17.json) compared the **64 pre-batch contracts**
with all 69 blocking families. It corrects only named affected sketches; it does not
repeat or certify the full 800-sketch classification. The original report and ledger are
preserved unchanged in Git commit `c7071577`. All 826 note hashes still match.

| Scope | Plausibly supported | Operation-led subset |
|---|---:|---:|
| Assessed | 474/800 (59.2%) | 381/800 (47.6%) |
| Snapshot | 474/826 (57.4%) | 381/826 (46.1%) |
| Target | 474/901 (52.6%) | 381/901 (42.3%) |

This is **+35 plausible sketches** versus 439, and
**+35 operation-led sketches** versus 346. There are still only
**four demonstrated originals**; reconciliation adds no executed recreation.

The most consequential correction is that `gradient-path` already implements affine
scalar-noise-to-heading tracing. Source inspection also shows `mountain3` and `mountain4`
choose speed once per path. Simplex, nonlinear/summed fields, step-index noise and 3D
walks retain their gaps. Name-only Poisson, spline, offset and edge-detection matches fail.
The full catalog inventory distinguishes frozen pending/draft prose from current bound
validation attestations, which accept 67 p5 cores and scoped native workflows.

Batch 1 adds **three p5 capabilities**, bringing the catalog to **67**: seeded pixel grain,
sampled-field displacement and octave gradient noise. Each has core fixtures and an
editable native study with checked edits, reset/reload and save. Other targets are deferred.
The [batch review](../evidence/coverage/batch1/coverage-review.json) adds **+15 plausible**
and **+15 operation-led** sketches after the 459/366 reconciliation.
Newly demonstrated originals: **0**. Grain failed its preregistered SSIM threshold
**0.674 < 0.7**; displacement and octave studies demonstrate components only.
Transfers are source/contract walkthroughs, not rendered recreations.
[Grain evidence](../evidence/coverage/batch1/seeded-pixel-grain/root-review.json),
[displacement evidence](../evidence/coverage/batch1/field-displace-2d/root-review.json),
[octave evidence](../evidence/coverage/batch1/octave-gradient-noise/root-review.json).
The historical step-0 broad-family upper bounds (488, 516 and 536) are not measured
gains. Random-grey blending, saturation grain, per-fragment shader scheduling, 3D
displacement, simplex/value noise and nonlinear multifractals remain outside the
three contracts. Cases without a verified complete mapping retain their gaps.

### Current family dispositions

Closed means every assessed instance maps; partial means only some instances or a
component maps. A partial overlap earns no gain unless a named sketch mapping closes
its gap. Citations link to the governing catalog clause; detailed mappings and limits
are in the reconciliation JSON. Counts are residual affected / sole remaining gap.

| Family | Verdict | Residual affected / sole gap | Catalog evidence |
|---|---|---:|---|
| `post.pixel-grain` | partial | 50 / 25 | [seeded-pixel-grain/behavior/algorithm](../catalog/operations/seeded-pixel-grain.json) |
| `field.noise-displace` | partial | 42 / 26 | [field-displace-2d/behavior/algorithm](../catalog/operations/field-displace-2d.json) |
| `path.flow-trace` | partial | 27 / 19 | [gradient-path/behavior/advance](../catalog/operations/gradient-path.json) |
| `field.fbm` | partial | 15 / 5 | [octave-gradient-noise/behavior/algorithm](../catalog/operations/octave-gradient-noise.json) |
| `post.vignette` | live | 28 / 0 | [masked-source-over/behavior/compositing](../catalog/operations/masked-source-over.json) |
| `layout.unequal-four-way-partition` | live | 24 / 15 | [seeded-quadrant-partition/behavior/replacement](../catalog/operations/seeded-quadrant-partition.json) |
| `post.color-grade` | live | 20 / 1 | [oklab-ramp/behavior/algorithm](../catalog/operations/oklab-ramp.json) |
| `path.heading-wander` | live | 18 / 7 | [noise-band-path/behavior/transition](../catalog/operations/noise-band-path.json) |
| `layout.conditional-mixed-partition` | live | 14 / 8 | [seeded-quadrant-partition/behavior/replacement](../catalog/operations/seeded-quadrant-partition.json) |
| `layout.variable-grid-partition` | live | 13 / 10 | [seeded-quadrant-partition/behavior/replacement](../catalog/operations/seeded-quadrant-partition.json) |
| `path.unrestricted-grid-walk` | partial | 13 / 11 | [cost-grid-paths-2d/behavior/algorithm](../catalog/operations/cost-grid-paths-2d.json) |
| `field.simplex-noise` | live | 12 / 7 | [gradient-noise-2d-01/behavior/gradients](../catalog/operations/gradient-noise-2d-01.json) |
| `layout.biased-binary-partition` | live | 10 / 7 | [seeded-quadrant-partition/behavior/replacement](../catalog/operations/seeded-quadrant-partition.json) |
| `path.custom-state-walk` | partial | 10 / 4 | [seeded-depth-first-spanning-tree/behavior/algorithm](../catalog/operations/seeded-depth-first-spanning-tree.json) |
| `topology.proximity-graph` | live | 9 / 4 | [delaunay-2d/behavior/input](../catalog/operations/delaunay-2d.json) |
| `layout.box-subdivide-3d` | live | 7 / 7 | [seeded-quadrant-partition/behavior/replacement](../catalog/operations/seeded-quadrant-partition.json) |
| `mark.tapered-line` | partial | 2 / 0 | [parallel-transport-ribbon-3d/behavior/algorithm](../catalog/operations/parallel-transport-ribbon-3d.json) |
| `topology.triangle-subdivide` | partial | 7 / 6 | [loop-subdivide-triangles-3d/behavior/algorithm](../catalog/operations/loop-subdivide-triangles-3d.json) |
| `field.radial-attract-repel` | live | 6 / 5 | [radial-pull-2d/behavior/identity](../catalog/operations/radial-pull-2d.json) |
| `other.long-tail` | live | 6 / 4 | [seeded-line-pool-2d/behavior/transition_specification](../catalog/operations/seeded-line-pool-2d.json) |
| `field.raster-domain-warp` | live | 5 / 2 | [bilinear-raster-remap/behavior/input](../catalog/operations/bilinear-raster-remap.json) |
| `layout.grid-transform` | live | 5 / 4 | [regular-grid/behavior/point](../catalog/operations/regular-grid.json) |
| `layout.quad-subdivide` | live | 5 / 5 | [seeded-quadrant-partition/behavior/replacement](../catalog/operations/seeded-quadrant-partition.json) |
| `layout.retained-parent-partition` | live | 5 / 2 | [seeded-quadrant-partition/behavior/replacement](../catalog/operations/seeded-quadrant-partition.json) |
| `mesh.extrude` | partial | 1 / 0 | [extrude-simple-polygon-3d/behavior/algorithm](../catalog/operations/extrude-simple-polygon-3d.json) |
| `post.directional-mask-blur` | live | 5 / 4 | [convolve-2d-signed/behavior/algorithm](../catalog/operations/convolve-2d-signed.json) |
| `post.scanlines` | live | 5 / 0 | [separable-blur-2d/behavior/filtering](../catalog/operations/separable-blur-2d.json) |
| `sampling.circle-pack` | partial | 1 / 0 | [ordered-circle-filter/behavior/acceptance](../catalog/operations/ordered-circle-filter.json) |
| `geometry.segment-intersection` | live | 4 / 3 | [nearest-segment-contact-2d/behavior/selection](../catalog/operations/nearest-segment-contact-2d.json) |
| `layout.packing-shelf` | partial | 4 / 3 | [skyline-pack-2d/behavior/algorithm](../catalog/operations/skyline-pack-2d.json) |
| `mark.brush-texture` | live | 4 / 0 | [resample-polyline-2d/behavior/algorithm](../catalog/operations/resample-polyline-2d.json) |
| `mesh.point-cloud` | live | 4 / 1 | [poisson-disc-2d/behavior/algorithm](../catalog/operations/poisson-disc-2d.json) |
| `path.recursive-branch` | live | 4 / 4 | [parallel-token-rewrite/behavior/algorithm](../catalog/operations/parallel-token-rewrite.json) |
| `post.chromatic-offset` | live | 4 / 0 | [convolve-2d-signed/behavior/algorithm](../catalog/operations/convolve-2d-signed.json) |
| `post.feedback` | live | 4 / 3 | [raster-crossfade/behavior/compositing](../catalog/operations/raster-crossfade.json) |
| `post.threshold` | partial | 4 / 2 | [floyd-steinberg-dither/behavior/algorithm](../catalog/operations/floyd-steinberg-dither.json) |
| `sampling.poisson-disk` | partial | 4 / 3 | [poisson-disc-2d/behavior/algorithm](../catalog/operations/poisson-disc-2d.json) |
| `topology.polygon-subdivide` | live | 4 / 3 | [loop-subdivide-triangles-3d/behavior/algorithm](../catalog/operations/loop-subdivide-triangles-3d.json) |
| `audio.fft` | live | 3 / 1 | [regular-grid/behavior/environment](../catalog/operations/regular-grid.json) |
| `mesh.displaced-surface` | live | 3 / 1 | [radial-profile-surface/behavior/topology](../catalog/operations/radial-profile-surface.json) |
| `post.spatially-varying-blur` | live | 3 / 2 | [convolve-2d-signed/behavior/algorithm](../catalog/operations/convolve-2d-signed.json) |
| `sampling.polygon-fill` | partial | 3 / 2 | [triangulate-simple-polygon-2d/behavior/algorithm](../catalog/operations/triangulate-simple-polygon-2d.json) |
| `sampling.weighted-choice` | live | 3 / 1 | [adjacency-tile-collapse-2d/behavior/algorithm](../catalog/operations/adjacency-tile-collapse-2d.json) |
| `geometry.open-spline` | live | 2 / 1 | [chaikin-polyline-2d/behavior/algorithm](../catalog/operations/chaikin-polyline-2d.json) |
| `geometry.polygon-boolean` | live | 2 / 0 | [clip-segments-simple-polygon-2d/behavior/clipping](../catalog/operations/clip-segments-simple-polygon-2d.json) |
| `layout.other-rectangle-partition` | live | 2 / 2 | [seeded-quadrant-partition/behavior/replacement](../catalog/operations/seeded-quadrant-partition.json) |
| `mark.dash-pattern` | live | 2 / 2 | [resample-polyline-2d/behavior/algorithm](../catalog/operations/resample-polyline-2d.json) |
| `mesh.shader-displace` | live | 2 / 1 | [radial-profile-surface/behavior/topology](../catalog/operations/radial-profile-surface.json) |
| `path.random-walk-3d` | live | 2 / 1 | [token-turtle-2d/behavior/algorithm](../catalog/operations/token-turtle-2d.json) |
| `post.glow` | live | 2 / 0 | [separable-blur-2d/behavior/filtering](../catalog/operations/separable-blur-2d.json) |
| `sampling.noise-gated` | live | 2 / 2 | [ordered-circle-filter/behavior/acceptance](../catalog/operations/ordered-circle-filter.json) |
| `shader.unknown` | live | 2 / 2 | [convolve-2d-signed/behavior/algorithm](../catalog/operations/convolve-2d-signed.json) |
| `topology.recursive-circle-split` | live | 2 / 2 | [seeded-quadrant-partition/behavior/replacement](../catalog/operations/seeded-quadrant-partition.json) |
| `field.neighbour-displace` | live | 1 / 0 | [sequential-disc-projection-2d/behavior/algorithm](../catalog/operations/sequential-disc-projection-2d.json) |
| `fractal.iteration` | live | 1 / 1 | [gray-scott-step-2d/behavior/algorithm](../catalog/operations/gray-scott-step-2d.json) |
| `geometry.circle-intersection` | live | 1 / 1 | [nearest-segment-contact-2d/behavior/contact](../catalog/operations/nearest-segment-contact-2d.json) |
| `geometry.point-in-polygon` | closed | 0 / 0 | [triangulate-simple-polygon-2d/behavior/algorithm](../catalog/operations/triangulate-simple-polygon-2d.json) |
| `geometry.polygon-offset` | live | 1 / 1 | [offset-polyline-2d/behavior/algorithm](../catalog/operations/offset-polyline-2d.json) |
| `layout.hex-lattice` | live | 1 / 1 | [regular-grid/behavior/point](../catalog/operations/regular-grid.json) |
| `layout.irregular-grid` | live | 1 / 1 | [regular-grid/behavior/point](../catalog/operations/regular-grid.json) |
| `mesh.cone` | live | 1 / 0 | [radial-profile-surface/behavior/topology](../catalog/operations/radial-profile-surface.json) |
| `mesh.depth-sort` | live | 1 / 1 | [extrude-simple-polygon-3d/behavior/algorithm](../catalog/operations/extrude-simple-polygon-3d.json) |
| `mesh.tube-along-path` | partial | 1 / 1 | [parallel-transport-ribbon-3d/behavior/algorithm](../catalog/operations/parallel-transport-ribbon-3d.json) |
| `motion.particle-step` | live | 1 / 1 | [target-springs-2d/behavior/step](../catalog/operations/target-springs-2d.json) |
| `motion.population` | live | 1 / 0 | [seeded-endpoint-branches/behavior/layout](../catalog/operations/seeded-endpoint-branches.json) |
| `post.depth-fade` | live | 1 / 0 | [raster-crossfade/behavior/compositing](../catalog/operations/raster-crossfade.json) |
| `post.edge-detect` | live | 1 / 1 | [convolve-2d-signed/behavior/algorithm](../catalog/operations/convolve-2d-signed.json) |
| `post.lut-3d` | live | 1 / 0 | [oklab-ramp/behavior/algorithm](../catalog/operations/oklab-ramp.json) |
| `sampling.image-driven` | live | 1 / 0 | [bilinear-raster-remap/behavior/input](../catalog/operations/bilinear-raster-remap.json) |

## Historical assessment — 2026-09-13

**All counts and “current” references below describe the original 34-operation
assessment, not current support. The current correction is above.**

**Assessment date:** 2026-09-13  
**Survey snapshot:** [`survey/snapshot.json`](../survey/snapshot.json), survey revision `b64fadf8cc484025f58a112b95630a7b0c420ea3`  
**Per-sketch ledger:** [`evidence/coverage/survey-operation-coverage.json`](../evidence/coverage/survey-operation-coverage.json)

## Executive result

The checked-in snapshot contains 826 notes for the 901-sketch survey target. Twenty-six are
blank-baseline stubs with no computation walkthrough, leaving **800 assessed sketches**.
At structural/technique fidelity:

- **346 sketches (43.3% of the assessed set)** are operation-led plausible recreations: at
  least one of the 34 current catalog operations performs defining algorithmic work and no
  substantive algorithm remains missing.
- **439 sketches (54.9%)** are plausibly recreatable under the full package boundary when the
  93 sketches needing only ordinary Processing drawing, transforms, supplied assets and short
  formulas are included.
- **42 sketches (5.3%)** have their core look covered but retain a secondary algorithmic gap.
- **319 sketches (39.9%)** retain a defining algorithmic gap.
- **26 snapshot sketches are unassessed**, and 75 target sketches are absent from the snapshot.

Against denominators that include unknowns, 346 operation-led cases are 41.9% of the 826-note
snapshot and 38.4% of the 901-sketch target. The broader 439 practical cases are 53.1% and
48.7%, respectively. These are **plausible-support estimates**, not demonstrated recreation
counts. Only four originals currently have implemented, run and root-reviewed structural
recreations:

- [2018/Generativos/curvespace](../evidence/reproductions/curvespace/root-review.json)
- [2019/generativos/momito](../evidence/reproductions/r1-p3d/root-review.json)
- [2019/generativos/ciscis002](../evidence/reproductions/r2-p3d/root-review.json)
- [2019/generativos/parapara](../evidence/reproductions/r3-p2d/root-review.json)

## Interpretation and fidelity boundary

The assessed target is a **structural/technique recreation**, not pixel identity. A different
palette, seed and random-stream schedule are allowed. A defining computation may not be
replaced by a different algorithm. Ordinary host drawing (`line`, `rect`, `ellipse`, shape
vertices, text, transforms, colour, blend modes and native 3D primitives), supplied image/font
assets, loops, random selection and short closed-form geometry are artistic glue. A hidden
contour tracer, partition scheduler, path integrator, packing method, topology builder,
physics step or raster algorithm is not glue.

“Operation-led” is the conservative answer to “primarily the operations currently defined”:
it excludes the 93 cases that are practical but use only the native host boundary. “Plausibly
supported” follows the project's recreation-coverage definition: every defining algorithm
maps to a current operation or ordinary glue, but execution is pending.

## Method

1. Pinned the 826-note survey snapshot and all 34 reviewed operation contracts. The combined
   catalog-file digest is `133dfe793d7f6b3edfaaaaa7a9e93b8e449ccc5365e85e5b7a682738214b78a1`.
2. Read every non-stub `notes.md` through a structured, LLM-assisted classifier. Each record
   names defining computations, current operations, missing computations, central versus
   secondary role, and confidence.
3. Reconciled apparent gaps against exact current semantics rather than accepting name matches.
   In particular, current rectangle, circle-filter, branch, clipping and polyline operations
   eliminated many initial false gaps.
4. Split broad labels into cohesive computational families. “Custom shader” was decomposed
   into grain, colour grade, vignette, scanline/chromatic, directional blur, depth and mesh
   effects; “rectangle subdivision,” “random walk” and “displacement” were similarly split.
5. Computed unique-sketch reach and **sole remaining gap**. Reach counts overlap and must not be
   added. Sole remaining gap is the number of currently unsupported sketches for which that
   one family is the last substantive gap.

This was a report/source walkthrough, not an 800-sketch source audit or render campaign. The
classification is reviewable in the per-sketch ledger; low-frequency and compound cases need
source reading before capability admission. All 800 structured records are complete; 765 were
classified high-confidence and 35 medium-confidence before reconciliation.

## Coverage summary

| Status | Sketches | Assessed share | Meaning |
|---|---:|---:|---|
| Operation-led plausibly supported | 346 | 43.3% | Current operations perform defining work; no substantive gap. |
| Host-only subset of plausibly supported | 93 | 11.6% | No new algorithm needed, but current operations are not materially required. |
| **All plausibly supported** | **439** | **54.9%** | Complete structural computation maps to operations plus allowed glue. |
| Core supported, secondary gap | 42 | 5.3% | Defining look maps, but complete relevant computation does not. |
| Unsupported | 319 | 39.9% | At least one central algorithm remains missing. |
| Unassessed snapshot stubs | 26 | — | Blank baseline; no usable computation walkthrough. |
| Outside snapshot | 75 | — | Part of the 901 target but absent from this snapshot. |

## What the current operations cover

Counts below are unique sketches among the 439 plausible recreations in which the operation
performs mapped work. They are not API popularity and do not establish target/runtime support.
A zero means this notes-only pass did not find a complete plausible recreation using that
operation; it does not invalidate its accepted scoped evidence.

| Current operation | Plausible recreations using it | Computation |
|---|---:|---|
| [`regular-grid`](../catalog/operations/regular-grid.json) | 183 | An immutable row-major rectangular sequence of planar positions with explicit point counts and spacing. |
| [`gradient-noise-2d-01`](../catalog/operations/gradient-noise-2d-01.json) | 126 | An immutable seeded single-octave 2D gradient field with pure binary64 samples in [0,1]. |
| [`cyclic-palette`](../catalog/operations/cyclic-palette.json) | 122 | Immutable ordered opaque sRGB8 palette sampled by a phase in cycles, with linear encoded-channel interpolation and fixed RGB24 quantization. |
| [`delaunay-2d`](../catalog/operations/delaunay-2d.json) | 40 | Produce owned exact planar Delaunay topology from an ordered finite binary64 site list and explicit deterministic work budget. |
| [`stop-ramp`](../catalog/operations/stop-ramp.json) | 39 | Immutable noncyclic positioned RGB24 color stops with piecewise linear sampling and endpoint holds. |
| [`ordered-circle-filter`](../catalog/operations/ordered-circle-filter.json) | 36 | Retain supplied circles in order when their radius-dependent exclusion test permits them alongside earlier accepted circles. |
| [`seeded-quadrant-partition`](../catalog/operations/seeded-quadrant-partition.json) | 33 | Generate an immutable, mutation-ordered sequence of equal-quadrant rectangular leaves from explicit seed, rectangle, replacement count and eligible-list fraction. |
| [`gradient-noise-3d-01`](../catalog/operations/gradient-noise-3d-01.json) | 32 | Immutable seeded single-octave three-coordinate gradient field with pure binary64 samples in[0,1]; independent of Processing noise. |
| [`gradient-path`](../catalog/operations/gradient-path.json) | 15 | Retain a finite two-dimensional trajectory by sampling an explicit gradient field at each evolving position and advancing a fixed distance. |
| [`seeded-circle-placement`](../catalog/operations/seeded-circle-placement.json) | 14 | Place differently sized circles from an explicit seed and finite proposal budget, retaining geometry for independent drawing. |
| [`seeded-endpoint-branches`](../catalog/operations/seeded-endpoint-branches.json) | 8 | Retain a bounded breadth-first endpoint branch tree from an explicit root, portable seed, and ordered generation rules. |
| [`seeded-triangle-points`](../catalog/operations/seeded-triangle-points.json) | 8 | retained batch of seeded uniform planar points in one explicitly supplied triangle. |
| [`clip-segments-simple-polygon-2d`](../catalog/operations/clip-segments-simple-polygon-2d.json) | 7 | Clip supplied segments to a simple concave polygon, retaining source identity and every positive-length interior or boundary interval. |
| [`binary-cell-partition-2d`](../catalog/operations/binary-cell-partition-2d.json) | 5 | Generate retained ordered integer-cell rectangles by attempt-bounded binary cuts with random or longer-axis selection. |
| [`retained-rectangle-cuts-2d`](../catalog/operations/retained-rectangle-cuts-2d.json) | 4 | Retain caller-directed unequal rectangle regions with stable identities and atomic single cuts/removals. |
| [`closed-spline-2d`](../catalog/operations/closed-spline-2d.json) | 3 | Retain a closed uniform Catmull-Rom spline from explicit planar controls with direct parameter and approximate distance queries. |
| [`resample-polyline-2d`](../catalog/operations/resample-polyline-2d.json) | 3 | Sample an explicit open or closed polyline at uniformly spaced traveled distances without smoothing its corners. |
| [`target-springs-2d`](../catalog/operations/target-springs-2d.json) | 3 | Advance an ordered independent target-spring state by one explicit logical step: target force, position using updated velocity, then velocity retention. |
| [`annular-solid-3d`](../catalog/operations/annular-solid-3d.json) | 2 | Generate an owned indexed-triangle closed annular solid from explicit inner and outer radii, two axial planes, angular subdivision, and a required face budget. |
| [`ordered-convex-polygon-filter-2d`](../catalog/operations/ordered-convex-polygon-filter-2d.json) | 2 | Ordered greedy filtering of supplied strictly convex polygon outlines using exact inclusive intersection; retained geometry and original proposal indices. |
| [`radial-pull-2d`](../catalog/operations/radial-pull-2d.json) | 2 | Immutable ordered radial influences that sum inward power-profile displacements at the original point; may fold and self-intersect geometry. |
| [`triangle-coordinate-map`](../catalog/operations/triangle-coordinate-map.json) | 2 | retained planar mapping of caller-provided unit-coordinate pairs through one explicitly supplied ordered triangle. |
| [`nearest-segment-contact-2d`](../catalog/operations/nearest-segment-contact-2d.json) | 1 | Find the first closed-segment contact for each supplied directed query against supplied obstacles, retaining obstacle identity and explicit misses. |
| [`noise-band-path`](../catalog/operations/noise-band-path.json) | 1 | Retain an attempt-bounded connected path whose accepted proposals remain within a strict scalar band around the starting noise value. |
| [`occupied-lattice-paths-2d`](../catalog/operations/occupied-lattice-paths-2d.json) | 1 | Generate ordered retained cardinal cell paths whose cells are claimed by one call-local occupancy set. |
| [`separable-blur-2d`](../catalog/operations/separable-blur-2d.json) | 1 | Normalize two caller-supplied one-dimensional kernels and filter a straight ARGB8 raster horizontally then vertically in premultiplied encoded RGB. |
| [`bilinear-raster-remap`](../catalog/operations/bilinear-raster-remap.json) | 0 | Remap an owned packed ARGB8 raster through explicit source coordinates using edge-clamped bilinear interpolation. |
| [`marching-squares-2d`](../catalog/operations/marching-squares-2d.json) | 0 | Extract ordered isoline segments from an explicit row-major scalar grid with a fixed high-corner saddle rule. |
| [`masked-source-over`](../catalog/operations/masked-source-over.json) | 0 | Composite same-sized straight ARGB8 rasters using an explicit scalar visibility mask. |
| [`radial-profile-surface`](../catalog/operations/radial-profile-surface.json) | 0 | Generate an owned indexed-triangle radial surface from a caller-supplied ordered local axial radius profile, angular subdivision, independent endpoint closures, and explicit face bound. |
| [`raster-crossfade`](../catalog/operations/raster-crossfade.json) | 0 | Crossfade two same-sized straight ARGB8 rasters using explicit per-pixel weights and premultiplied working channels. |
| [`seeded-line-pool-2d`](../catalog/operations/seeded-line-pool-2d.json) | 0 | Generate a retained ordered pool of branching segments by repeatedly cutting selected existing segments. |
| [`sequential-disc-projection-2d`](../catalog/operations/sequential-disc-projection-2d.json) | 0 | Sequentially move supplied points outward toward the boundaries of ordered supplied discs. |
| [`voronoi-cells-2d`](../catalog/operations/voronoi-cells-2d.json) | 0 | Return nearest-site cells clipped to an explicit axis-aligned rectangle. |

## Coverage by survey technique tag

Tags overlap. Percentages use only non-stub assessed sketches carrying that tag.

| Technique | Assessed | Plausibly supported | Core only | Unsupported |
|---|---:|---:|---:|---:|
| `3d-mesh` | 95 | 49 (51.6%) | 8 | 38 |
| `3d-pointcloud` | 41 | 24 (58.5%) | 0 | 17 |
| `agents` | 14 | 8 (57.1%) | 0 | 6 |
| `blend-modes` | 64 | 29 (45.3%) | 5 | 30 |
| `curves` | 89 | 56 (62.9%) | 3 | 30 |
| `distortion` | 134 | 50 (37.3%) | 8 | 76 |
| `dots-stippling` | 208 | 126 (60.6%) | 14 | 68 |
| `flow-field` | 38 | 11 (28.9%) | 3 | 24 |
| `grid` | 430 | 235 (54.7%) | 26 | 169 |
| `image-source` | 33 | 19 (57.6%) | 1 | 13 |
| `l-system` | 1 | 0 (0.0%) | 0 | 1 |
| `lines-hatching` | 147 | 68 (46.3%) | 6 | 73 |
| `noise-field` | 345 | 149 (43.2%) | 23 | 173 |
| `packing` | 85 | 48 (56.5%) | 5 | 32 |
| `particles` | 110 | 48 (43.6%) | 5 | 57 |
| `physics` | 1 | 1 (100.0%) | 0 | 0 |
| `pixel-ops` | 28 | 6 (21.4%) | 6 | 16 |
| `polar` | 172 | 110 (64.0%) | 11 | 51 |
| `recursion` | 27 | 12 (44.4%) | 0 | 15 |
| `shader` | 50 | 2 (4.0%) | 18 | 30 |
| `spiral` | 13 | 11 (84.6%) | 0 | 2 |
| `subdivision` | 144 | 49 (34.0%) | 5 | 90 |
| `symmetry` | 71 | 46 (64.8%) | 2 | 23 |
| `typography` | 15 | 6 (40.0%) | 3 | 6 |
| `voronoi-delaunay` | 54 | 38 (70.4%) | 3 | 13 |

The strongest current areas are spiral (84.6%), Voronoi/Delaunay (70.4%), symmetry (64.8%),
polar construction (64.0%) and curves (62.9%). The clearest exclusions are shader (4.0%),
pixel operations (21.4%), flow fields (28.9%), subdivision (34.0%) and distortion (37.3%).
The one physics-tagged sketch is not evidence of broad physics support.

## Reconciled overlaps: additions that are not needed

Several high-frequency candidate names are already expressible by composition:

- **Minimum-distance grid placement:** all 19 initial claims are covered by `regular-grid`
  plus `ordered-circle-filter`, or are ordinary glue.
- **2D rejection/Poisson-like placement:** 14 of 18 claims are current circle placement/filter
  compositions. Four genuine gaps remain for sphere/3D domains or materially field-varying spacing.
- **Recursive endpoint trees:** 8 of 12 claims fit `seeded-endpoint-branches`; four use interior
  attachments, shared line pools or non-tree content rules.
- **Straight region hatching:** 21 of 22 claims use host-generated parallel lines plus
  `clip-segments-simple-polygon-2d`, or need no clipping. One genuine 3D box-space hatch remains.
- **Tapered marks:** 10 of 17 claims use `resample-polyline-2d` plus progress-sized native marks.
  Seven require continuous ribbon topology, joins or caps.
- **Equal quadrant subdivision:** 8 of 68 initial rectangle claims map to
  `seeded-quadrant-partition`, including `mosaic02`'s ordered-prefix selection. The 60 remaining
  cases separate into unequal four-way, variable-grid, biased binary, conditional/mixed and
  retained-parent families.
- **Per-vertex gradient polygons, annular sectors, regular polygons, polar grids, palette picks
  and supplied assets** are ordinary Processing drawing/input glue at this fidelity. They are
  useful conveniences or portability surfaces, not blockers and not first-priority algorithms.
- **A generic custom-shader operation is not recommended.** The evidence instead supports
  specific reusable raster operations: pixel grain, colour grade, vignette, scanlines/chromatic
  offsets and directional or spatially varying blur.

## Ranked implementation order

This ranking prefers complete-sketch closure and low implementation/maintenance burden. It does
not approve API names or contracts. Each row still needs exact source-neighbour review and the
normal capability-admission process.

- **Affected**: every assessed sketch with this gap, including sketches with other gaps.
- **Sole gap**: sketches unlocked if this family alone were implemented.
- **Sequence projection**: incremental newly plausible sketches after all preceding rows. It is
  an optimistic upper bound assuming one sound operation covers every member assigned to that
  family and no source audit reveals another gap.

| Rank | Candidate family | Affected | Sole gap | Sequence projection | Cost | Decision rationale |
|---:|---|---:|---:|---:|---|---|
| 1 | `post.pixel-grain` | 57 | 29 | +29 → 468 | Low | Small CPU-raster operation; explicit seed, channel/alpha mode and premultiplied-alpha behavior. Reuses the raster boundary already established by blur/compositing. |
| 2 | `path.flow-trace` | 45 | 31 | +31 → 499 | Medium | Closes the large scalar-noise-to-angle advection family. Keep it distinct from `gradient-path`: heading comes from scalar value, not spatial gradient. |
| 3 | `field.noise-displace` | 49 | 28 | +29 → 528 | Medium | Reusable point-coordinate transform for two-channel noise/vector displacement. Do not fold radial attractors or raster sampling into this contract. |
| 4 | `field.fbm` | 30 | 9 | +21 → 549 | Low–medium | Composable octave accumulator over existing gradient noise. Main work is portable arithmetic/RNG semantics, not geometry or rendering. |
| 5 | `layout.unequal-four-way-partition` | 24 | 15 | +15 → 564 | Medium | Largest cohesive rectangle gap: one selected leaf becomes four at explicit non-midpoint x/y cuts. Selection policy must remain separable. |
| 6 | `path.unrestricted-grid-walk` | 13 | 11 | +11 → 575 | Medium | Covers revisiting cardinal/step-set walks excluded by occupied-lattice paths. Must make revisiting, bounds and stop rules explicit. |
| 7 | `layout.variable-grid-partition` | 13 | 10 | +10 → 585 | Medium | Selected leaf becomes an explicit N×M grid. Keep arity and leaf selection separate; do not add per-sketch modes. |
| 8 | `layout.biased-binary-partition` | 10 | 7 | +8 → 593 | Low–medium | A scheduler/convenience over retained cuts for biased leaf selection and continuous split ratios; preferable to widening the exact integer-cell operation. |
| 9 | `path.heading-wander` | 18 | 7 | +8 → 601 | Medium | Bounded continuous position/heading state with explicit turn and step distributions. Separate from field-driven paths and grid walks. |
| 10 | `topology.triangle-subdivide` | 7 | 6 | +6 → 607 | Medium | Retained face pool plus explicit triangle split rule and selection policy. Useful beyond the seven surveyed cases, but topology/ordering need exact semantics. |
| 11 | `layout.box-subdivide-3d` | 7 | 7 | +7 → 614 | Medium–high | Direct seven-sketch closure, but face budgets, 3D ownership and native rendering make it slower than 2D partitions. |
| 12 | `field.simplex-noise` | 11 | 6 | +10 → 624 | High | Eleven sketches use simplex specifically. Independent specification, numeric portability and provenance make this materially costlier than fBm. |
| 13 | `topology.proximity-graph` | 9 | 4 | +7 → 631 | Medium–high | Threshold/nearest-neighbour graph construction removes quadratic artist code. Tie ordering, spatial indexing and workload bounds require careful design. |

The first five families project **439 → 564 plausible sketches** (54.9% → 70.5% of the assessed
set). All 13 project **439 → 631** (78.9%). These are dependency-aware arithmetic projections,
not promised delivery or demonstrated coverage.

### Why this order differs from raw frequency

- Pixel grain ranks first because it is cohesive, cheap and the sole remaining gap for 29
  sketches. A general shader layer would have higher nominal reach but no coherent portable
  semantics and much higher adapter cost.
- Flow tracing and noise displacement are separate. One integrates positions through an
  angle-valued field; the other transforms independent coordinates. Merging them would erase
  useful substitution points.
- fBm has only nine stand-alone unlocks, but it participates in 30 blocked sketches and unlocks
  21 after the first three additions. It composes directly with current gradient noise.
- Rectangle subdivision is split into real algorithms. A single “subdivide” function with modes
  for every survey sketch would be a poor API. Unequal four-way replacement is the first coherent
  slice; variable-grid and biased-binary policies follow separately.
- Unrestricted grid walks and heading wander are not one random-walk API. Their state, topology,
  stopping and reusable outputs differ.
- Simplex noise is delayed despite 11 affected sketches because independent specification,
  cross-target numerics and provenance cost more than composing fBm over the accepted gradient
  field.

## Comprehensive blocking-gap inventory

These are normalized computation families, not proposed public names. **Affected** counts unique
sketches. **Sole remaining gap** is exact under this ledger and is the relevant one-operation
marginal gain. **Central** counts sketches where the family contributes to the defining visible
result. A sketch may occur in several rows.

### audio

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `audio.fft` | 3 | 1 | 2 | [2014/Generativos/Minim/arcos/arcos_pde](../survey/out/2014/Generativos/Minim/arcos/arcos_pde/notes.md), [2015/Generativos/FFt/fft_prueba1](../survey/out/2015/Generativos/FFt/fft_prueba1/notes.md) |

### field

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `field.noise-displace` | 49 | 28 | 48 | [2017/Generativos/burbujas_ani](../survey/out/2017/Generativos/burbujas_ani/notes.md), [2017/Generativos/fields](../survey/out/2017/Generativos/fields/notes.md) |
| `field.fbm` | 30 | 9 | 28 | [2015/Generativos/planets3d](../survey/out/2015/Generativos/planets3d/notes.md), [2017/Generativos/acid](../survey/out/2017/Generativos/acid/notes.md) |
| `field.simplex-noise` | 11 | 6 | 11 | [2018/Generativos/puda](../survey/out/2018/Generativos/puda/notes.md), [2018/Generativos/puda03](../survey/out/2018/Generativos/puda03/notes.md) |
| `field.radial-attract-repel` | 6 | 3 | 6 | [2019/generativos/culin](../survey/out/2019/generativos/culin/notes.md), [2020/generative/01_04/arena](../survey/out/2020/generative/01_04/arena/notes.md) |
| `field.raster-domain-warp` | 5 | 2 | 5 | [2016/Generativos/colorRamp](../survey/out/2016/Generativos/colorRamp/notes.md), [2017/Generativos/acid](../survey/out/2017/Generativos/acid/notes.md) |
| `field.neighbour-displace` | 1 | 0 | 1 | [2019/generativos/colidion](../survey/out/2019/generativos/colidion/notes.md) |

### fractal

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `fractal.iteration` | 1 | 1 | 1 | [2020/generative/01_04/fractal001](../survey/out/2020/generative/01_04/fractal001/notes.md) |

### geometry

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `geometry.segment-intersection` | 4 | 3 | 4 | [2014/Generativos/Forms/forms1](../survey/out/2014/Generativos/Forms/forms1/notes.md), [2017/Generativos/grids](../survey/out/2017/Generativos/grids/notes.md) |
| `geometry.open-spline` | 2 | 1 | 1 | [2018/Generativos/desert](../survey/out/2018/Generativos/desert/notes.md), [2018/Generativos/patopato](../survey/out/2018/Generativos/patopato/notes.md) |
| `geometry.polygon-boolean` | 2 | 0 | 2 | [2017/Generativos/intersecCirclesGrid](../survey/out/2017/Generativos/intersecCirclesGrid/notes.md), [2017/Generativos/nipon](../survey/out/2017/Generativos/nipon/notes.md) |
| `geometry.circle-intersection` | 1 | 1 | 1 | [2016/Generativos/circlesAndGrids](../survey/out/2016/Generativos/circlesAndGrids/notes.md) |
| `geometry.point-in-polygon` | 1 | 0 | 1 | [2017/Generativos/intersecCirclesGrid](../survey/out/2017/Generativos/intersecCirclesGrid/notes.md) |
| `geometry.polygon-offset` | 1 | 1 | 1 | [2018/Generativos/insitu](../survey/out/2018/Generativos/insitu/notes.md) |

### layout

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `layout.unequal-four-way-partition` | 24 | 15 | 24 | [2017/Generativos/cybergrids](../survey/out/2017/Generativos/cybergrids/notes.md), [2018/Generativos/NeoGeo](../survey/out/2018/Generativos/NeoGeo/notes.md) |
| `layout.conditional-mixed-partition` | 14 | 5 | 14 | [2014/Generativos/curdiculasdecuadrados](../survey/out/2014/Generativos/curdiculasdecuadrados/notes.md), [2017/Generativos/nipon](../survey/out/2017/Generativos/nipon/notes.md) |
| `layout.variable-grid-partition` | 13 | 10 | 13 | [2017/Generativos/chinasseForms](../survey/out/2017/Generativos/chinasseForms/notes.md), [2018/Generativos/III](../survey/out/2018/Generativos/III/notes.md) |
| `layout.biased-binary-partition` | 10 | 7 | 10 | [2018/Generativos/azulejos](../survey/out/2018/Generativos/azulejos/notes.md), [2018/Generativos/barab](../survey/out/2018/Generativos/barab/notes.md) |
| `layout.box-subdivide-3d` | 7 | 7 | 7 | [2017/Generativos/subBox](../survey/out/2017/Generativos/subBox/notes.md), [2018/Generativos/ba_o](../survey/out/2018/Generativos/ba_o/notes.md) |
| `layout.grid-transform` | 5 | 4 | 5 | [2014/Generativos/pastelines](../survey/out/2014/Generativos/pastelines/notes.md), [2017/Generativos/grill](../survey/out/2017/Generativos/grill/notes.md) |
| `layout.quad-subdivide` | 5 | 5 | 5 | [2017/Generativos/griddssssdsd](../survey/out/2017/Generativos/griddssssdsd/notes.md), [2017/Generativos/pajaritos](../survey/out/2017/Generativos/pajaritos/notes.md) |
| `layout.retained-parent-partition` | 5 | 2 | 5 | [2018/Generativos/mosaic03](../survey/out/2018/Generativos/mosaic03/notes.md), [2018/Generativos/noisub/noisub002](../survey/out/2018/Generativos/noisub/noisub002/notes.md) |
| `layout.packing-shelf` | 4 | 2 | 4 | [2015/Generativos/uiFuturistGrid](../survey/out/2015/Generativos/uiFuturistGrid/notes.md), [2017/Generativos/pcb](../survey/out/2017/Generativos/pcb/notes.md) |
| `layout.other-rectangle-partition` | 2 | 2 | 2 | [2017/Generativos/quadInQuads](../survey/out/2017/Generativos/quadInQuads/notes.md), [2018/Generativos/quadis](../survey/out/2018/Generativos/quadis/notes.md) |
| `layout.hex-lattice` | 1 | 1 | 1 | [2018/Generativos/hexa](../survey/out/2018/Generativos/hexa/notes.md) |
| `layout.irregular-grid` | 1 | 1 | 1 | [2018/Generativos/montains](../survey/out/2018/Generativos/montains/notes.md) |

### mark

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `mark.tapered-line` | 7 | 3 | 7 | [2018/Generativos/capas](../survey/out/2018/Generativos/capas/notes.md), [2018/Generativos/capasAni](../survey/out/2018/Generativos/capasAni/notes.md) |
| `mark.brush-texture` | 4 | 0 | 4 | [2014/Generativos/cables](../survey/out/2014/Generativos/cables/notes.md), [2014/Generativos/pelosss](../survey/out/2014/Generativos/pelosss/notes.md) |
| `mark.dash-pattern` | 2 | 2 | 2 | [2017/Generativos/lineTextures](../survey/out/2017/Generativos/lineTextures/notes.md), [2017/Generativos/lineTextures2](../survey/out/2017/Generativos/lineTextures2/notes.md) |

### mesh

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `mesh.extrude` | 5 | 2 | 5 | [2015/Generativos/cityPink3d](../survey/out/2015/Generativos/cityPink3d/notes.md), [2015/Generativos/naves/naves01](../survey/out/2015/Generativos/naves/naves01/notes.md) |
| `mesh.point-cloud` | 4 | 1 | 4 | [2018/Generativos/cubitos](../survey/out/2018/Generativos/cubitos/notes.md), [2018/Generativos/floripanos](../survey/out/2018/Generativos/floripanos/notes.md) |
| `mesh.displaced-surface` | 3 | 1 | 2 | [2015/Generativos/cityPink3d](../survey/out/2015/Generativos/cityPink3d/notes.md), [2015/Generativos/planets3d](../survey/out/2015/Generativos/planets3d/notes.md) |
| `mesh.shader-displace` | 2 | 1 | 1 | [2015/Generativos/planets3d](../survey/out/2015/Generativos/planets3d/notes.md), [2020/generative/01_04/monta](../survey/out/2020/generative/01_04/monta/notes.md) |
| `mesh.cone` | 1 | 0 | 1 | [2018/Generativos/ostracity02](../survey/out/2018/Generativos/ostracity02/notes.md) |
| `mesh.depth-sort` | 1 | 1 | 1 | [2019/generativos/cece](../survey/out/2019/generativos/cece/notes.md) |
| `mesh.tube-along-path` | 1 | 1 | 1 | [2017/Generativos/fieeee](../survey/out/2017/Generativos/fieeee/notes.md) |

### motion

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `motion.particle-step` | 1 | 1 | 1 | [2014/Generativos/lovetrigonometri](../survey/out/2014/Generativos/lovetrigonometri/notes.md) |
| `motion.population` | 1 | 0 | 1 | [2015/Generativos/lutFirst](../survey/out/2015/Generativos/lutFirst/notes.md) |

### other

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `other.long-tail` | 6 | 4 | 6 | [2017/Generativos/Circo](../survey/out/2017/Generativos/Circo/notes.md), [2018/Generativos/conecttions](../survey/out/2018/Generativos/conecttions/notes.md) |

### path

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `path.flow-trace` | 45 | 31 | 41 | [2018/Generativos/capas](../survey/out/2018/Generativos/capas/notes.md), [2018/Generativos/capasAni](../survey/out/2018/Generativos/capasAni/notes.md) |
| `path.heading-wander` | 18 | 7 | 16 | [2014/Generativos/cables](../survey/out/2014/Generativos/cables/notes.md), [2014/Generativos/pelosss](../survey/out/2014/Generativos/pelosss/notes.md) |
| `path.unrestricted-grid-walk` | 13 | 11 | 13 | [2017/Generativos/bahu](../survey/out/2017/Generativos/bahu/notes.md), [2018/Generativos/OP/op_014](../survey/out/2018/Generativos/OP/op_014/notes.md) |
| `path.custom-state-walk` | 10 | 4 | 8 | [2014/Generativos/mensajeAutopistas](../survey/out/2014/Generativos/mensajeAutopistas/notes.md), [2015/Generativos/lutFirst](../survey/out/2015/Generativos/lutFirst/notes.md) |
| `path.recursive-branch` | 4 | 4 | 4 | [2014/Generativos/cositocoson](../survey/out/2014/Generativos/cositocoson/notes.md), [2016/Generativos/forms2](../survey/out/2016/Generativos/forms2/notes.md) |
| `path.random-walk-3d` | 2 | 1 | 2 | [2016/Generativos/linesBox](../survey/out/2016/Generativos/linesBox/notes.md), [2018/Generativos/linesspacerects](../survey/out/2018/Generativos/linesspacerects/notes.md) |

### post

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `post.pixel-grain` | 57 | 29 | 20 | [2014/Generativos/circulos](../survey/out/2014/Generativos/circulos/notes.md), [2014/Generativos/circulos2](../survey/out/2014/Generativos/circulos2/notes.md) |
| `post.vignette` | 28 | 0 | 16 | [2015/Generativos/FFt/fft_prueba1](../survey/out/2015/Generativos/FFt/fft_prueba1/notes.md), [2015/Generativos/FFt/prueba3](../survey/out/2015/Generativos/FFt/prueba3/notes.md) |
| `post.color-grade` | 20 | 1 | 9 | [2017/Generativos/boxes](../survey/out/2017/Generativos/boxes/notes.md), [2018/Generativos/capasAni](../survey/out/2018/Generativos/capasAni/notes.md) |
| `post.directional-mask-blur` | 5 | 4 | 5 | [2020/generative/01_04/byes](../survey/out/2020/generative/01_04/byes/notes.md), [2020/generative/01_04/ciruela](../survey/out/2020/generative/01_04/ciruela/notes.md) |
| `post.scanlines` | 5 | 0 | 5 | [2015/Generativos/FFt/fft_prueba1](../survey/out/2015/Generativos/FFt/fft_prueba1/notes.md), [2015/Generativos/cityPink3d](../survey/out/2015/Generativos/cityPink3d/notes.md) |
| `post.chromatic-offset` | 4 | 0 | 3 | [2015/Generativos/dataBall](../survey/out/2015/Generativos/dataBall/notes.md), [2015/Generativos/gridsCircles](../survey/out/2015/Generativos/gridsCircles/notes.md) |
| `post.feedback` | 4 | 3 | 3 | [2014/Generativos/crucesitas](../survey/out/2014/Generativos/crucesitas/notes.md), [2018/Generativos/gaming](../survey/out/2018/Generativos/gaming/notes.md) |
| `post.threshold` | 4 | 2 | 2 | [2016/Generativos/gridAndPoints](../survey/out/2016/Generativos/gridAndPoints/notes.md), [2018/Generativos/paz002](../survey/out/2018/Generativos/paz002/notes.md) |
| `post.spatially-varying-blur` | 3 | 1 | 1 | [2018/Generativos/magik2](../survey/out/2018/Generativos/magik2/notes.md), [2020/generative/01_04/bluurrr](../survey/out/2020/generative/01_04/bluurrr/notes.md) |
| `post.glow` | 2 | 0 | 1 | [2015/Generativos/FFt/prueba3](../survey/out/2015/Generativos/FFt/prueba3/notes.md), [2018/Generativos/lightLines](../survey/out/2018/Generativos/lightLines/notes.md) |
| `post.depth-fade` | 1 | 0 | 1 | [2018/Generativos/pelines3d002](../survey/out/2018/Generativos/pelines3d002/notes.md) |
| `post.edge-detect` | 1 | 1 | 1 | [2016/Generativos/celular](../survey/out/2016/Generativos/celular/notes.md) |
| `post.lut-3d` | 1 | 0 | 1 | [2015/Generativos/lutFirst](../survey/out/2015/Generativos/lutFirst/notes.md) |

### sampling

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `sampling.circle-pack` | 5 | 2 | 5 | [2017/Generativos/studio](../survey/out/2017/Generativos/studio/notes.md), [2018/Generativos/citypop](../survey/out/2018/Generativos/citypop/notes.md) |
| `sampling.poisson-disk` | 4 | 3 | 4 | [2018/Generativos/floripanos](../survey/out/2018/Generativos/floripanos/notes.md), [2018/Generativos/planetes](../survey/out/2018/Generativos/planetes/notes.md) |
| `sampling.polygon-fill` | 3 | 2 | 2 | [2018/Generativos/citypop02](../survey/out/2018/Generativos/citypop02/notes.md), [2018/Generativos/mantel](../survey/out/2018/Generativos/mantel/notes.md) |
| `sampling.weighted-choice` | 3 | 0 | 3 | [2014/Generativos/pelotitas](../survey/out/2014/Generativos/pelotitas/notes.md), [2015/Generativos/bolasPeludas](../survey/out/2015/Generativos/bolasPeludas/notes.md) |
| `sampling.noise-gated` | 2 | 2 | 2 | [2018/Generativos/castles](../survey/out/2018/Generativos/castles/notes.md), [2019/generativos/cucu](../survey/out/2019/generativos/cucu/notes.md) |
| `sampling.image-driven` | 1 | 0 | 1 | [2019/generativos/crb](../survey/out/2019/generativos/crb/notes.md) |

### shader

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `shader.unknown` | 2 | 2 | 1 | [2015/Generativos/uiFuturist](../survey/out/2015/Generativos/uiFuturist/notes.md), [2018/Generativos/process_02](../survey/out/2018/Generativos/process_02/notes.md) |

### topology

| Missing family | Affected | Sole remaining gap | Central | Examples |
|---|---:|---:|---:|---|
| `topology.proximity-graph` | 9 | 4 | 4 | [2015/Generativos/uiFuturistGrid](../survey/out/2015/Generativos/uiFuturistGrid/notes.md), [2018/Generativos/forest](../survey/out/2018/Generativos/forest/notes.md) |
| `topology.triangle-subdivide` | 7 | 6 | 7 | [2017/Generativos/dotTriangles](../survey/out/2017/Generativos/dotTriangles/notes.md), [2017/Generativos/subsbusbu](../survey/out/2017/Generativos/subsbusbu/notes.md) |
| `topology.polygon-subdivide` | 4 | 3 | 4 | [2018/Generativos/tang](../survey/out/2018/Generativos/tang/notes.md), [2018/Generativos/triquadtri](../survey/out/2018/Generativos/triquadtri/notes.md) |
| `topology.recursive-circle-split` | 2 | 2 | 2 | [2018/Generativos/clima](../survey/out/2018/Generativos/clima/notes.md), [2018/Generativos/huevo](../survey/out/2018/Generativos/huevo/notes.md) |

## Demonstrated but nonblocking helper surfaces

The following computations occur in reports but remain ordinary native glue or supplied input at
the declared fidelity. They may justify documentation, templates or later portable drawing
surfaces; they should not outrank workflow-closing algorithms.

| Helper/input family | Sketches mentioning it |
|---|---:|
| `color.palette-pick` | 316 |
| `geometry.annular-sector` | 63 |
| `mark.gradient-polygon` | 63 |
| `geometry.regular-polygon` | 34 |
| `image.asset-source` | 34 |
| `color.palette-sample` | 23 |
| `sampling.disk` | 22 |
| `layout.polar-grid` | 18 |
| `color.hsb-harmony` | 14 |
| `mesh.box-grid` | 13 |
| `field.angle` | 6 |
| `symmetry.reflect` | 6 |
| `motion.easing` | 3 |
| `geometry.bilinear-quad-map` | 2 |
| `utility.shuffle` | 2 |
| `color.palette-extract` | 1 |
| `geometry.circumcircle` | 1 |
| `image.sprite-sheet` | 1 |

The largest three are uniform palette choice (316), annular sectors (63) and per-vertex gradient
polygons (63). Their frequency is real, but their algorithmic burden in Processing is small.
Composition guidance is the appropriate first response unless a cross-target drawing contract is
being admitted.

## Recommended next evidence batch

1. **Pixel grain:** audit 8–10 shader and CPU-pixel neighbours spanning alpha-only grain,
   brightness perturbation, coloured grain and premultiplied-alpha inputs. Do not admit vignette
   or colour grading as modes.
2. **Angle-field trace:** audit `ciserp`, `pelines` as the independent-mark counterexample, one
   paired-endpoint ribbon and one 3D neighbour. Freeze scalar-to-heading mapping, step semantics,
   bounds and retained output separately from mark drawing.
3. **Noise displacement:** audit point, polyline and grid cases plus a raster counterexample.
   Decide whether the output is transformed coordinates or an explicit displacement field;
   keep radial attract/repel and bilinear raster sampling separate.
4. **fBm:** reconcile Processing `noiseDetail`, simplex-based examples and current gradient-noise
   semantics. Establish octave frequency/amplitude, normalization and binary64 order before
   implementation.
5. **Unequal four-way partition:** audit a plain leaf-replacement case, a retained-parent
   counterexample and a noise-gated counterexample. Keep selection scheduling independent from
   the geometric split.
6. Implement one structural recreation withheld from each operation's motivating sketches before
   accepting projected gains. Re-run this ledger only for affected families; do not launch a new
   full render campaign.

## Evidence and limitations

- [Machine-readable per-sketch assessment](../evidence/coverage/survey-operation-coverage.json)
- [Survey snapshot](../survey/snapshot.json)
- [Recreation-count policy](recreation-coverage.md)
- [Artist capability admission](artist-capabilities.md)
- [Current project state](../PROJECT_STATE.md)
- [Current operation catalog](../catalog/operations/)
- [Candidate ledger](../design/phase2/cluster-decisions.json)

The report does not claim exact source fidelity, image similarity, cross-target support or full
901-sketch certification. It does not convert the 439 plausible cases into demonstrated originals.
The 26 blank baselines and 75 absent reports remain unknown. Low-frequency families and every
ranked public boundary require direct source/parent-note review before design; counts alone cannot
justify a confusing API.
