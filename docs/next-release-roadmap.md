# Next release: composable instruments and a much larger creative vocabulary

Authoritative product and implementation direction, 27 September 2026. Baseline:
[`web-toolkit-v0.2.2`](https://github.com/cdlethem/procedural/releases/tag/web-toolkit-v0.2.2),
source `189b288e42965d7b2a179103c13160f004216349`. Proposed successor: **v0.3.0**,
because typed technique inputs and composition change the package boundary. This is a
plan, not implementation acceptance or a promise of cross-target parity.

[Current progress](next-release-progress.md) records execution state. This document owns
release scope; [delivery roadmap](roadmap.md) positions other workstreams. Historical
58-family plans remain research evidence, not this release's missing-feature list.

## 1. Release outcome

An artist should be able to build an image by combining mechanisms, not by searching for
one instrument that happens to hardcode the entire desired picture. Choose where things
happen; choose what happens there; let the result become input to another technique.

The proposed scope is **56 substantial study/capability briefs**, organized into eight
areas. They are not 56 new algorithms or necessarily 56 gallery tiles. Several substantially
extend existing instruments; others are compositions with no new computational kernel.
A single discoverable family can contain several useful constructions. Do not count dots,
crosses and flowers on the same scatter as three new techniques. Do not shrink this program
to a small initial batch and describe that as completion: waves are implementation order,
not permission to silently drop the later capabilities.

Three equally necessary deliverables:

1. **Functional technique composition.** Ordinary functions for programmers; typed,
   serializable construction choices in Studio, backed by those same functions.
2. **A broad artistic vocabulary.** The briefs below connect observed visual needs to
   reusable mechanisms, meaningful controls, layer partners and concrete checks.
3. **A usable apparatus of discovery.** The artist can inspect an intermediate, substitute
   a component, preserve a promising structure while changing its material, and build
   an intentional layered canvas without programming a renderer from scratch.

### What is already present

The release contains **117 workflow IDs / 99 canonical instruments / 14 discovery
families**. These differ from the p5 toolkit's 89 accepted operations and 125 package
workflows. Family consolidation does not eliminate the underlying capabilities.

| Already available | Next-release distinction; do not reinvent the left column |
|---|---|
| Spaced Marks, circle/convex-polygon filtering, Packed Shapes | Interchangeable callbacks and explicit local context; later, actual non-convex packing |
| Flow Traces, gradient/curl fields, path resampling and materials | Replaceable field/path/material inputs and image-conditioned direction, not another fixed streamline |
| Cell Fields, partitions, simple-polygon clipping/triangulation | Shared region identity, holes, nested fillers, variable-area and boundary-aware construction |
| Sensing/flocking, contact history, elastic curves, attractor growth | Coupled chemical feedback, aggregation and surface growth where computation really differs |
| Gray–Scott reaction studies and periodic dye transport | Multiscale competition, cyclic states and pigment-specific transport; not renamed noise or blur |
| Flame Clouds, Escape Contours | Better density/material consumers and nonlinear maps; flames themselves are not absent |
| Woven Strands, Registered Screens, Interference Lace | Reusable crossing/phase structure, custom paths/patterns and real linked inputs |
| Weighted Image Atlas, Word Echo, dithering, quantization/remapping | Arbitrary owned image/font inputs, segmentation, image-derived construction; local synthetic fields are not asset support |
| Mesh profiles, extrusion, subdivision, contour relief; native implicit-ray core | Surface consumers, editable field composition and web integration; not claiming that all 3D or ray marching is missing |

Root inspected all six baseline default sheets and representative external originals.
The visual gap is not simply insufficient complexity: many references depend on coordinated
regions, unequal scales, accumulation, material response and deliberately unoccupied space.

## 2. Composition model: small mechanisms, many constructions

### Separate the decisions

| Producer result | Higher-order consumer | Useful local information |
|---|---|---|
| Sites | `atEach(sites, mark)` | Stable identity, local frame, scale/clearance, sampled attributes |
| Paths | `along(paths, mark)` or `strokeWith(paths, material)` | Arc length, tangent, curvature, width, endpoint/junction roles |
| Regions | `inside(regions, filler)` | Boundary, holes, local coordinates, area, parent/depth, neighbours |
| Fields | Sampling, remapping, tracing, growth or material functions | Value, domain, boundary mode, scalar/vector meaning |
| Graphs | Separate node, edge and junction techniques | Stable IDs, incidence, direction, rank/age, edge weights |
| Surfaces | Sampling, linework, weave, perforation or relief | Position, normal, tangent frame, UV or explicit parameterization |
| Recorded signals | Attribute/parameter mapping | Time domain, interpolation, missing-data policy, named channels |

Names in this section are **proposed**, not current exports. Start with points, paths,
regions and fields; graph and surface consumers extend the same explicit conventions.
Do not require every instrument to implement every port.

```ts
// Proposed programmer-facing shape, not code that runs against v0.2.2.
const sites = poissonSites({ region, spacing, seed });

const petals = atEach(sites, site =>
  inFrame(site.frame,
    rosette({ petals: 7, seed: site.seed })
  )
);

const stitchedCells = inside(cells, cell =>
  strokeWith(
    hatchPaths({ region: cell.region, angle: cell.attributes.angle }),
    stitches({ spacing: 0.03 })
  )
);
```

A rosette can itself contain a distribution and another mark callback. A filler can return
paths for a later material pass instead of immediately painting. Built-in dot, line, flat
fill and ordinary p5 drawing remain valid simple endpoints. Do not force simple drawing
through an elaborate scene model, or conflate arbitrary user callbacks with portable exports.

### Function and data contracts

Use **specific types and normal functions**, not one universal `Technique<any, any>`
interpreter. A placement producer returns a site collection. A mark accepts one site's
context. A path material consumes a path collection. A region filler accepts a region.
Their compatible compositions can be wrapped as a named instrument without copying code.

Freeze these semantics before the first public implementation slice:

- **Coordinates.** Library 2D instruments retain the current 640-unit reference canvas at
  the host boundary. Nested marks use an explicit local frame, with a declared fit policy:
  preserve aspect, fit bounds, or intentional stretch. A path frame uses arc length, not
  vertex index. Reflections specify winding changes. A site reports clearance when known;
  scale is not a guarantee that an arbitrary child is collision-free.
- **Identity and randomness.** Producer IDs are stable for the same structural input.
  Derive child seeds from parent seed, stable element ID and a named purpose. Do not consume
  one shared RNG in traversal order. Material and palette edits cannot perturb placement.
  Reordering or filtering retains IDs; topology-changing edits may intentionally replace
  affected IDs. Do not promise identity across a global re-solve without an explicit rule.
- **Attributes.** Use typed, named attributes such as density, age, rank and region label.
  State units and domains. Missing required data is an actionable input error, not a silent
  zero. A style function may read attributes without modifying the producer's data.
- **Ownership.** Published results are immutable to consumers; avoid defensive deep copies
  inside inner loops. Builders own mutable buffers, publish read-only views, and document
  lifetime. Cache immutable results at meaningful boundaries, not every dot as a graph node.
- **Empty results.** Empty sites, transparent masks and exhausted growth fronts are valid
  artistic states with useful diagnostics. Invalid topology, missing assets and nonfinite
  values are errors. Never replace an error with an attractive fallback picture.
- **Geometry and masks.** A polygon-with-holes is geometry; an alpha mask is a sampled image.
  Name conversions explicitly, with threshold, resolution and fill rule. Do not treat
  clipped pixels as a reusable polygon boundary. Zero-area boundaries are not filled regions.
- **Fields.** Keep scalar, direction/vector, distance and density fields distinct. Specify
  continuous versus sampled, sample positions, interpolation and wrap/clamp/void policy.
  A warped distance estimate is not automatically a safe sphere-tracing distance bound.
- **Painting.** A drawing callback cannot clear the host canvas, alter sibling transforms,
  fetch assets, or leave renderer state changed. Isolate style/transform state once per
  suitable batch; allow vectorized built-ins for large collections. Do not allocate a p5
  graphics buffer per site. Geometry and painting callbacks are distinct overloads/types,
  not implicit conversions between data and side effects.
- **Stateful systems.** The public compositional surface can be functional while a solver
  owns mutable working arrays. Preparation consumes initial state and explicit steps/time,
  then publishes a snapshot. Never share one evolving simulation instance between nested
  elements by accident. Free-running wall-clock state is not a reproducible construction.
- **Bounded work.** A composition carries aggregate estimates for instances, vertices,
  samples and state steps. Apply an explicit work budget before expansion; cancellation
  must reach inner solvers. Reject cycles in Studio bindings and unbounded recursive
  descriptors. Programmer callbacks remain ordinary code, not a sandbox or a promise that
  arbitrary recursion can be predicted. Explain this export/execution boundary in guides.

### Studio representation without a second implementation

The private host stores a small, versioned construction document: named technique ID,
validated scalar settings, typed input bindings and child technique descriptors. Inputs
may refer to a local owned asset, another prepared result, or an inline construction.
The library resolves built-in descriptors to the same functions used by code authors.
The host owns document IDs, selection, persistence and graph ordering; the library owns
technique semantics and port metadata. Do not put tenant URLs or database handles in a
technique. Unknown IDs/versions fail clearly. Cleanly migrate all current call sites;
legacy artwork does not require compatibility aliases or a second executor.

Start with **slot-based editing**, not a node editor:

- A placement study gets a “Place” slot, initially a dot. Select another compatible mark;
  reveal its controls as a nested group. Show which attributes it can use.
- A path study gets source and material slots. Changing stitches to ink preserves paths.
- A region study gets a filler slot, plus boundary and gutter controls. Select one region
  for an override; stable IDs keep the override attached where the generator supports it.
- A field/image input picker offers compatible prepared outputs and owned assets. A preview
  can show the field, sites, paths or final drawing without changing the construction.
- Distinguish linked use from independent copy. Explain dependencies before deleting a
  producer. A hidden producer can still supply geometry; visibility is not availability.
- Expose local versus canvas coordinates and whether a consumer uses the producer's layer
  transform. Default bindings use producer-local data and an explicit mapping transform;
  do not let layer reordering silently reinterpret coordinates.
- Geometry consumers do not depend on producer opacity or palette. A deliberate raster
  snapshot input does depend on the rendered appearance. Label that distinction.

No arbitrary code evaluation from saved JSON. Programmer closures are supported in trusted
code, but cannot be round-tripped through Studio. Export can emit ordinary source for known
named constructions and include required assets; unsupported custom closures must report
why they cannot be exported rather than silently flattening them into another technique.

## 3. Shared implementation foundations

These are enabling work, **not extra gallery additions**.

| Foundation | Concrete deliverable | Reuse and boundary |
|---|---|---|
| F1 Typed results and callbacks | Sites/paths/regions/fields, local contexts, stable IDs, pure-data and painting forms | Extract from existing adapters; avoid a new generic framework |
| F2 Named compositions | Same functions callable directly and resolvable from validated descriptors; port metadata | Extend `packages/instruments/src/types.ts`, root exports and metadata deliberately |
| F3 Asset inputs | Owned immutable raster, font outlines, recorded channels, then indexed mesh/point cloud | Host loads/decodes with size/security limits; library receives resolved data, never fetches URLs |
| F4 Robust planar domains | Polygon holes, Boolean operations, offsets with stated join/fill semantics, clipping | Existing simple-polygon routines remain useful but are not silently upgraded to arbitrary polygons |
| F5 Reusable material consumers | Batched mark drawing, path strokes, region fills, density accumulation and tonemapping | Extract existing path, dither, flame, screen and weave drawers before adding alternatives |
| F6 Preparation and dependency lifecycle | Content-keyed prepared results, cancellation, invalidation by input dependencies, resource disposal | Extend existing cooperative preparation; one host lifecycle, no per-child canvases |
| F7 Stateful snapshots | Explicit initial conditions, steps, checkpoints, fixed update order and seeded IDs | Reuse dynamics preparation; palette-only edits repaint snapshots |
| F8 Spatial inputs and drawing | Indexed meshes/points, surface sampling, camera and depth/material consumers | Reuse surface attributes and implicit-ray cores; no claim to reconstruct scans or train models |

**Raster contract:** declare width/height, color space, straight versus premultiplied alpha,
pixel-center mapping and interpolation. Perform composition in a stated representation;
convert at the boundary. Source alpha must remain meaningful. Export includes asset hashes,
not cache-only object URLs. Fonts need licensing, contour extraction and shaping scope;
do not advertise full-script typography if only unshaped Latin glyph placement exists.

**Performance strategy:** share a prepared child motif when it is identical at many sites;
transform instances instead of reconstructing it. When children differ by local context,
reuse topology/material buffers where possible and bound total expansion. Rendering quality
and structural simulation resolution are separate controls. A preview may reduce material
sampling without rerolling structure. Never silently truncate geometry at a hard limit;
report the exceeded budget and the controlling parameter. Benchmark actual sparse, dense
and deeply composed cases before publishing slider limits—this plan invents no measured
latency, particle count or universally safe mesh bound.

## 4. Study briefs and counting convention

Each numbered brief below is an artist-facing capability proposal, not an admitted API.
**C** means composition/extraction of existing computations; **E** means a substantial
extension of an existing study; **N** means at least one new computation is necessary.
Mixed labels are intentional. “New” is relative to the exact released boundaries above.
A visual reference supplies a desired relationship or material, not proof of its algorithm.
Methods specified below are our proposed implementation choices unless source evidence
explicitly establishes them. Existing studies remain available as substitution partners.

References and image-role limitations are synthesized in the [visual review](next-release-visual-review.md).
Every brief requires actual interface exploration, structurally distinct outcomes, a useful
partial result and a composition with another instrument. Its final “Check” adds the
mechanism-specific risk to that common requirement.

### A. Structural composition and motif systems

Visual anchors: Davis's multiscale ornament and connected accents; Hobbs's regional
organization and unequal mark scales; Molnar's controlled disorder; Kwok's nested cells.
These are the first proof that higher-order composition delivers more than extra presets.

#### 01 — Motif ecologies · C/E

**Make:** clusters with dominant forms, subordinate motifs and sparse satellites, rather
than uniformly scattered symbols. **Build:** existing placement/filtering → stable sites
with role/clearance attributes → replaceable motif callback → transparent drawing. Extract
the useful parts of `ornament-poster`, `geometric-panel` and Spaced Marks; do not duplicate
their distributions. **Controls:** density envelope, size hierarchy, role weights, exclusion
zones, alignment and each motif's local construction. **Compose:** place small recursive
tiles or rosettes over watercolor, with Path Materials connecting selected roles.
**Output:** reusable sites and motif instances, not only pixels. **Check:** swapping a
dot for a nested motif preserves site IDs and positions; large motifs either respect a
declared footprint constraint or visibly permit overlap. Davis-like hierarchy is the goal,
not a claim to recreate his source assets.

#### 02 — Branch-attached ornament · C

**Make:** blossoms, joints, pennants or small compositions attached to meaningful branch
roles. **Build:** existing branch/grammar/attractor results → graph roles → node and edge
callbacks. Endpoints, forks and trunks get different local frames, rather than a second
independent scatter. **Controls:** eligible branch depth, terminal versus junction motifs,
attachment offset, angle inheritance, size falloff and branch visibility. **Compose:**
Attractor Growth supplies structure; stitched edges and sparse leaf-like region fills
provide material; reuse the same graph for a separate outline layer. **Output:** graph,
attachment sites and instances. **Check:** changing endpoint material does not regenerate
the tree; a fork's frame is well-defined even when incident edges nearly cancel. Sparse
botanical fragments and abstract circuit ornaments must both be achievable.

#### 03 — Region quilts · C/E, F4

**Make:** a coherent canvas whose regions contain different techniques while sharing
boundaries and deliberate gutters. **Build:** existing partition/cell output → explicit
region objects → `inside(region, filler)` → optional shared boundary material. Rectangular
partitions work first; non-convex regions and holes require F4. **Controls:** region layout,
size balance, empty-region selection, filler assignment, inset, orientation and shared
versus local seeds. **Compose:** some regions hold flow traces, some watercolor, some
stitched contours; one remains bare. Hobbs's region relationships matter more than matching
his palette. **Output:** reusable region hierarchy plus independent fill results.
**Check:** adjacent fillers cannot disagree about a common edge; changing one filler
preserves the partition and other regions. Do not rasterize every region to hide topology errors.

#### 04 — Contour bead scores · C/E

**Make:** aligned rows of beads, small glyphs or nested motifs that reveal a flowing shape,
as in Hobbs's Aligned Movement, without fixing the endpoint to dots. **Build:** Contour
Fields or supplied paths → arc-length sampling with phase per path → mark callback.
**Controls:** along-path spacing, cross-path phase relationship, size/value mapping,
selected contour bands, omitted runs and tangent/normal orientation. **Compose:** the
same contours can receive a faint ink pass beneath large, widely spaced motifs; add a
regional fill without generating a second unrelated field. **Output:** paths and stable
sampling sites. **Check:** resampling density changes do not alter intended spacing;
closed contours have an explicit seam rule. Distinguish this path-relative distribution
from globally scattered Spaced Marks.

#### 05 — Graph-role drawings · C/E

**Make:** sparse query-like diagrams, dense connective fabrics and emphasized routes,
informed by Hoff and Fry. **Build:** existing proximity/lattice/branch graphs or supplied
graph → role selection → separate node, edge, face and traversal treatments. This is not
a general graph database or a new DSL. **Controls:** degree/weight/age filters, highlighted
routes, edge material, node motif, face fill and endpoint visibility. **Compose:** Contact
Network supplies evolving edges; Path Materials draws selected routes; Region Quilts fills
only valid planar faces. **Output:** selected graph views and paths. **Check:** nonplanar
crossings do not magically become faces, and directed edges retain direction. A thin
supporting network and a bold focal route must be separately editable.

#### 06 — Recursive cell worlds · C/E

**Make:** nested compartments whose children have their own construction, not a fixed
recursive tile image. **Build:** existing partitions/rewrites → bounded region tree →
replaceable subdivision and terminal filler functions. Kwok's scale transitions motivate
the hierarchy; no particular growth algorithm is inferred from his stills. **Controls:**
split rule, depth, minimum region size, selective stopping, child occupancy and terminal
technique. **Compose:** one branch becomes a miniature Region Quilt, another keeps only
boundaries, another becomes type or a dot field. **Output:** parent/child regions with stable
ancestry. **Check:** limits apply to total expanded work, not depth alone; stopping a branch
does not recolor or reseed unrelated siblings. Child scale and clipping remain explicit.

#### 07 — Ordered disorder · C/E

**Make:** restrained arrays whose omissions, displacement and local exceptions carry the
composition—Molnar-like relationships rather than random jitter everywhere. **Build:**
regular lattice/partition → selectable correlated perturbation and omission fields →
arbitrary element callback. **Controls:** independent displacement/rotation/scale disorder,
correlation length, affected region, missing runs, alignment anchors and exception frequency.
**Compose:** a clean array supports a few dark displaced cells; use the same cells for
type, hatching or a screen pattern. **Output:** original and perturbed sites with exception
attributes. **Check:** zero disorder is genuinely ordered; appearance changes preserve
which elements are exceptional. Do not count each replacement shape as a new instrument.
This extends Rule Rows/Geometric Panel with spatially structured deviation.

### B. Mark and material construction

Visual anchors: [Sighack's watercolor](https://sighack.com/post/generative-watercolor-in-processing),
[Hoff's sand spline](https://inconvergent.net/generative/sand-spline/), LIA's layered line
masses, and Hodgin's embroidery/quilling. These consumers must accept multiple producers.

#### 08 — Polygon watercolor · N/C

**Make:** translucent washes with correlated ragged boundaries and uneven layered coverage.
**Build:** supplied region → seeded, correlated boundary subdivision/displacement →
related translucent passes, preserving a common parent shape. This is a geometric wash
model, not physical fluid simulation. **Controls:** boundary character, pass count,
edge variance, shared-versus-independent irregularity, pigment opacity and reserved holes.
**Compose:** fill Region Quilt compartments, wash behind type, or materialize broad
Flow Trace ribbons. **Output:** pass geometry plus optional raster material. **Check:**
passes must not self-intersect unpredictably or fill protected holes; changing pigment
does not regenerate boundaries. Compare a light partial wash with a dense overpainted
patch, not only one attractive full-page default.

#### 09 — Wet pigment blooms · N

**Make:** blooms, backruns, pooling and drying fronts inside an artist-defined wet region.
**Build:** bounded water/pigment fields with explicit transport, deposition and evaporation
rules → pigment accumulation → material renderer. Existing dye advection/diffusion is an
ingredient, not a complete watercolor model. **Controls:** wet mask, deposit sites,
water/pigment ratio, drying rate, paper absorption field, transport strength and elapsed
steps. **Compose:** feed source-image value regions or type masks; layer a dry bristle pass
over the result. **Output:** water, suspended pigment and deposited pigment fields.
**Check:** pigment accounting follows the declared model; dry areas do not inexplicably
transport paint. Color edits repaint a snapshot, while water edits deliberately recompute.
Avoid promising physically accurate paint or merely blurring the source.

#### 10 — Dry bristle strokes · N/C

**Make:** broad strokes with separate hairs, gaps, taper and depleted ink. **Build:** any
path → a coherent bristle cross-section carried along its local frame → contact/deposition
marks. Reuse path resampling and offset geometry; add correlated bristle/contact state.
**Controls:** brush width, bristle distribution, pressure profile, tilt, ink depletion,
paper/contact field and tip shape. **Compose:** materialize Harmonic Traces, gesture paths
or image-directed paths; contrast a few heavy strokes with fine existing stitched contours.
**Output:** stroke footprint/coverage, optionally individual hair paths. **Check:** corners
do not flip the brush frame; stroke sampling changes do not change apparent ink load
arbitrarily. Bristle count is a material choice with a measured work bound.

#### 11 — Moving-spline sand deposition · N/C

**Make:** granular curtains, seams and airy accumulated volumes like the relationships
visible in Hoff's sand work. **Build:** a supplied evolving spline/control sequence →
samples over curve and explicit time → density accumulation → exposure/material consumer.
Reuse spline, recorded-control and density machinery; deposition history is the distinct
construction. **Controls:** control-point motion, deposition density, time window, grain
spread, exposure and protected space. **Compose:** deposit along a gesture or contour
family; overlay a sparse crisp version of the generating curve. **Output:** density field
and optional trajectory samples. **Check:** total deposition is resolution-aware, seeded
sampling is reproducible, and changing exposure cannot change motion. A still reference
does not establish the artist's exact time evolution.

#### 12 — Stroke relief / impasto · N/C

**Make:** local ridges and directional highlights that follow strokes, rather than a flat
blur or generic emboss. **Build:** paths with width/pressure → height deposition and pigment
field → normals/material shading. Reuse surface attributes and signed convolution where
appropriate; define overlap as additive, maximum or displacement explicitly. **Controls:**
stroke cross-section, height, deposition order, edge ridge, material color and light.
**Compose:** turn Dry Bristle Strokes or image-directed painterly marks into relief;
retain a flat-color version as an independently usable layer. **Output:** height, pigment
and shaded transparent patch. **Check:** light changes preserve geometry; crossing strokes
have predictable height ownership. This is a 2.5D material, not a full paint rheology solver
or proof of physical fabrication.

#### 13 — Region stitch fills · N/C

**Make:** embroidery-like regions with directional fill, seams and intentional thread
crossings. **Build:** region and orientation field → bounded stitch paths with a stated
fill/routing rule → replaceable thread material. This differs from putting short dashes
on an existing path and from a regular woven grid. **Controls:** stitch length, spacing,
orientation/coherence, underlay, region inset, seam position and thread width. **Compose:**
stitch image value regions, glyph interiors or Region Quilts; use Path Materials for
the boundary. **Output:** ordered stitch paths and region labels. **Check:** holes remain
open, stitch lengths obey the declared bound, and disconnected regions do not get visible
travel stitches unless requested. Visual embroidery is not a machine embroidery export claim.

#### 14 — Quilled path sculptures · N/C

**Make:** nested paper-like strips with rolled ends, thickness and occlusion, motivated
by Hodgin's Individuation. **Build:** paths and optional spiral terminals → strip/ribbon
geometry with controlled wall height → depth-aware render. Reuse transported ribbons and
offset/resampled paths; packing and strip junction policy need explicit treatment.
**Controls:** strip spacing, wall height, curl radius, terminal selection, local nesting,
camera and material. **Compose:** use a contour family or text outline as scaffold; place
small quilled motifs through Motif Ecologies. **Output:** strip geometry and projected
footprint. **Check:** tight bends do not create unexplained inverted walls; self-overlap
is either supported with correct depth or rejected diagnostically. The flat path view
remains useful without the spatial renderer.

### C. Growth, accumulation and interacting fields

Visual anchors: [Lomas's chemotaxis](https://andylomas.com/digitalChemotaxis.html),
Nervous System's growth series, McCabe's multiscale fields and
[Sighack's random-walk fills](https://sighack.com/post/flood-fill-art-using-random-walks).
Each system publishes state for more than one drawing treatment.

#### 15 — Aggregation colonies · N

**Make:** branching accretions whose empty channels and active tips emerge from deposition.
**Build:** seeded particles in a bounded domain → walk/field-driven motion → attachment
to a growing cluster. Start with a specified 2D DLA-like model; do not claim Lomas's 3D
Aggregation process is reproduced. **Controls:** seed geometry, source boundary, sticking
probability, particle radius, directional bias and growth steps. **Compose:** attach any
mark at deposited sites; draw the parent graph with ink or grains; constrain growth inside
type or a region. **Output:** cluster sites, parent links and attachment age.
**Check:** deterministic attachment/tie ordering, bounded search and explicit termination
when no growth is possible. Spatial indexing is required; avoid an all-pairs scan per step.

#### 16 — Laplacian growth fronts · N

**Make:** lobed, tip-amplifying fronts and banded dendrites, distinct from random particle
aggregation. **Build:** boundary conditions and seed region → potential solve → flux-based
boundary advancement → retained front history. **Controls:** source/sink boundaries,
growth bias, regularization, step scale and which historical fronts are drawn. **Compose:**
stroke fronts with Path Materials, fill the final region with watercolor or place motifs
by front age. Nervous System's Laplacian images motivate the banded hierarchy.
**Output:** scalar potential, front paths and final occupied region. **Check:** consistent
boundary conditions and topology changes, stable progress under the declared step bound,
and visible distinction from simply offsetting a contour. Solver residual and work limits
must be exposed diagnostically, not hidden behind a pretty fallback.

#### 17 — Coupled chemotactic trails · N/E

**Make:** trails and colonies that reorganize because agents both sense and change their
environment. **Build:** existing sensor/motor stepping extended with explicit chemical
deposition, diffusion/decay and sampling → synchronized agent/field update. **Controls:**
sensor geometry, emission, decay, diffusion, attraction/repulsion, initial population
and barrier regions. **Compose:** render agents as custom motifs, chemical fields as
contours, and recorded trajectories as bristles. **Output:** agent snapshots, chemical
fields and optional path history. **Check:** update order is frozen; agents must respond
to deposited signal, not a fixed noise field. Changing display material leaves trajectories
unchanged. Multiple species is a defined extension only when interaction channels are
specified, not a cosmetic palette selector.

#### 18 — Multiscale pattern competition · N/E

**Make:** large lobes containing smaller patterns, local symmetries and competing feature
scales, rather than one Gray–Scott spot size. **Build:** explicit scale-separated
activation/inhibition or a separately specified multiscale model → field evolution →
replaceable threshold/contour/material consumer. Do not label a model “BZ” unless its
reaction rules actually implement that model. **Controls:** scale set, scale weights,
initial conditions, symmetry constraints, boundary mode and time. **Compose:** publish
density for Motif Ecologies, orientation/regions for stitching, or relief height.
**Output:** competing fields and selected scale labels. **Check:** scale coupling changes
structure independently of color; normalization and boundary rules are reproducible.
McCabe's imagery motivates scale interaction, not a claim that his exact equations are known.

#### 19 — Cyclic color fronts · N

**Make:** expanding cyclic domains, spirals and interleaving state fronts. **Build:** a
specified multistate cyclic cellular rule → synchronous state grid → cells, interfaces
or density consumers. Existing elementary/life-like rows and Gray–Scott steps are not
equivalent. **Controls:** state count, neighbourhood, invasion threshold, initialization,
obstacles and steps. **Compose:** replace each state cell's mark, materialize only front
boundaries, or use state regions to select different fillers. Draves's Bomb and McCabe's
named multiscale/BZ collections provide context, not proof of this chosen rule.
**Output:** categorical grid and interface paths. **Check:** palette changes cannot alter
state transitions; cyclic ordering and simultaneous updates are explicit. A tiny domain
or absorbing obstacle can legitimately stop the system.

#### 20 — Nutrient-driven cell division · N

**Make:** structured colonies with differentiated cell sizes and growth history.
**Build:** nutrient sampling, cell growth/division, local mechanical relaxation and
neighbour updates under a frozen model. Start with an honest 2D cellular-colony scope;
the separate surface brief addresses 3D growth. **Controls:** nutrient sources, division
threshold, division orientation, exclusion/mechanics, boundary constraint and age selection.
**Compose:** cells become regions for arbitrary fillers; division lineage becomes a graph;
age drives material without changing geometry. Lomas's Cellular Forms motivates the
relationship between supply and structure, not biological accuracy. **Output:** cells,
adjacency and lineage. **Check:** division preserves declared quantities, cells do not
silently disappear under collision, and structural edits recompute only valid checkpoints.

#### 21 — Random-walk color fronts · N/C

**Make:** branching patches of color that occupy selected parts of a canvas, as in
Sighack's flood-fill comparisons. **Build:** seed sites and domain → specified visit/front
rule with correlated color propagation → occupancy and color fields. Unlike Wet Blooms,
this is stochastic region visitation, not water/pigment transport. **Controls:** starting
seeds, neighbourhood/persistence, revisit rule, coverage stop, color transition and barriers.
**Compose:** use occupancy as a mask for dots, type or hatching; expose front-age contours
as a separate layer. **Output:** visited region, age and color attributes. **Check:** an
unreachable pocket stays unfilled; saturation terminates cleanly; changing the mark callback
does not change the walk. Both broad fields and narrow isolated islands must be useful.

### D. Symmetry, mathematical pattern and optical construction

Visual anchors: Kurashima's optical plates, GenerateMe's folds, McCabe's symmetry and
onformative's explicitly described Chladni material investigations. New mathematical
methods here are original proposed transfers, not unsupported attributions to artists.

#### 22 — Wallpaper motif operators · N/C

**Make:** repeating ornaments with meaningful reflection/glide/rotation choices, accepting
any motif. **Build:** a stated plane symmetry group and fundamental domain → instance
transforms → motif callback, with optional domain clipping. **Controls:** group, lattice
vectors, motif offset, relative size, symmetry breaking and visible extent. **Compose:**
repeat a quilled fragment, geometric cutout or text outline; a second registered screen
can emphasize larger optical structure. **Output:** transforms and grouped instances.
**Check:** boundary duplicates are eliminated consistently and seams agree across the
fundamental domain. Existing Edge Tiles solve local compatibility; this supplies global
symmetry transformations, not another fixed tile set. Ship explicit supported groups and
their semantics, not an unexplained “symmetry amount.”

#### 23 — Substitution tiling fields · N

**Make:** nonperiodic, multiscale tilings with editable tile interiors and edge treatments.
**Build:** a frozen substitution rule, seed patch and depth → oriented tiles with ancestry
→ region/edge callbacks. Penrose-style tiles are one supported construction, not a generic
name for arbitrary triangles. **Controls:** seed patch, expansion depth, crop, tile-type
selection, hierarchical color and interior technique. **Compose:** watercolor interiors,
stitched shared edges and sparse vertex motifs; omit a tile class for negative space.
**Output:** tiles, ancestry and deduplicated shared edges. **Check:** substitution orientation,
edge matching and area scaling; cracks or duplicate edges at parent boundaries are bugs.
This differs from existing grammar paths and local adjacency collapse.

#### 24 — Hyperbolic motif gardens · N

**Make:** repeated motifs that compress toward a circular boundary while preserving a
coherent non-Euclidean arrangement. **Build:** a specified disk-model tiling with bounded
expansion → local transforms/curved regions → replaceable motifs or fills.
**Controls:** supported polygon/vertex configuration, depth, disk crop, motif fit and
boundary exclusion. **Compose:** use a simple line motif first, then tiny branching
structures or alternating region materials. **Output:** disk-model cells and adjacency.
**Check:** invalid tilings fail validation; near-boundary numerical growth is bounded;
pixel-small cells stop by a declared criterion rather than producing infinite work.
This is a distinct mathematical addition suggested by symmetry/scale needs, not a claim
that a particular reviewed artist used this algorithm.

#### 25 — Nodal plate drawings · N/C

**Make:** particle-like concentrations and voids around the nodes of combined standing
wave modes. **Build:** explicit mode functions/weights → scalar amplitude field → node
proximity density, contours or guided sampling. **Controls:** mode indices, weights,
phase where meaningful, plate aspect/domain, node width and mark callback. **Compose:**
sites receive small motifs; node bands become stitch regions or surface perforation
density. onformative explicitly cites Chladni algorithms, but this first instrument is
a mathematical plate study, not a validated vibration/fabrication simulation.
**Output:** amplitude and node-distance/proximity fields. **Check:** known simple modes
produce expected nodal symmetries; incompatible boundary assumptions are not mixed.
Changing material preserves modes and sampling identities.

#### 26 — Inversion gardens · N/C

**Make:** nested circles, arcs and distorted motif families through explicit circle
inversions, not another orbital curve preset. **Build:** source paths/motifs and inversion
circles → composed geometric transforms with singularity handling → path/mark material.
**Controls:** circle centers/radii, operation order, iteration bound, clipping and source
geometry. **Compose:** transform a wallpaper motif or type outline, then apply ink or
beads; preserve the original source as a faint reference layer. **Output:** transformed
geometry and valid-domain mask. **Check:** points near a pole receive a declared exclusion
or finite clipping policy, never unbounded coordinates. Transform order must visibly and
predictably matter. Do not mislabel every recursive circular image as inversion evidence.

#### 27 — Nonlinear fold atlas · N/E

**Make:** folded grids, density seams, rosettes and stretched image fragments, informed by
GenerateMe's nonlinear-map studies. **Build:** a small documented set of coordinate-map
functions → explicit composition/iteration → geometry transform or sample accumulation.
**Controls:** map choice, coefficients, fixed points, operation order, iteration count,
domain and singularity policy. **Compose:** warp motif sites or a source image; render
the same mapping as lines, density or a cell field. **Output:** mapping, transformed
samples and/or density. **Check:** distinguish forward mapping with collisions from inverse
raster sampling; no hole-filling by unexplained interpolation. A folded grammar path is
not this coordinate-map computation. Exposure edits must preserve the mapped samples.

#### 28 — Linked optical plates · E/C

**Make:** optical interference whose large-scale form comes from the relationship between
two editable pattern sources. **Build:** extend Registered Screens/Interference Lace with
replaceable pattern functions and explicit shared phase/registration controls.
**Controls:** source pattern, local frequency, phase, plate offset/rotation, bounded support,
ink and optional recorded phase sequence. **Compose:** a pattern follows a type or region
mask while the other remains regular; compare a single plate, linked pair and detached
layers. Kurashima's prints motivate the physical relationship, not simulated paper handling.
**Output:** separately usable plates and their composite. **Check:** sampling/antialiasing
does not invent the intended moiré; inspect export resolution as well as preview.
This is an existing-family expansion, not a new moiré algorithm claim.

### E. Source-aware image transformations

Visual anchors: GenerateMe's image transformations and FM, Sighack's value sketches,
Quayola's pointillist landscapes and Bardou's fragmented imagery. Input photographs are
not generated outputs; asset support is a shared prerequisite, not seven separate loaders.

#### 29 — Masked pixel sorting · N

**Make:** ordered streaks that selectively dissolve an image while retaining chosen
features. **Build:** raster and selection mask → scan paths → selected runs → stable
sorting by a declared color/value key. **Controls:** run threshold, direction/path,
sort key, ascending/descending order, minimum run and protected regions. **Compose:**
use a generated field or type mask to select runs; retain an unsorted image layer below
and draw selected run boundaries with Path Materials. **Output:** transformed raster and
optional run paths. **Check:** unselected pixels and alpha stay unchanged; equal keys
have deterministic order; sorting is not mistaken for displacement. Start with straight
scanlines, then admit curved paths only with explicit pixel visitation/overlap semantics.

#### 30 — Adaptive image compartments · N/C

**Make:** an image whose detail determines the scale of its mosaic, with replaceable
content in each cell. **Build:** raster → regional error/variance metric → bounded
quadtree or specified subdivision → cell attributes → filler callback.
**Controls:** error metric, threshold, minimum cell, aspect/split policy, source crop and
cell technique. **Compose:** large quiet cells become watercolor; detailed cells become
glyphs, hatching or nested subdivisions. Kwok's hierarchy and image-conditioned geometric
work motivate this transfer. **Output:** region tree and sampled color/value.
**Check:** flat images stop subdivision; increasing detail threshold has predictable
effects; cell callbacks cannot cause the source partition to reroll. This is distinct
from fixed-grid Reduced Mosaic and random binary partitioning.

#### 31 — Connected value regions · N/C

**Make:** a small number of coherent shapes from an image rather than disconnected
same-color pixels. **Build:** existing quantization or a specified clustering method →
connected-component segmentation → controlled small-region merging → vector boundaries
with holes. **Controls:** value/color grouping, connectivity, minimum area, merge policy,
boundary simplification and protected edges. **Compose:** feed regions to stitch fills,
watercolor, hatching or cut-paper treatments; retain fine outlines separately.
**Output:** labels, adjacency and region geometry. **Check:** disconnected components are
not accidentally joined, holes survive tracing, and simplification preserves topology.
Palette extraction alone is not segmentation. Compare portrait, landscape and abstract
procedural inputs rather than fitting the implementation to one reference photograph.

#### 32 — Painterly source interpretation · C/E

**Make:** a recognizable image assembled from multiscale marks whose shape and material
can be replaced. **Build:** raster analysis → coarse-to-fine coverage/error-guided sites
and directions → arbitrary mark/path material callbacks. Reuse weighted sampling,
gradients, color quantization and the new material consumers; add only the missing
coverage-selection computation. **Controls:** scale schedule, detail threshold, direction
coherence, mark family, source-color mapping, overlap and empty-space protection.
**Compose:** broad watercolor masses beneath sparse bristle or point marks; use only a
selected subject region. **Output:** mark plan with source attributes plus rendering.
**Check:** switching material preserves the plan; the source remains distinguishable at
chosen abstraction levels. Quayola/Bardou references do not establish their actual pipeline.

#### 33 — Frequency-modulated engraving · N/C

**Make:** wavy line bands that encode an image's tone without becoming ordinary stippling.
**Build:** raster/field samples along scan paths → explicit amplitude/frequency modulation
with phase continuity → paths → replaceable line material. **Controls:** carrier spacing,
frequency range, modulation depth, scan direction, tonal mapping and protected highlights.
**Compose:** apply to one Connected Value Region, overlay sparse type, or use a generated
field instead of a photo. GenerateMe's FM images motivate the output relationship; the
chosen modulation equation must be documented independently. **Output:** paths and sampled
signal. **Check:** phase is continuous across samples, frequency stays within a declared
sampling limit, and white/transparent regions behave intentionally. Do not conceal aliasing
as a “glitch” effect.

#### 34 — Temporal and spatial slit compositions · N/C

**Make:** time stretched into bands, or one image recomposed through slices with editable
source correspondence. **Build:** a bounded owned image sequence, or a single raster,
plus a slice-to-source mapping → sampled strips → composition. **Controls:** slice direction,
width, source-time curve, spatial offset, repetition, ordering and mask. **Compose:** use
Recorded Gesture Scores to drive the time map; clip strips to Region Quilts; retain a few
unsliced fragments. **Output:** raster plus slice metadata. **Check:** frame timestamps,
interpolation and end behaviour are explicit; missing frames fail clearly. Start with
imported sequences, not live-camera capture or video codec infrastructure. A single-image
slicer and a temporal slit-scan share the mapping machinery but are labelled honestly.

#### 35 — Image-directed field drawing · C/E

**Make:** paths and marks that follow or resist the structure of an image, including
hair-like silhouettes and directional abstractions. **Build:** raster → gradient or
structure-tensor orientation with confidence → optional field blending → existing
trajectory integration/spacing → arbitrary path material. **Controls:** follow/across-edge
direction, coherence scale, confidence threshold, trace length, spacing and source mask.
**Compose:** weave fine paths over broad Painterly Source Interpretation; replace ink
with beads or bristles. **Output:** field, confidence and paths. **Check:** flat areas have
a stated fallback direction or no marks; unsigned orientation does not flip trajectories
randomly. This extends actual source binding and field derivation, not the already released
generic vector tracer.

### F. Typography, gesture and data-shaped construction

Visual anchors: Rodenbroeker's typographic rhythm, Fry's relationship drawings, Levin's
drawn symbols and interaction records, Davis's signal-responsive motifs. Recorded input
supports reproducibility; live interaction is an optional host acquisition concern.

#### 36 — Outline type as a region · C/E, F3/F4

**Make:** letterforms filled, displaced or grown through by other techniques, while keeping
their counters and baseline relationships. **Build:** owned licensed font + shaped text →
glyph contours/regions → explicit deformation or filler. Extend beyond Word Echo's bundled
glyph source. **Controls:** text, font, layout, tracking, line spacing, deformation field
and interior/boundary techniques. **Compose:** watercolor letters, chemotactic interiors
and stitched outlines; expose the contours as inputs to another study.
**Output:** glyph runs, paths and regions with glyph identity. **Check:** holes, ligatures,
combining marks and shaping coverage match the declared supported text scope; missing
glyphs are visible errors or explicit substitutions. Font loading does not occur during draw.

#### 37 — Glyph packing · N/C

**Make:** words or symbols that occupy a shape with controlled density, orientation and
hierarchy, rather than clipping a regular text block. **Build:** shaped glyph/word outlines
and domain → footprint-aware placement → local transforms → glyph or replacement callback.
**Controls:** vocabulary, frequency/size relation, orientation policy, gap, containment,
packing order and protected regions. **Compose:** pack symbols into a cell or silhouette,
using sparse ink outlines above a wash. **Output:** stable placements and actual footprints.
**Check:** counters are not automatically available packing space unless explicitly allowed;
impossible requests return a partial placement with a reported unplaced set. Use F4/non-convex
packing rather than bounding-box overlap masquerading as shape-aware packing.

#### 38 — Path typography · N/C

**Make:** readable or deliberately disrupted text along contours, branches and gestures.
**Build:** shaped glyph run with advances → arc-length layout on a supplied path →
local glyph frames. **Controls:** start offset, tracking, baseline side, orientation,
overflow/repetition policy and path choice. **Compose:** label abstract roads, wrap type
around optical plates, or combine one text-bearing contour with bead-bearing neighbours.
**Output:** positioned glyphs and baseline paths. **Check:** kerning/shaping precedes layout;
closed-path seams and short-path overflow are explicit; sharp turns do not silently flip
letters. This is not another Word Echo scatter. A text-free motif sequence should be able
to reuse the same arc-length layout where its advance widths are supplied.

#### 39 — Modular typographic rhythm · C/E

**Make:** repeated text fragments, stretched bands and local typographic disruptions,
informed by Rodenbroeker's poster work and LIA's graphic block compositions.
**Build:** shaped text or motif source → regional tiling/slicing → correlated local
transforms → clipped instances. **Controls:** row/column organization, slice boundaries,
phrase repetition, phase, displacement field, local exceptions and blank modules.
**Compose:** some modules contain text, others screens or flat color; keep a legible
anchor phrase outside the fragmented regions. **Output:** module layout and source mappings.
**Check:** changing the phrase preserves module construction when possible; clipping and
transform order are documented. This should be a revealing composition of shared operators,
not a dedicated effect renderer for one hardcoded word.

#### 40 — Recorded gesture scores · C/E

**Make:** draw with a captured stroke's timing and pressure, then reinterpret it through
different techniques. **Build:** host records/imports ordered samples → existing recorded
control sampling plus path reconstruction → mark/material callback. **Controls:** spatial
versus temporal sampling, time window, smoothing, pressure mapping, repetition and material.
**Compose:** a gesture guides bristles, sand deposition, glyph placement or a chemical
emitter. Levin's interaction work motivates the input/result relationship, not recreation
of his performance systems. **Output:** immutable gesture channels and derived paths.
**Check:** replay is independent of device event frequency; timestamps and pressure
absence are explicit; pointer capture is host-owned. Keep the raw recording so smoothing
can be changed without destroying the artist's input.

#### 41 — Bundled relationship drawings · N/C

**Make:** readable families of arcs or routes between real relationships, not an arbitrary
decorative web. **Build:** explicit graph/endpoints → a chosen hierarchical or force-based
edge-bundling method → paths → Path Materials. Fry's Distellamap-like correspondence
motivates the endpoint semantics; its exact algorithm is not inferred.
**Controls:** endpoint arrangement, grouping, bundle strength, separation, edge selection
and direction. **Compose:** nodes receive glyphs or miniature charts; bundle paths get
fine ink, highlighted routes get a heavier material. **Output:** routed paths retaining
source edge IDs. **Check:** edges remain attached to correct endpoints, parallel/opposite
edges preserve identity, and bundle strength zero provides the declared unbundled layout.
Do not destroy graph semantics for visual smoothness.

#### 42 — Data-shaped scores · C/E

**Make:** a composition in which recorded values determine structural choices—spacing,
branching, size, timing or region area—not only color. **Build:** owned tabular/channel
data → explicit normalization and named mappings → any compatible producer/consumer.
**Controls:** selected channel, domain, clamp/extrapolation, aggregation, missing-value
policy, mapping target and temporal window. **Compose:** data sets motif roles, controls
nodal-mode weights, or chooses where a growth field is fed; render a small explanatory
key separately. **Output:** resolved typed attributes and their source mapping.
**Check:** categorical and continuous values are not conflated; reload uses the same
recorded data, not a live URL. This is a composition study plus reusable mappings, not a
dashboard framework or an unsupported claim of live audio responsiveness.

### G. Spatial organization, routes and constrained structure

Visual anchors: Watabou's neighbourhoods, Hodgin/onformative rivers, Hoff's branching
linework and Deskriptiv's interlaced structures. The reusable outputs matter more than
one themed map, river poster or decorative knot.

#### 43 — Roads and parcels · N/C

**Make:** a connected street-like framework with coherent enclosed blocks and local
subdivision. **Build:** domain and anchors → constrained planar route graph → intersection
splitting → face extraction → parcel subdivision. Existing obstacle paths and lattice
trees supply ingredients, not a general road/parcel topology. **Controls:** route hierarchy,
alignment field, junction policy, target block scale, parcel frontage and reserved space.
**Compose:** parcels become Region Quilts; road edges receive variable materials; motifs
occupy selected parcels without becoming a hardcoded city generator.
**Output:** graph, faces and parcels. **Check:** crossings and junctions agree topologically,
parcels do not extend across roads, and dead-end regions have a defined disposition.
Watabou-like functional organization is the reference, not semantic city simulation.

#### 44 — Migrating river ribbons · N

**Make:** channels whose previous positions leave scars and whose bends can cut off.
**Build:** initial centerline → specified curvature/flow-related bank migration →
resampling and cutoff handling → retained channel history. **Controls:** bank mobility,
channel width, confinement, migration steps, cutoff threshold and age-dependent deposition.
**Compose:** render current channel as a ribbon, old channels as pale paths, and surrounding
terrain through contour or relief consumers. **Output:** current centerline/banks, oxbows
and age fields. **Check:** cutoffs change topology explicitly, not by hiding intersecting
segments; resampling does not alter width or elapsed time. Hodgin's River Scars/Meander
and onformative's Meandering River motivate the historical landscape relationship; this
is a specified artistic model, not hydrological prediction.

#### 45 — Drainage and erosion fields · N

**Make:** branching drainage and landforms whose local structure responds to water
movement. **Build:** height grid → flow routing/accumulation → stated erosion/deposition
update → revised field. Keep this distinct from centerline migration.
**Controls:** initial terrain, rainfall/source field, erodibility, sediment/deposition,
boundary outlets and steps. **Compose:** publish drainage paths to ink/bristles, height
to Contour Relief, and accumulation to motif density. **Output:** height, flow, sediment
and drainage graph. **Check:** mass changes follow the model, sinks/flat areas have a
declared policy, and grid resolution is not hidden as a cosmetic setting. Do not call
ordinary octave noise “erosion”; the transport/update relationship is the new computation.

#### 46 — Geological cutaways · N/C

**Make:** layered strata, folds, faults and exposed slices, not merely a colored height map.
**Build:** stratified scalar/material coordinates → explicit deformation/fault transforms →
selected section or height/surface consumer. **Controls:** layer thickness sequence,
fold shape, fault offset, section plane, erosion mask and material assignment.
**Compose:** display fine contour bands over a broad color section; use a region boundary
as the cutaway aperture; compare with river/drainage layers. **Output:** stratum labels,
section regions and optional surface attributes. **Check:** discontinuities at faults
are intentional and traceable; section changes do not reseed the underlying strata.
This is an original structural transfer from layered spatial references, not a claim of
geological simulation or exact Quilez/Quayola construction.

#### 47 — Non-convex shape packing · N

**Make:** interlocking irregular forms, letters or user-supplied silhouettes with meaningful
gaps and size hierarchy. **Build:** polygon-with-holes footprints → broad-phase search →
robust overlap/containment test → specified greedy or relaxation placement.
**Controls:** shape source, scale distribution, permitted rotations, gap, domain, ordering
and stop condition. **Compose:** pack any compatible region motif; fill placed shapes with
different techniques; expose leftover negative space as a region where robustly derivable.
**Output:** transforms, footprints and unplaced items. **Check:** bounding boxes are not
the final collision test; concavities/holes have explicit semantics; failure to pack all
items is an honest result. Existing circle/convex filtering and rectangle packing remain
the cheaper choices when their assumptions hold.

#### 48 — Crossing-aware lace and knots · N/E

**Make:** arbitrary interlacing paths with editable over/under relationships, not only a
regular woven grid. **Build:** supplied paths → crossing detection and path parameters →
crossing-order assignment → local gaps/lifts → material consumer. **Controls:** crossing
rule, explicit crossing overrides, clearance, strand width, tension-like smoothing and
terminal treatment. **Compose:** interlace text baselines, harmonic paths or graph routes;
use different materials for strand families. **Output:** paths plus a crossing graph.
**Check:** tangencies and near-crossings are distinguished, contradictory over/under
constraints are reported, and width changes invalidate necessary crossing clearances.
Reuse Woven Strands' proven material ideas, not a second independent thread renderer.
This is visual knot construction, not a knot-topology theorem engine.

#### 49 — Collision drawing scores · N/C

**Make:** marks produced by constrained motion, bounces and contacts, with the collision
events available as composition inputs. **Build:** bounded particle/disc bodies, gravity/
forces and obstacles → deterministic fixed-step collision solver → trajectories/events.
**Controls:** emitters, body size/mass, gravity, restitution, friction, barriers and recording
window. **Compose:** paths become bristles, contact events receive motifs, accumulated
impacts drive pigment or a field. **Output:** snapshots, paths and contact records.
**Check:** tunnelling/overlap policy is explicit, simultaneous contacts have deterministic
ordering, and energy behaviour matches the chosen solver. Existing pair forces do not
constitute collision physics. Keep scope to specified simple bodies; avoid an unbounded
general rigid-body engine as a prerequisite.

### H. Surface, volume-like and spatial constructions

Visual anchors: Nervous System's Floraform/Kinematics, Lomas's cellular structures,
Deskriptiv's mapped fibers, Quayola's selective abstraction, Bardou's cloud imagery and
Quilez's distance-field articles. Physical objects and scans are references, not promised
fabrication or reconstruction services.

#### 50 — Differential surface growth · N

**Make:** ruffled sheets and growth-constrained skins with editable regions of expansion.
**Build:** mesh surface → spatial growth/rest-length field → relaxation and adaptive
remeshing under a specified model → surface consumers. **Controls:** seed surface,
growth distribution, constraints, stiffness-like terms, refinement and elapsed steps.
**Compose:** map a field from Pattern Competition onto growth rate; draw only the boundary,
apply Surface Weave, or render a pale sheet behind fine lines.
**Output:** mesh, growth attributes and lineage where stable. **Check:** remeshing preserves
orientation and field transfer, degenerate faces fail diagnostically, and self-contact
support is explicitly scoped. Floraform-like ruffles require actual surface evolution,
not a noisy sphere. No biological or fabrication accuracy is claimed.

#### 51 — Hinged panel fields · N/C

**Make:** articulated tilings that fold into spatial fragments while retaining panel
identity. **Build:** region/mesh panels and adjacency → hinge axes/angles with constraints →
posed mesh. A kinematic fold model comes before any optional dynamic cloth simulation.
**Controls:** panel source, hinge selection, angle field, anchored panels, gaps and thickness.
**Compose:** fill panels with independent 2D techniques before mapping them; use outlined
edges or motifs at joints. **Output:** panel graph, transforms and posed geometry.
**Check:** shared hinge edges stay coincident, incompatible closure constraints are
reported, and material changes do not change the pose. Nervous System's articulated
garments motivate modularity; this does not promise printable joints, compression planning
or real cloth mechanics.

#### 52 — Surface-conforming weave · N/E

**Make:** strands that follow a curved surface, with density and orientation changing
across it. **Build:** parameterized surface or an explicitly solved tangent field →
strand paths → crossing-aware weave → spatial thread/material consumer.
**Controls:** strand directions, density field, boundary termination, cross-section,
over/under rule and surface selection. **Compose:** reuse a differential sheet or a
simple released revolved profile; use data or reaction fields to alter local density.
**Output:** surface paths, crossing metadata and geometry. **Check:** UV seams and poles
have declared treatment; density is interpreted in surface distance, not blindly in UV.
Deskriptiv's DoubleMesh/Flyknit motivate this relationship. General arbitrary-mesh
parameterization is not silently assumed to be solved.

#### 53 — Visibility-aware mesh drawing · N/C

**Make:** spatial forms as selected silhouettes, creases, contours and hidden-line
drawings rather than filled polygons. **Build:** supplied/procedural mesh plus camera →
candidate feature edges/sections → visibility classification → Path Materials.
**Controls:** silhouette/crease/section selection, angle threshold, hidden-line policy,
section spacing, camera and material. **Compose:** fine visible lines above translucent
region fills; place motifs at selected mesh features. **Output:** projected paths with
depth/visibility labels. **Check:** hidden-line removal actually respects occlusion;
near-plane clipping and shared edges do not produce cracks or duplicates. Reuse existing
surface attributes and mesh constructors. A wireframe with faded back edges is not
equivalent to a visibility solution.

#### 54 — Point-cloud reinterpretation · N/C

**Make:** recognizable or abstract spatial subjects built from replaceable grains,
short strokes and local fragments. **Build:** owned point cloud, procedural mesh samples
or explicitly labelled image-plus-depth input → stable spatial samples/attributes →
depth-aware instance renderer. **Controls:** sampling, local scale, orientation, dispersion,
attribute color, crop and camera. **Compose:** combine a dense cloud with sparse network
edges or a visible-line pass; keep background/atmosphere independent.
**Output:** samples and projected drawing. **Check:** occlusion and transparency sorting
are correct for the declared material; point count and bounds are validated. Bardou and
Quayola motivate the appearance, but this does not reconstruct scans, train Gaussian
splats or recover missing 3D geometry from a single photograph.

#### 55 — Local mesh abstraction · N/C

**Make:** forms that transition between detailed source structure and coarse facets,
with editable cuts or exposed sections. **Build:** owned mesh → mask/importance field →
constrained simplification and/or explicit sectioning → material/line consumers.
**Controls:** preserved region, local error target, facet scale, section planes, boundary
preservation and material. **Compose:** combine coarse opaque facets with fine visible
lines in the preserved region, inspired by Quayola's Laocoön transformations.
**Output:** simplified/sectioned mesh and correspondence attributes. **Check:** manifold/
boundary requirements are stated, protected features remain within error bounds, and
cuts are capped only when a valid cap is actually constructed. A random triangle
overlay on a photograph does not satisfy this brief.

#### 56 — Composable implicit sculpture · E/N

**Make:** solids, cavities, repeated structures and bounded fractal forms through editable
field composition. **Build:** typed distance/implicit functions → explicit transforms,
CSG and supported deformation → existing implicit-ray computation plus material consumers.
**Controls:** primitive parameters, operation order, blending, repetition bounds, camera,
material and sampling quality. **Compose:** sample surface points for Point-cloud
Reinterpretation or render an isolated solid beneath visibility/contour accents where
those conversions are implemented. Quilez's technical articles support the representation;
reuse the accepted raymarch core rather than re-creating it.
**Output:** field construction and rendered fragment, with honest supported conversions.
**Check:** distinguish true distances from estimates/general scalar fields; step safety,
misses, gradients and fractal iteration bounds are explicit. No arbitrary field is
silently treated as a safe distance estimator.

## 5. Implementation sequence and slice ownership

Waves are dependency order, not separate scope reductions. Start delivering usable
compositions early while maintaining the whole program as the release objective. No
reliable completion date is inferred from the number of briefs.

| Wave | Deliverable and brief IDs | Dependencies | Exit evidence |
|---|---|---|---|
| W0 — composition contract | F1/F2/F5/F6; dot replacement, path-material replacement, region filler; direct function and named descriptor use | Exact baseline and frozen local-context/identity semantics | Same construction through both APIs; actual Studio slot substitution; unchanged structure under material edits |
| W1 — structural discovery | 01–07, 22, 23, 27, 28, 39, 40, 42 | W0; basic F3 for text/recordings; F4 where region topology needs it | Nested studies, correlated structure and source sharing; no per-study loader/compositor copies |
| W2 — materials and sources | 08, 10–14, 29–38, 41, 47, 48 | W0/F3/F4/F5; controlled asset decode, shape/region contracts | Source-to-result replacement, region holes, material substitution and mixed compositions |
| W3 — stateful construction | 09, 15–21, 43–45, 49 | F7 plus prior domains/materials; topology/solver contracts | Checkpoint replay, cancellation, structure-preserving recolor, meaningful initial-condition changes |
| W4 — mathematical/spatial range | 24–26, 46, 50–56 | F8; robust geometry and field semantics; reuse accepted spatial cores | Actual spatial surface review, camera/material separation, scoped conversions and bounded work |
| W5 — release integration | All selected briefs and foundations | Prior wave evidence; final consolidation | Installed-package compositions in private Studio; documentation/source/metadata/export agreement |

Independent slices within a wave can proceed concurrently after their shared contracts
are frozen. Do not let workers independently invent coordinate, RNG, mask or ownership
semantics. Root owns F1/F2, public boundaries, selection and final integration.

### First vertical slice: decisive before broad implementation

The first three [reference examples and implementation conventions](composition-reference-slice.md)
and the [structural operators slice](composition-structural-operators.md) were implemented
and root-reviewed. Structural operators adds Recursive Cell Worlds, Ordered Disorder,
Wallpaper Motifs, the arrow mark, and contour-score phaseSpread/levelRamp controls.
Use their code, guides and bound evidence for subsequent slices. This completes the
structural field operator batch, not the full W1 program; publication and the primary host
upgrade remain separate.

The first three [reference examples and implementation conventions](composition-reference-slice.md)
were implemented and root-reviewed on 28 September 2026. Use their code, guides and bound
evidence for subsequent slices. This completes the selected vertical example set, not the
whole foundation program or the later waves; publication and the primary host upgrade remain separate.

Use **existing Poisson placement + dot/rosette callbacks**, **existing contour paths +
ink/stitch materials**, and **existing rectangular partitions + two region fillers**.
Do not start with new physics or imported scans.

1. Read the actual producer/drawer split in the adapters; identify the minimum reusable
   output. Preserve existing numerical semantics unless a separate change is justified.
2. Define site/path/region contexts and named descriptor equivalents. Record input/output,
   ownership, failure and seed rules. Review public symbol references before changing exports.
3. Extract, not copy, the computation. Existing instruments call the extracted function.
   Implement ordinary callback substitution and one nested composition.
4. Make the current default a composition of the same pieces. Remove obsolete monolithic
   branches once all callers have migrated; no legacy renderer path.
5. Integrate compatible source/consumer slots in the isolated private Studio. Demonstrate
   that a child technique can itself be composite and expose its own controls.
6. Recolor, reseed structure, change a child parameter, reorder layers, hide a producer,
   cancel a large preparation and export/reload the supported named composition.
7. Inspect actual sparse and dense results and a layered canvas. Only then freeze the
   conventions used by subsequent slices. A wiring test or a callback that merely echoes
   its input is not proof of this capability.

### Existing file ownership and change surfaces

Paths below are existing locations, not instructions to add a second parallel framework.
New internal files should be introduced only when a coherent reusable mechanism warrants one.

| Owner/slice | Existing code to reuse or change | Required integration |
|---|---|---|
| Root composition boundary | `packages/instruments/src/types.ts`, `src/index.ts`, `src/adapters/types.ts`, `src/adapters/creative-instruments.ts` | Public exports, validated descriptor/port types, preparation, root dispatch |
| Placement/regions | `placement-packing-instruments.ts`, `region-instruments.ts`, `region-facet-instruments.ts`, `relaxed-cell-instruments.ts` under `src/adapters/` | Shared sites/regions consumed by existing and new studies |
| Paths/fields/materials | `path-material-instruments.ts`, `vector-trace-instruments.ts`, `contour-field-instruments.ts`, `symbol-chord-instruments.ts`, `weave-screen-instruments.ts` | Replaceable source/material functions; no duplicate drawers |
| Image/density | `image-signal-instruments.ts`, `raster-source-instruments.ts`, `raster-transform-instruments.ts`, `fractal-field-instruments.ts` | Resolved assets, sampling contracts, reusable accumulation/material stages |
| Dynamics | `external-dynamics.ts`, `proximity-replay-instruments.ts`, `fluid-instrument.ts`, `growth-instruments.ts`, `attractor-growth.ts` | Explicit state/preparation/checkpoints and result publishing |
| Spatial | `constructed-geometry-instruments.ts`, `revolved-instruments.ts`, `contour-relief.ts`, material adapters | Mesh/field data, camera/material consumers and lifecycle |
| Library teaching/package | `packages/instruments/metadata.json`, `manifest.json`, `guides/`, `tools/generate_sources.mjs`, tests and README | Definitions, source extraction, guides and packed artifact agreement |
| Private host document/render | `/home/colin/dev/procedurals-web/apps/web/lib/studio-types.ts`, `studio-document.ts`, `render-studio.ts`, `harness-render.ts` | Bindings, dependency order, owned assets, invalidation and replay |
| Private host UI | `apps/web/components/LayerControls.tsx`, `LayerPicker.tsx`, `Studio.tsx`, canvas components | Compatible slots, nested controls, intermediate previews, dependency errors and cancellation |
| Private host consumption | `apps/web/scripts/generate-gallery.mjs`, `toolkit-roots.mjs`, package pinning | Consume versioned library metadata/implementations; no copied instrument logic |

New public mathematical computations belong with the toolkit's existing operation
implementations, contracts and fixtures, not hidden as unreviewed giant instrument adapters.
Read the applicable skills only for the lifecycle being changed. A compound study using
existing operations needs a creative brief, not a manufactured new operation contract.

### Contract clusters, not one API per study

Freeze coherent reusable computations in bounded clusters. This list deliberately does
not promise a particular exported function count:

- Planar domains: holes/Booleans, offsets, boundary extraction and robust overlap.
- Sampling/layout: attribute-bearing sites, arc-length layout, symmetry transforms,
  substitutions and shape-aware packing.
- Image structure: segmentation, adaptive error subdivision, orientation fields,
  scan-run sorting and phase-preserving modulation.
- Materials: boundary-correlated washes, bristle deposition, height deposition and
  stitch routing; several visual studies share each computation.
- Growth: aggregation, potential-driven fronts, chemical feedback, multiscale rules
  and division models. Different governing rules remain distinct kernels.
- Spatial organization: planar graph faces/parcels, river migration, drainage transport
  and bounded collision stepping.
- Surfaces: growth/remeshing, hinges, surface sampling/weave, visibility and constrained
  simplification; reuse current mesh/implicit operations rather than replacing them.

Every cluster specifies artist task, computation removed, simpler alternative, reusable
output, meaningful edit, transfer case and evidence limits. Performance bounds derive from
measurement; proposed controls are not source-proven slider ranges.

## 6. Layered compositions that exercise the architecture

These are acceptance scenarios, not extra counted additions or claims to recreate artworks.
Each must be built through the real interface, with intermediate results inspectable.

| Composition | Construction and layer order | Decisive edit / negative-space test |
|---|---|---|
| Hierarchical ornament field | Quiet ground → 08 wash fragments → 01 large/secondary motifs → 02 fine connectors | Replace large motifs with nested 06 compositions without rerolling sites; leave an intentional open quadrant |
| Regional flow print | 03 shared regions → broad Flow Traces in selected regions → 04 beads on the same field → sparse outlines | Change one region's material; neighbouring boundaries and paths remain coordinated |
| Sparse ordered disorder | 07 array → one region of 39 type fragments → isolated accent marks | Turn off disorder exactly; alter only a selected zone rather than shaking the whole canvas |
| Material portrait | Owned image → 31 regions → 08 masses → 35 paths with 10 bristles → a few 33 engraving bands | Replace the input image; retain the authored pipeline and abstraction controls, not the old subject |
| Chemical garden | 17 field/trails → field contours → small custom motifs at selected agents → pale 13 stitched boundary | Recolor without rerunning; change an emitter and observe a genuinely changed colony |
| Banded growth fragment | 16 history fronts → thin ink on early fronts → 11 sand on selected late fronts | Show only an off-centre fragment with a large void; do not rely on opacity to manufacture openness |
| Optical typography | 36 type regions → 28 first pattern plate inside type → independently editable second plate | Adjust phase/registration while type geometry stays fixed; inspect both plates alone and at export size |
| Abstract neighbourhood | 43 graph/parcels → 03 varied fillers → 38 path labels → sparse 01 symbols | Change street structure; parcel/filler bindings update coherently, with a reserved unbuilt region |
| River memory | 45 terrain base → 44 old channels/scars → current river ribbon → existing contour lines | Advance migration then recolor history; old and current channels remain distinct rather than decorative duplicates |
| Perforated/woven sheet | 50 surface → 52 strands or a material field → 53 selected visible lines | Change growth field separately from thread density/camera; an edge-only drawing remains useful |
| Spatial fragments | Owned/procedural mesh → 55 selective abstraction → 54 sparse samples → 53 fine lines | Preserve one chosen detailed region, move the camera and verify actual depth, not a pasted 2D effect |
| Gesture-to-many | 40 one recording → 10 broad bristles + 11 delayed sand + 38 sparse glyphs | Edit the time window once and observe coordinated consumers; change one material without changing the recording |

At least one reviewed construction must nest beyond a single substitution, and another
must reuse one producer in multiple consumers. Also review a composition with an existing
unmodified instrument, not exclusively new-to-new combinations.

## 7. Verification and release guide

### Behaviour and creative evidence

- **New/changed computations:** independent expected values and invariants for boundaries,
  topology, seeds, ownership, failure modes and numerical semantics. Avoid tests that
  merely verify a callback was called or that an output is nonempty.
- **Functional substitution:** use visibly different consumers on the same producer.
  Verify producer data/IDs remain stable under style changes; verify structural changes
  invalidate dependent results and not unrelated ones.
- **Descriptors:** direct functions and built-in serialized compositions agree for their
  supported scope. Unknown techniques, incompatible bindings, missing assets and cycles
  produce precise errors. Arbitrary closures are not silently serializable.
- **Preparation:** run cancellation and replacement while dense work is active. No stale
  result paints after a newer edit; no nested consumer leaks a renderer/resource.
- **Actual interface:** root explores structural controls, diverse seeds where meaningful,
  sparse/dense cases, nested choices and intermediate views. Freeze useful slider intervals
  separately from semantic and measured hard bounds.
- **Layered work:** exercise the scenarios above, inspect both plausible layer orders,
  shared-source coordinate behaviour, alpha and negative space. Rendering/replay alone
  is not creative admission.
- **Export/reload:** from installed tarballs, replay supported named compositions with
  bundled/referenced owned assets and exact package versions. Record the export scope;
  custom code or unsupported media is not falsely advertised as portable.
- **Spatial work:** actual WEBGL surface, camera, clipping, depth, normals and alpha
  observations are necessary. A core fixture pass does not establish visual support.

Use existing focused tests and rendering/package harnesses. Relevant package commands
already exist: `npm run build`, `npm test` and `npm run sources` in
`packages/instruments`. Choose changed-path tests and the existing installed-artifact
checks; do not invent a new certification framework. Run native rendering through
`python3 tools/with_native_render_lock.py -- <existing native command>`, including from
other checkouts. Browser review uses the actual isolated private Studio, not screenshots
of a substitute implementation.

Register meaningful implementation images in `docs/visual-review.json`, with stage and
evidence links, then run `python3 tools/build_visual_review.py`. Images remain ignored.
Research images and contact sheets are source-review material, not new render acceptance.

### Packaging and documentation

1. Reconcile all exported symbols and affected callers; remove obsolete duplicate
   construction/drawing paths. Existing saved artwork need not migrate.
2. Regenerate metadata/source artifacts with their existing tools. Each guide explains
   visible results, compatible inputs, replaceable components and canvas effects of
   controls; keep admission bookkeeping out of teaching copy.
3. Document direct-function use, named composition use, callback ownership, explicit
   limits and unsupported export cases. Provide editable examples from the same source.
4. Build/test relevant packages and install the packed artifacts into an isolated consumer.
   Verify representative compositions there, not only in the source checkout.
5. Publish mutually compatible JavaScript/instruments/catalog artifacts with hashes.
   Update the private host's exact release pins/integrities and generated surfaces.
6. Record scoped root acceptance, final canonical/family/workflow counts and consolidated
   studies. Do not add “56” to 117 mechanically: new recipes, expanded families and merged
   entries affect those denominators differently.
7. Replace the current progress snapshot with the next actionable state. Preserve the
   v0.2.2 evidence and historical release bindings; do not rewrite them to match HEAD.

## 8. Deliberate limits and risk decisions

- **Not an artist-cloning system.** Visual analogues and reusable relationships are the
  objective. Missing author code, assets or parameters prevent exact recreation claims,
  not original study construction.
- **No learned-image model or scan reconstruction in this release plan.** Bardou, Reas's
  film work and some GenerateMe examples include external/model-conditioned imagery.
  Accept owned source results as inputs; do not imitate that entire pipeline with dots
  and call it equivalent. Training, photogrammetry and Gaussian-splat fitting are separate
  capability decisions.
- **No fabrication guarantee.** Embroidery, quilling, Kinematics and material experiments
  inform structure. Printability, toolpaths, physical stress and machine instructions
  need separate engineering contracts and validation.
- **No universal graph editor first.** Typed slots and explicit shared producers deliver
  the functional model. A visual node canvas may later be useful, but is not required to
  make these compositions or a reason to defer them.
- **No palette-only “additions.”** Where a brief collapses to an existing mechanism,
  ship it as a useful composition/upgrade and report that honestly. The ambition remains
  substantial artistic expansion, not a fixed number of public functions.
- **No blanket port gate.** p5 instrument work can proceed; new portable computations
  keep explicit contracts. Java/py5/Android support advances only with their own evidence.
- **No hidden scope reduction.** Difficult solvers and spatial slices remain in this
  proposed program. If a capability cannot meet its specified behaviour, root presents
  a concrete tradeoff for the maintainer rather than replacing it with a named mock,
  noise approximation or permanently unfinished scaffold.
