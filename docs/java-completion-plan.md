# Feature-complete Java buildout

Current maintainer objective: build a feature-complete Java implementation. Ports are
paused per `porting-resume.md`; recipes/MCP/web remain a separate roadmap, not prerequisites
for making the native Java library useful. This plan does not claim feature completeness
or replace the project's mission with the current operation count.

Execution now follows [the remaining-scope map and parallel batches](java-buildout-batches.md).

Current remaining-work review: [CP29 reconciliation](../design/capabilities/java-completion-cp29-review.md).
CP26 delivered image-driven controls and normalized separable postprocessing. Spatial masks
and explicit image placement are delivered. Remaining family dispositions and discovery
consistency still require review; source-specific shader behaviors are not implied.

## Completion requirements

1. A competent Processing user can install the source-built Java library and reach a
   working, editable sketch from a short getting-started guide. Installation and example
   execution must be verified from extracted distributions, not only the development tree.
2. Each major corpus idiom has a clear Java entry point and reusable operations for its
   defining algorithms. Distinguish actual algorithms from combined technique tags and
   ordinary artistic drawing. Record genuine exclusions and remaining gaps with evidence;
   unknown families cannot silently count as supported.
3. Every admitted operation has reviewed semantics, traceable source evidence, parameter
   provenance, meaningful focused checks and a representative native workflow. New features
   need a demonstrated edit and a transfer use; starters do not count as original recreations.
4. Existing operations compose without sketch-specific algorithm escapes. Track which
   assessed originals become practical, without projecting a small cohort over the corpus.
5. Java documentation, reference, examples, seeded-render/sweep tooling, licensing and
   packaging agree with the delivered behavior. Performance is bounded at representative
   sizes and errors do not leave partial results. Unsupported targets remain explicit.

These requirements are an acceptance checklist, not a fixed operation-count target.
The broader corpus benchmark remains a separate strict certification claim.

## Existing capability baseline

Java0.34 source milestone assembles30 operations and36 workflows: field marks, integrated paths, constrained
circle placement, quadrant regions, triangle grain, endpoint and interior-cut branching,
radial-profile meshes, glyph placement, Delaunay facets, target springs and occupied lattice
paths, raster remapping, positioned color ramps, noise-band paths, smooth closed curves and binary panel layouts,
plus retained caller-selected rectangle cuts, pointer-target and tapered-body workflows,
and relief/city/landscape compositions. LayerMarks adds image/callback region content, masked
source-over and two-input crossfade. ClipMarks adds retained simple-polygon segment clipping.
Four selected original structural
recreations are demonstrated; Curvespace is a separate repository example, outside the
accepted Java0.25 archive. Consult current operation attestations rather than historical
status paragraphs in the provisional API design.

## Completed batch: raster warping (CP13)

Artist task: render a pattern once, bend its pixels with a spatial displacement field, then
change the field strength or pattern without reimplementing image sampling. This added a
raster transform capability previously absent from the package.

Delivered at `19365d83`, with core/native/extracted-package acceptance in
`evidence/distribution/cp13-java-review.json`. The following records the preimplementation
plan; all four delivery steps below are complete.

Decisive initial evidence: `survey/out/2016/Generativos/colorRamp/notes.md` describes copying
an image and bilinearly sampling displaced coordinates, with noise supplying displacement
angles. The source also contains an independently positioned color ramp. The report records
moderate changes for displacement detail/amplitude; that does not establish recommended
ranges or isolate the sampler from the full composition. Its prose disagrees about dot
color versus position, so the implementation walkthrough/source must resolve that detail.

Root's proposed boundary is image resampling from explicit coordinates/displacements,
separate from the chosen noise field, palette, pattern and renderer. The next source audit
must resolve clamping, interpolation, alpha/color conventions, coordinate meaning, ownership
and work bounds BEFORE signatures are frozen. Avoid a callback that hides a new field
algorithm or a noise-specific monolith that prevents transfer.

Delivery order:

1. Root reads decisive source/notes and writes the keep/extraction decision and exact
   contract. Terra retrieves at most two computational neighbors; no corpus-wide audit.
2. Terra implements the frozen Java core and focused distinguishing tests. Root reviews
   numerical, image-boundary and ownership decisions directly.
3. Deliver WarpMarks using existing layout/palette/field operations plus the admitted
   raster transform. Demonstrate displacement edits and a second supplied field. Root
   inspects native results; no porting or new renderer framework is required.
4. Integrate a reviewed source-built Java distribution and update reference/technique docs.

This is the first batch, not the entire definition of Java completeness. After it, assess
remaining real gaps in color control, field/path constraints, region construction and
renderer-bound raster/text/mesh workflows against the checklist above. CP15 now implements the CP12 band-constrained
walking capability with explicitly independent noise/RNG semantics; general grammar engines and Voronoi cells
are not inferred from mislabeled line-pool/Delaunay examples.

## Decisions from the initial bounded screens

- Voronoi: colidion describes circle-outline deformation; globologia/metro describe
  Delaunay triangles. These do not justify bounded nearest-site polygons. No claim that
  the full corpus lacks them; no general Voronoi implementation admitted from these reports.
- Ribbons: linescurvis/datido/nando define strip edges directly. They do not establish a
  general supplied-path offset algorithm with joins/caps. Keep their composition patterns
  available without inventing a generic offset API from the tag.

Root owns admission and final acceptance. Luna/Terra perform bounded evidence and frozen
implementation work. Sol remains paused. Reuse existing infrastructure and run focused
checks once per meaningful change; repair failures without widening acceptance criteria.

