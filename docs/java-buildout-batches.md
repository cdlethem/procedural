# Remaining Java buildout: architecture and execution

Root integration owner. This plan replaces serial CP-by-CP scheduling, not the completion
requirements in java-completion-plan.md. Source milestone: Java0.33, 30 accepted operations and
35 workflows (distribution reviewed); four demonstrated original structural recreations. Inventory is
not a completeness claim. Port integration and Sol review remain paused.

## Capability map

| Artist capability | Existing entry point | Remaining work or explicit boundary |
|---|---|---|
| Arrange marks and spatial attributes | FieldMarks, RegularGrid, 2D/3D noise | Existing composition; unify renderer/tooling entry points rather than add another noise wrapper. |
| Integrate and decorate paths | PathMarks, BandMarks, LoopMarks | BodyMarks demonstrates backward spines and tapered-body/centerline transfer using GradientPath2D; no history-buffer operation. |
| Place nonoverlapping forms | PlacementMarks, PolygonMarks | Circles and supplied strict convex polygons supported; concave packing is unassessed, not implied. |
| Partition surfaces | RegionMarks, PanelMarks | CP21 retained caller-selected unequal cuts and explicit removal plus CutMarks accepted in Java0.24. |
| Triangulate and add grain | FacetMarks, GrainMarks | Delaunay and triangle sampling supported. Actual Voronoi-cell need remains an evidence decision; tags alone are insufficient. |
| Grow branching structures | BranchMarks, CutBranchMarks | Endpoint and interior-cut branching supported. General grammar rewriting not established by brotes; no L-system engine inferred. |
| Animate responsive arrangements | SpringMarks | PointerMarks demonstrates supplied targets, replay and fixed connectivity with existing springs. |
| Build three-dimensional forms | ProfileMarks, AnnularMarks, DepthMarks, ReliefMarks, CityMarks | Radial profiles and closed annular meshes, plus existing mesh/field compositions; explicit P2D/P3D render tooling is accepted. Arbitrary extrusion/solid modeling not claimed. |
| Work with typography | GlyphMarks | Font-backed placement supported; outline extraction and shaping remain explicit unassessed capability questions. |
| Control color and captured pixels | RampMarks, WarpMarks, CyclicPalette | Existing extraction helper hardened and actual FieldMarks palette application validated. |
| Render, compare and export work | render_java, contact-sheet builder, visual gallery | Explicit assets, P2D/P3D and bounded frame sequences are accepted; installation guidance stays tied to extracted distribution review. |
| Learn and compose the package | Starting-point guides and four recreations | Audit discovery/reference consistency, package examples and representative cross-operation composition; no feature-count substitute. |

Grounding: artist-capabilities.md, choosing-java-workflow.md, rendering-java.md,
java-completion-plan.md, recreation-coverage.md and cp21 source review in design/capabilities/.
Unassessed rows require an explicit disposition before final completion, not indefinite
feature accumulation. New corpus evidence can reopen a decision; missing reports never
prove absence. Recipe/MCP/web and cross-language ports remain separate roadmap deliverables.

Completed latest batch: D1 image attributes and D2 normalized separable filtering, accepted
in CP26. Next bounded lane is C3: root audits discovery and family dispositions after CP27 delivered the independently specified sequential point projection from colidion.
The full source composition and general Voronoi cells remain distinct; next close remaining
family dispositions and install-to-edit/reference consistency before declaring completion.
CP28 closes the concrete annular-topology gap identified in C3 with AnnularMarks.
CP29 adds simple-polygon segment clipping; Java0.33 demonstrates retained field paths
composed with that clipper in PathClipMarks. Java0.32.1 improves grid/path reference and
installation/performance guidance.
The family boundary review is in design/capabilities/java-family-boundaries-cp27.md;
its annular implementation follow-up is now accepted, while broader unknowns remain.
Public-method documentation and final user-journey consistency are still unfinished.
Earlier rows below retain their historical decisions.

## Execution queue

Each row has its own files and can advance without waiting for another row's packaging.
Only rows marked executable may receive implementation assignments. Root freezes new public
operation semantics before production code; a plan row is not contract approval.

