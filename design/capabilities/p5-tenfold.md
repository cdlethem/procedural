# Expanded p5 studies and reusable computations

Root capability selection, 2026-09-13. The maintainer requested ten times the
preceding three-operation/six-study expansion and authorized live deployment as
reviewed milestones reach main. The working scope is thirty additional operations
and sixty original studies. Useful independent computations determine admission;
the count does not justify aliases or study-specific public algorithms. Java,
py5 and Android are deferred. An independent architecture challenge informed this
selection; root retains contract and final support decisions.

Before this expansion the p5 gallery has thirty studies backed by thirty-four
operations. The additions below remove caller-written algorithms across three
coherent areas. None is yet a demonstrated new original-sketch recreation. All
sixty proposed compositions are design tests awaiting implementation, meaningful
edits and native visual review. Existing corpus support is unchanged; unassessed
survey records remain unassessed. No inference is made from missing reports.

| Proposed computation | Artist task / work removed | Alternative and reusable output | Meaningful edit / transfer study |
|---|---|---|---|
| Chaikin refinement | Round angular outlines through repeated corner cutting | Resampling preserves corners; return refined open/closed points | Change refinement passes; panel outlines to flowing brush paths |
| Polyline simplification | Abstract a path while retaining selected original corners | Uniform resampling adds samples without selecting significant corners; return points and source indices | Change tolerance; terrain abstraction to gesture skeletons |
| Polyline offset | Draw parallel margins with bounded corner joins | Scaling changes distance to each edge; return joined offset points | Change signed distance/miter limit; road margins to nested contour strokes |
| Convex hull | Enclose supplied scattered sites without sorting boundary turns by hand | Voronoi divides space rather than encloses a set; return boundary and source indices | Change site subsets; scatter envelopes to terraced islands |
| Simple-polygon triangulation | Fill a concave silhouette with usable triangles | Existing point-set triangulation need not respect the polygon boundary; return indexed triangles | Edit concavity; faceted fills to area-weighted grain |
| Segment-chain assembly | Reconnect extracted fragments into paths | Marching squares emits independent segments; return ordered chains and edge indices | Change extracted levels or fragments; stitched terrain to reconstructed line drawings |
| Poisson-disc sampling | Scatter marks with a fixed minimum spacing and active-frontier distribution | Existing independent placement/packing follows another proposal process; return points and explicit RNG state | Change separation; stipple to spaced symbols |
| Lloyd relaxation | Repeatedly move sites toward their bounded cells' centroids | Compose existing Voronoi; return new sites without replacing the cell generator | Change iteration count/strength; relaxed stone mosaics to migration trails |
| Skyline rectangle packing | Fit supplied aspect ratios into a canvas | Space subdivision invents regions instead of fitting supplied items; return placements and unplaced IDs | Change sizes/order; poster blocks to contact sheets |
| Cost-grid paths | Route through obstacles and spatial travel costs | Direction-field integration does not solve accumulated least cost; return distances/predecessors | Edit obstacles/costs; road routes to arrival contours |
| RK4 vector-grid traces | Follow an explicit sampled field with higher-order integration | Noise-specific path operations do not substitute arbitrary vector grids; return trajectories | Change field/step size; vortex lines to guided ribbons |
| Gray–Scott step | Evolve interacting reaction/diffusion concentrations | Blur alone omits coupled reaction state; return next concentration grids | Change feed/kill or initial state; islands to stripe masks |
| Life-like cellular step | Grow rule-driven binary colonies | Drawing occupied cells does not implement synchronous neighborhoods; return next grid | Change birth/survival sets; colony carpets to temporal relief |
| Elementary cellular rows | Build successive rows from an explicit neighborhood rule | Independent random rows lose causal structure; return ordered generations | Change rule/initial row; tapestries to radial rule bands |
| Scalar-grid curl | Turn a scalar potential into a circulation field | A point noise sample is not a finite-difference field operator; return vector samples | Change potential/spacing; arrow maps to circulating paths |
| Damped wave step | Propagate ripples from explicit displacement/velocity | Independent rings cannot evolve interacting state; return next paired grids | Change initial disturbances/damping; interference to vibrating weave |
| Parallel token grammar | Expand symbolic structure without sequential-rewrite mistakes | Branch geometry helpers do not rewrite arbitrary symbols; return tokens | Change productions/generations; tile bands to botanical text |
| Planar turtle | Interpret retained drawing and branching commands | Grammar rewriting alone has no geometric interpretation; return segments and state | Change turns/steps; botanical fans to space-filling paths |
| Constraint tile collapse | Place adjacency-compatible tiles with explicit contradictions | Random tiling has no constraint propagation; return domains/choices and RNG state | Change adjacency/initial domains; cable fields to terrain mosaics |
| Seeded spanning tree | Connect supplied graph vertices without cycles | Geometric branching does not choose a spanning subset of supplied edges; return selected edge IDs | Change graph topology/seed; labyrinths to radial veins |
| Floyd–Steinberg diffusion | Convert tone to a limited palette while propagating quantization error | Thresholding ignores accumulated error; return quantized raster/indices | Change palette; two-tone fields to limited-palette landscapes |
| Ordered Bayer dithering | Control tone with a repeatable threshold screen | Error diffusion is history-dependent rather than spatially periodic; return quantized raster | Change matrix scale/phase; gradient tiles to mask screens |
| Signed 2D convolution | Extract directional features and emboss scalar rasters | Existing separable blur has nonnegative separable kernels; return signed scalar grid | Replace kernel; relief to directional engraving |
| OKLab ramp | Interpolate colors through a defined perceptual color space | Existing encoded-RGB ramps follow a different path; return supplied-count colors | Change endpoints; contour coloring to woven gradients |
| Median-cut quantization | Derive a bounded palette from supplied colors | User-supplied palettes cannot extract representative colors; return palette and assignments | Change palette size; reduced posters to palette quilts |
| Euclidean distance transform | Find distance to mask features without all-pairs pixel searches | Convolution is local weighted combination, not nearest-feature distance; return distance grid | Change mask; clearance rings to embossed lettering |
| Binary morphology | Expand/erode masks using explicit structuring elements | Thresholding does not perform neighborhood set operations; return mask | Change element/iterations; growing borders to stencil repair |
| Polygon extrusion | Build capped indexed solids from an explicit simple outline | Radial-profile surfaces rotate a profile; compose new polygon triangulation and return mesh | Change profile/height; concave towers to layered badges |
| Transported ribbon sweep | Carry a stable transverse frame along a 3D centerline | Independent look-at frames can twist discontinuously; return ribbon mesh | Change path/width/initial frame; stream ribbons to knot bands |
| Loop subdivision | Refine a manifold triangular mesh with specified smooth weights | Sampling a parametric surface does not refine arbitrary supplied topology; return mesh | Change iterations/base mesh; pebbles to folded patches |

