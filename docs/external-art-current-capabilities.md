# Current capability inventory

This is a stock take for planning future p5.js capabilities. It is based on the checked-in operation contracts, validation attestations, package exports and source modules at baseline `c7071577110b271c7a1a295d93729dbf3b737bd0` (2026-09-17). It does not admit a new API or certify the external corpus.

The comparison began with 64 operations at the commit above. Before completion, the separate
[survey-coverage batch integration](../evidence/coverage/batch1/integration-review.json) accepted
three more p5 capabilities: seeded pixel grain, sampled point displacement and octave gradient
noise. The **current stock take is therefore 67 conformant cores, 67 scoped native operations,
106 editable package workflows, 90 web studies and four technique attestations**. All 67 catalog
hash bindings were checked in [this reconciliation](../evidence/external-art/2026-09/capability-binding-check.json).
The default palettes add reusable data without adding a computational operation.

## Support boundary

The current p5.js catalog attests 67 conformant cores and 67 scoped native operations. Four technique-level attestations are recorded. This means the reusable package surface is present and checked within the declared operation scope; it does not mean that every surveyed sketch, renderer, asset type or visual technique is supported. The other target counts are Processing Java 31/31 (26 techniques), py5 10/10 (4), and Android 10/10 (4). These counts come from `PROJECT_STATE.md` and `catalog/validation/*.json`.

The package entry point is `packages/javascript/src/index.js`; the 67 operation IDs are all represented below. Several operations deliberately share implementation modules (for example circle placement, triangle points, branch tree, and geometry adapters). The operation contract, not a filename, is the reusable boundary.

## Reusable operations, grouped by computation

Each row names the computation removed for an artist, followed by its actual reusable output and the material limit. All are p5.js core/native scoped support. `packages/javascript/src/` modules are pure/data-oriented operation code; gallery studies and app adapters add drawing, controls, palette choices, animation loops and composition.

### Fields and state (10)

| ID | Reusable computation and output | Limit |
|---|---|---|
| `field.displace-points-2d` | Maps two supplied samples per point into Cartesian or polar offsets; returns detached points and offsets | Sampling, field generation, connectivity and raster remapping remain external |
| `field.octave-gradient-noise` | Ordered geometric octave sum over the existing seeded 2D/3D gradient profile; returns scalar values and amplitude sum | Same seed per octave; no simplex/value noise, nonlinear multifractal, coordinate feedback or source-Processing replay |
| `field.damped-wave-step-2d` | One synchronous semi-implicit displacement/velocity grid step | Caller supplies state, impulses, iterations and rendering; no stability solver |
| `field.elementary-cellular-rows` | Binary elementary cellular automaton rows | Fixed three-cell rule; no renderer or higher-dimensional CA |
| `field.euclidean-distance-transform-2d` | Distance values from a binary grid | Grid transform only; source masks and display remain external |
| `field.gradient-noise-2d-01` | Pure seeded single-octave 2D scalar field | Independent gradient noise; not Processing-noise compatibility; compose with the separate octave operation |
| `field.gradient-noise-3d-01` | Pure seeded single-octave 3D scalar field | No shader/renderer or Processing noise claim |
| `field.gray-scott-step-2d` | One simultaneous Gray–Scott reaction/diffusion update | No initializer, seeding policy, frame loop or concentration clipping |
| `field.life-like-step-2d` | One synchronous Moore-neighborhood life-like binary step | Rule/grid transform only; no agent model or renderer |
| `field.scalar-grid-curl-2d` | Rotated finite-difference gradient of a scalar grid | Scalar-grid derivative; caller owns integration and boundary meaning |

### Paths and tracing (5)

| ID | Reusable computation and output | Limit |
|---|---|---|
| `path.cost-grid-paths-2d` | Four-neighbor least-cost distances and predecessors | Grid cost field only; no A*/route styling or obstacle drawing |
| `path.gradient-trace-2d` | Fixed-step trajectory sampled from a gradient field | Open forward path; anchors, closure, marks and envelope are external |
| `path.noise-band-trace-2d` | Attempt-bounded path constrained to a scalar noise band | Uses supplied noise and bounded proposals; not general flow tracing |
| `path.occupied-lattice-paths-2d` | Ordered cardinal paths with call-local occupancy claims | Lattice paths only; no maze renderer or global simulation state |
| `path.rk4-vector-grid-trace-2d` | Fixed-step RK4 trace through a bilinearly sampled vector grid | No adaptive solver, field construction or renderer |

### Geometry (15)