| ID | Deliverable and basic behavior | Status/dependency | Acceptance and owner |
|---|---|---|---|
| A1 | CP21 retained rectangle cuts: choose a live region, cut at supplied coordinate, preserve unrelated IDs; explicit deletion | Accepted in Java0.24; evidence/distribution/cp21-java-review.json | Root owns semantics; Terra prototype/edit. Analytic order/atomicity checks plus one native local edit and decoration transfer. |
| A2 | Starting-point and reference reconciliation: current capability links, truthful shipped vs repository examples, no stale missing-feature claims | Completed in first batch; current catalog and0.23 review | Luna edits authored docs only. Root checks claims against actual entry points; generated reference stays catalog-derived. |
| A3 | Asset-aware rendering: explicit source asset directory staged inside each render sandbox, preserve relative paths, bind file hashes, reject escapes | Accepted: evidence/tooling/java-render-assets-review.json | Terra after root behavior brief. Actual font/image consumer, missing/changed/escaping asset checks; retain shared lease and time budgets. |
| B1 | General native renderer selection: same seed/parameter helper for JAVA2D/P2D/P3D with actual renderer assertion | Accepted: evidence/tooling/java-opengl-render-review.json | Root defines supported runtime/profile boundaries; Terra implements. One2D and one3D representative output, no fallback, focused failure cases. |
| B2 | Bounded frame-sequence export: one simulation run, selected completed frames saved in order, explicit frame-based time | Accepted JAVA2D: evidence/tooling/java-frame-sequence-review.json | Root or Terra. Accumulating sketch proves consecutive state/RNG; selected snapshots match existing single-frame helper; interruption leaves honest partial output. |
| B3 | Interactive spring/triangulation composition using supplied targets | Native accepted: evidence/workflows/pointer-marks/root-review.json; public core and SpringMarks unchanged | Terra after root composition brief. Explicit input replay, retained topology decision, target changes and reset; distinguish source resemblance from reproduction. |
| C1 | Tapered field-body capability: compose backward field integration and supplied width profile | Native BodyMarks accepted: evidence/workflows/body-marks/root-review.json; no new core needed | Root decides missing reusable algorithm; implement only if existing path values cannot express it clearly. Mature-frame evidence required; early none scores do not establish ranges. |
| C2 | Palette extraction/application helper | Accepted: evidence/tooling/palette-application-review.json; existing helper and native FieldMarks application | Bounded deterministic image-to-palette proposal, explicit alpha/color/count semantics; known-color image and actual artist reuse. No new color core unless justified. |
| C3 | Close remaining family dispositions and user journey | After preceding batches, bounded evidence review of Voronoi, typography outlines, mesh gaps | Root. Explicit in/out/unknown reasons and install-to-edit walkthrough; unknown required coverage cannot count complete. |

## Integration batches

First batch: A1 private edit/admission, A2 documentation, and A3 frozen tooling brief then
implementation. These are separate lanes. A1 may stop at rejection without blocking tooling.
Second batch: accepted A1 production core/workflow if justified, renderer/frame tooling,
and interactive composition. Sequence files with shared ownership; no concurrent edits to
render_java or the catalog. Third batch: resolve C rows and remaining acceptance gaps.
This is a dependency plan, not an estimate or promise of a fixed number of new operations.

Use available capacity: root plus up to three workers, only for concrete independent work.
Luna retrieves evidence/edits docs; Terra implements frozen behavior; root implements
high-uncertainty pieces directly when explanation/review would cost more than doing them.
No standing requirement to occupy every slot. Worker completion means reviewed code and
actual named check output, not a prose assertion that tests exist.

Root integrates shared catalog/fixtures/evidence. Native rendering is serialized by the
one machine lock while code and docs proceed independently. Run focused checks per change,
then one aggregate catalog/packaging check at a useful integration checkpoint. Preserve
previous archive members and run changed representative native consumers from the extracted
bundle. Do not rebuild/release after each private prototype or documentation edit.

## Finish criteria

Apply all five requirements in java-completion-plan.md to current evidence: installation
and editing, major-idiom coverage/dispositions, operation semantics/native acceptance,
composability and original recreation coverage, and coherent tooling/docs/licensing.
Close every queue row with an accepted artifact or a root-reviewed evidence-backed scope
decision. Neither a green inventory nor reaching a target count establishes completion.
If required behavior remains unknown or unverified, keep the goal active and name it.