The public surface keeps geometry, state and raster arrays separate from p5
drawing. Each operation has a required explicit work budget and deterministic
ordering. Stochastic operations own explicit input/output state. Parameters are
independent design choices with no inferred corpus defaults or recommended ranges.
Study configurations will be bounded and tested independently from library bounds.

Compound Lloyd relaxation must reuse the accepted Voronoi implementation;
extrusion must reuse reviewed polygon triangulation. Sobel is a convolution
study, not another operation. Surface-of-revolution duplicates the existing
radial-profile capability and is excluded. Short metaball, color styling, domain
warp and scalar-composition formulas stay editable in studies. These decisions
avoid gaining apparent surface area by renaming existing behavior.

Scope excludes robust general polygon Booleans, holes in extrusion, arbitrary
solid modeling, general constraint backtracking, text shaping, shader/compute
acceleration, renderer-independent image identity and other-language ports.
Near-degenerate floating-point topology and simulation stability need explicit
contract limits. New algorithms add mathematical inputs and maintenance costs;
examples must expose artist controls without requiring callers to reimplement the
algorithm. The test suite will distinguish topology/state rules, malformed input,
work exhaustion and owned outputs. Native acceptance is scoped to selected p5
study controls, reuse, reset/reload/save and visually reviewed output.

Contract drafts live under design/operations/p5-tenfold-*.md until root resolves
ambiguities and freezes catalog entries and analytical fixtures. Draft presence
is not support acceptance. Implementation, native and technique status remain
separate and bound through catalog validation records. Production deployment
follows reviewed commits on main, with live route and render checks before a
deployment is reported complete.