## Completed batch: positioned color stops (CP14)

Root admitted color.stop-ramp after reviewing colorRamp, boxDepth, celular and triangleRamp.
The contract and analytic fixtures are frozen; Java core review passes, and native
workflow review passes. Extracted distribution acceptance is recorded separately. See
`design/capabilities/cp14-stop-ramp-admission.md`. Artist task: move a color transition or
change its width independently of geometry, using unequal noncyclic stops. CyclicPalette
remains the equally spaced repeating alternative.

Java0.17 shipped this capability at346d6f53, with source-bundle acceptance in
`evidence/distribution/cp14-java-review.json`. Stop-position and palette values remain
caller artwork; no unsupported recommended ranges are introduced.

## CP15: noise-band paths

NoiseBandPath2D retains accepted proposals near each start's noise level. BandMarks supplies
tolerance edits and retained perpendicular-mark transfer; exact source reproduction is not
claimed. Contract/fixture/core review and native scope are recorded separately from source
bundle acceptance. The private prototype and failed worker checks are not shipped evidence.
After CP15 integration, audit the Java completion requirements above against current
capabilities and artist tooling before selecting another operation. Unknown family coverage
and missing helper workflows must not silently count as complete.

## CP16: smooth closed curves

ClosedSpline2D and LoopMarks supply retained uniform curves, approximate per-chord distance
lookup and analytic raw tangents. Control edits and tile-to-fan transfer preserve the
computation/drawing boundary. Java0.19 distribution acceptance is recorded in
`evidence/distribution/cp16-java-review.json`. No additional original recreation is claimed. General seeded-render
and parameter-sweep tooling and broader evidence-based idiom coverage remain incomplete.

## Artist render tooling after CP16

The opt-in JAVA2D selected-frame helper tools/render_java.py supplies explicit seed/numeric
parameters, one-axis sweeps and contact sheets; docs/rendering-java.md describes the hook.
This closes a concrete static comparison workflow, not all renderer/animation tooling.
Frame selection now executes every preceding draw, including accumulating/noLoop sketches.
P2D/P3D, assets and multi-frame animation export remain open, alongside broader major-idiom coverage.

CP17 adds BinaryCellPartition2D and PanelMarks: irregular two-way integer-cell cuts,
attempted-versus-successful split accounting, and independent decoration of retained cells.
This extends equal-quadrant layouts; it does not cover unequal four-way splitting, cell
deletion or general polygon subdivision. No new original recreation is claimed.

CP18 adds GradientNoise3D01 and DepthMarks: explicit-depth planar edits and volumetric
face-color samples on retained radial geometry. Core, actual P3D lifecycle and extracted
consumer checks are separate evidence. No Processing-noise replay, octave stack, generic
animation executor or new original recreation is claimed.

CP19 adds RadialPull2D/PullMarks: ordered localized radial folding, radius/power edits and
retained contour transfer. Center discontinuities and self-intersections are explicit;
sequential pushes and stochastic attraction are distinct remaining computations. No new
original recreation is claimed.

Curvespace now demonstrates a fourth complete structural recreation using RegularGrid and
RadialPull2D, with actual P2D additive drawing and reviewed edits/reset/cached save. See
[curvespace-recreation.md](curvespace-recreation.md). This adds composition evidence rather
than another operation; general render/animation helper scope remains incomplete.

## CP20: noncircular placement

ConvexPolygonPlacements2D and PolygonMarks now provide greedy rejection of overlapping
supplied strict convex polygons. Thickness/shape edits reuse proposal poses; recolor retains
placements, and diamond transfer uses the same filter. Exact symmetric containment/contact
intentionally corrects the celular helpers rather than replaying their nesting bug.
Core, native workflow and Java0.23 source-bundle acceptance are recorded separately in
`evidence/distribution/cp20-java-review.json`.
No additional original recreation or non-Java target is claimed.

## CP26: image controls and composable filtering

ProcessingImageField samples retained image attributes for independent mark decisions.
SeparableBlur2D and ProcessingImageFilters soften retained content, with BlurMarks showing
axis edits and a masked sharp/filter transition. ImageFieldMarks demonstrates size, visibility
and color consumers with fixed positions. Both extracted workflows pass; see
`evidence/distribution/cp26-java-review.json`. No additional original recreation is claimed.

## CP27: sequential outward deformation

DiscProjection2D and ProjectionMarks add outward point movement through supplied ordered
discs, with contour/line transfer and explicit strength/order edits. This addresses the
projection component of colidion; owner-ray recovery, its fill heuristic and full original
recreation remain outside the claim. It is not Voronoi or guaranteed collision avoidance.
See `evidence/distribution/cp27-java-review.json`. The composition guide now explains
partition callbacks, image content, masks and effect ordering. Remaining family
dispositions, reference completeness and the final user journey still need reconciliation.

## CP28: annular forms

AnnularMesh3D and AnnularMarks close the explicit washer-topology gap: inner/outer walls,
annular end faces, retained flat normals and angular identity. Width, depth and facets
are independent of color and arrangement. All33 extracted examples compile; the11-state
native workflow and exact restored/save outputs passed root review. See
`evidence/distribution/cp28-java-review.json`, pushed at
`f43629a931980f8572577380f1a8069f50f9ec56`.

This is a scoped capability addition, not full aros recreation or general solid modeling.
The package still records775 Javadoc warnings; public-method discovery and final
requirement-by-requirement completion review remain open. Unsupported general Voronoi,
text shaping and grammar rewriting must not silently count as supported.