`geometry.assemble-segment-chains-2d` (exact-coordinate edge-chain assembly), `geometry.chaikin-polyline-2d` (fixed Chaikin refinement), `geometry.clip-segments-simple-polygon-2d` (segment intervals inside a simple polygon), `geometry.closed-spline-2d` (uniform Catmull–Rom retained curve and queries), `geometry.convex-hull-2d` (positive-winding hull with source IDs), `geometry.marching-squares-2d` (ordered isoline segments with fixed saddle rule), `geometry.nearest-segment-contact-2d` (first closed-segment contact per query), `geometry.offset-polyline-2d` (signed-normal route offset with bounded joins), `geometry.radial-pull-2d` (sum of radial power-profile displacements), `geometry.resample-polyline-2d` (uniform traveled-distance sampling), `geometry.sequential-disc-projection-2d` (one-pass point displacement toward ordered discs), `geometry.simplify-polyline-2d` (deterministic open-polyline simplification), `geometry.token-turtle-2d` (stack-restored token interpretation), `geometry.triangulate-simple-polygon-2d` (strict simple-polygon ear clipping), and `geometry.voronoi-cells-2d` (nearest-site cells clipped to an explicit rectangle).

Limits are intentional: these are planar geometry transforms/generators with explicit finite inputs and work bounds. They do not provide arbitrary solid modeling, collision resolution, packing guarantees, polygon repair, general curve fitting, or drawing. In particular, sequential disc projection explicitly is not containment, collision resolution, clipping, Voronoi or a non-overlap guarantee (`catalog/operations/sequential-disc-projection-2d.json`). Voronoi is now a reusable bounded rectangle-cell operation, while triangulation is topology only.

### Topology and branching (4)

`topology.delaunay-2d` produces canonical vertices, mappings, positive indexed faces, edges and incidence; `topology.seeded-depth-first-spanning-tree` produces discovery-ordered randomized DFS topology; `topology.seeded-endpoint-branches-2d` produces bounded breadth-first branch segments and ancestry; `topology.seeded-line-pool-2d` produces a retained pool by repeatedly cutting selected segments.

These operations return topology/geometry and own their deterministic seed/budget semantics. They do not draw, choose palettes, simulate boids, infer a graph from an image, or provide a general network/agent engine.

### Meshes (5)

`mesh.annular-solid-3d` builds an indexed closed annular solid; `mesh.extrude-simple-polygon-3d` builds a two-plane polygon extrusion; `mesh.loop-subdivide-triangles-3d` performs Loop subdivision; `mesh.parallel-transport-ribbon-3d` builds a transported ribbon; `mesh.radial-profile-surface-3d` builds an indexed surface from an axial radius profile. They return positions/topology and (where specified) flat normals and metadata; they do not render, light, texture, assign material attributes, or constitute arbitrary solid modeling. The current catalog contracts explicitly mark source style, time, renderer and general mesh editing as outside the operation boundary. The app’s mesh studies are projected 2D presentations of these data.

### Raster and image transforms (9)

`raster.seeded-pixel-grain` adds seeded shared-channel brightness or alpha multiplication to a
straight ARGB8 raster, returning detached pixels and next RNG state. It is not a spatial texture
model, pigment simulation or per-fragment shader schedule. Its original benchmark remains failed;
core/native acceptance does not establish recreation.

`raster.bayer-dither` (ordered threshold bits), `raster.bilinear-remap-2d` (edge-clamped packed-ARGB remap), `raster.binary-morphology-2d` (binary neighborhood morphology), `raster.convolve-2d-signed` (signed kernel convolution), `raster.floyd-steinberg-dither` (error diffusion), `raster.masked-source-over-2d` (masked ARGB compositing), `raster.crossfade-2d` (premultiplied ARGB crossfade), and `raster.separable-blur-2d` (normalized horizontal/vertical premultiplied blur) are reusable packed-raster operations. They do not load assets, manage color profiles, expose GPU shaders, or provide an image editor. Their fixed packed format and explicit numeric semantics are part of the limit.

### Color (4)

`color.cyclic-palette` samples an immutable cyclic RGB24 palette; `color.median-cut-quantize` derives a palette and per-input nearest-palette assignments from supplied RGB samples; `color.oklab-ramp` interpolates an Oklab ramp; `color.stop-ramp` samples noncyclic RGB24 stops. These return colors/data. Palette naming, UI editing, asset loading/pixel decoding, compositing policy and artistic color choices belong to the web app/examples.

### Sampling and placement (6)

`sampling.ordered-circle-filter-2d` greedily retains circles; `sampling.ordered-convex-polygon-filter-2d` greedily filters convex outlines; `sampling.poisson-disc-2d` generates minimum-distance points; `sampling.seeded-circle-placement-2d` generates seeded circle proposals; `sampling.seeded-triangle-points-2d` samples uniform points in one triangle; `sampling.triangle-coordinate-map-2d` maps unit coordinates through a triangle. These are explicit finite proposal/sampling primitives. They do not pack arbitrary sprites, guarantee global optimum, infer shapes, or draw marks.

### Layout and partitioning (7)

`layout.adjacency-tile-collapse-2d` propagates explicit tile domains with weighted choices; `layout.binary-cell-partition-2d` makes attempt-bounded binary rectangle cuts; `layout.lloyd-relaxation-2d` moves sites toward bounded Voronoi centroids; `layout.regular-grid` generates row-major positions; `layout.retained-rectangle-cuts-2d` retains directed unequal cuts/removals; `layout.seeded-quadrant-partition-2d` generates equal-quadrant leaves; `layout.skyline-pack-2d` packs supplied rectangles by lowest skyline. Inputs, identities, ordering and budgets are explicit. Content callbacks, panel styling, variable-grid refinement, arbitrary shape packing and backtracking are outside the reusable operations.

### Symbolic and motion (2)

`grammar.parallel-token-rewrite` performs simultaneous bounded token productions; token interpretation is separate in `geometry.token-turtle-2d`. It has no probabilities, context sensitivity, symbol drawing or hidden character splitting. `motion.target-springs-2d` advances independent target-spring bodies one logical step. It has no pointer/clock/RNG, convergence guarantee, collision/topology model or renderer.

## Representative label checks

- Reaction diffusion is real Gray–Scott state stepping (`packages/javascript/src/gray-scott-step-2d.js`), while initialization, replay count and rendering live in studies such as `packages/javascript/examples/reaction-spots/sketch.js` and `reaction-stripes/sketch.js`.
- “Fluid”/flow studies are vector/scalar-grid sampling and tracing (`scalar-grid-curl-2d`, `rk4-vector-grid-trace-2d`, `gradient-trace-2d`); there is no Navier–Stokes fluid solver or particle advection engine.
- Boids are absent: target springs and path/topology primitives do not implement neighborhood separation, alignment, cohesion or flock state.
- Voronoi and Delaunay are reusable bounded operations (`voronoi-cells-2d.js`, `delaunay.js`), but the former is rectangle-clipped and neither is an image-driven tessellation or renderer. Lloyd relaxation composes the Voronoi operation explicitly.
- Grammar is a reusable parallel token rewrite plus a separate turtle interpreter. It is not a general L-system engine with stochastic/context-sensitive productions.
- Mesh operations produce bounded indexed data. The web app’s `apps/web/lib/adapters/` and studies supply projection, lighting-like choices and drawing; those are app/example functions, not portable mesh API claims.
- SDFs are absent. Distance transform is a binary-grid raster distance operation, not a signed distance field or constructive solid geometry system.
- Typography is absent as a general reusable operation. The `glyph-marks` study uses an explicit font asset and placement/drawing glue; font outline extraction, shaping, kerning and arbitrary font loading remain outside the package.

## Notable absent computation families

The inventory should not be read as a future roadmap. It records gaps that external-art corpus comparisons may surface: boids/flocking and general particle agents; fluid/Navier–Stokes solvers; signed-distance fields and CSG; arbitrary 3D solids/mesh editing and subdivision beyond the bounded operation contracts; general font shaping and outline extraction; image segmentation/feature extraction; GPU shader programs and renderer lifecycle; probabilistic/context-sensitive grammar systems; global constraint packing/collision resolution; and audio/video or external sensor inputs. Missing evidence in the incomplete survey snapshot does not prove corpus absence.

## App-only versus package reusable

Reusable: the 67 operation IDs above, their detached numeric/geometry/raster outputs, deterministic RNG/noise/state rules, budgets, and package exports. App/example-only: p5 drawing calls, canvas/WebGL composition, layer affine placement, palettes as named UI objects, source editors, controls, animation loops, asset/font loading, lighting/material presentation, prompt generation, storage and export dialogs. The app can compose the operation outputs into studies such as reaction spots, woven grammar, transported ribbons and projected mesh examples, but those study names do not widen the underlying operation contracts.

Primary evidence paths: [PROJECT_STATE.md](../PROJECT_STATE.md), [catalog/operations](../catalog/operations), [catalog/validation](../catalog/validation), [JavaScript package index](../packages/javascript/src/index.js), [JavaScript source](../packages/javascript/src), [p5 tenfold acceptance](../evidence/web/p5-tenfold/root-review.json), [gallery expansion guide](../docs/p5-gallery-expansion.md).
