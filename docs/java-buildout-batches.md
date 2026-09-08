# Remaining Java buildout: architecture and execution

Root integration owner. This plan replaces serial CP-by-CP scheduling, not the completion
requirements in java-completion-plan.md. Baseline: Java0.23, 23 accepted operations and
23 packaged workflows; four demonstrated original structural recreations. Inventory is
not a completeness claim. Port integration and Sol review remain paused.

## Capability map

| Artist capability | Existing entry point | Remaining work or explicit boundary |
|---|---|---|
| Arrange marks and spatial attributes | FieldMarks, RegularGrid, 2D/3D noise | Existing composition; unify renderer/tooling entry points rather than add another noise wrapper. |
| Integrate and decorate paths | PathMarks, BandMarks, LoopMarks | Assess supplied-field backward integration and tapered bodies from peces; do not confuse rebuilt spine with historical trails. |
| Place nonoverlapping forms | PlacementMarks, PolygonMarks | Circles and supplied strict convex polygons supported; concave packing is unassessed, not implied. |
| Partition surfaces | RegionMarks, PanelMarks | CP21 retained caller-selected unequal cuts and explicit removal are under investigation. |
| Triangulate and add grain | FacetMarks, GrainMarks | Delaunay and triangle sampling supported. Actual Voronoi-cell need remains an evidence decision; tags alone are insufficient. |
| Grow branching structures | BranchMarks, CutBranchMarks | Endpoint and interior-cut branching supported. General grammar rewriting not established by brotes; no L-system engine inferred. |
| Animate responsive arrangements | SpringMarks | Interactive supplied-target composition; prove input/state/replay boundary without automatically adding another spring API. |
| Build three-dimensional forms | ProfileMarks, DepthMarks, ReliefMarks, CityMarks | Existing mesh/field compositions; reusable P2D/P3D render tooling remains incomplete. Arbitrary extrusion/solid modeling not claimed. |
| Work with typography | GlyphMarks | Font-backed placement supported; outline extraction and shaping remain explicit unassessed capability questions. |
| Control color and captured pixels | RampMarks, WarpMarks, CyclicPalette | Existing interpolation/remap; palette extraction helper remains to assess against Phase4 requirement. |
| Render, compare and export work | render_java, contact-sheet builder, visual gallery | Asset-bearing sketches, P2D/P3D, bounded frame sequences and portable installation instructions need delivery review. |
| Learn and compose the package | Starting-point guides and four recreations | Audit discovery/reference consistency, package examples and representative cross-operation composition; no feature-count substitute. |

Grounding: artist-capabilities.md, choosing-java-workflow.md, rendering-java.md,
java-completion-plan.md, recreation-coverage.md and cp21 source review in design/capabilities/.
Unassessed rows require an explicit disposition before final completion, not indefinite
feature accumulation. New corpus evidence can reopen a decision; missing reports never
prove absence. Recipe/MCP/web and cross-language ports remain separate roadmap deliverables.

## Execution queue

Each row has its own files and can advance without waiting for another row's packaging.
Only rows marked executable may receive implementation assignments. Root freezes new public
operation semantics before production code; a plan row is not contract approval.

| ID | Deliverable and basic behavior | Status/dependency | Acceptance and owner |
|---|---|---|---|
| A1 | CP21 retained rectangle cuts: choose a live region, cut at supplied coordinate, preserve unrelated IDs; explicit deletion | Private prototype; selected-cell edit needed before admission | Root owns semantics; Terra prototype/edit. Analytic order/atomicity checks plus one native local edit and decoration transfer. |
| A2 | Starting-point and reference reconciliation: current capability links, truthful shipped vs repository examples, no stale missing-feature claims | Executable; current catalog and0.23 review | Luna edits authored docs only. Root checks claims against actual entry points; generated reference stays catalog-derived. |
| A3 | Asset-aware rendering: explicit source asset directory staged inside each render sandbox, preserve relative paths, bind file hashes, reject escapes | Executable after java-render-assets-brief.md; existing render_java | Terra after root behavior brief. Actual font/image consumer, missing/changed/escaping asset checks; retain shared lease and time budgets. |
| B1 | General native renderer selection: same seed/parameter helper for JAVA2D/P2D/P3D with actual renderer assertion | After A3 or isolated renderer module changes; use existing DepthMarks runtime infrastructure | Root defines supported runtime/profile boundaries; Terra implements. One2D and one3D representative output, no fallback, focused failure cases. |
| B2 | Bounded frame-sequence export: one simulation run, selected completed frames saved in order, explicit frame-based time | Root brief; can precede B1 for JAVA2D | Root or Terra. Accumulating sketch proves consecutive state/RNG; selected snapshots match existing single-frame helper; interruption leaves honest partial output. |
| B3 | Interactive spring/triangulation composition using supplied targets | Source read complete for araniaaas target policy; public core unchanged | Terra after root composition brief. Explicit input replay, retained topology decision, target changes and reset; distinguish source resemblance from reproduction. |
| C1 | Tapered field-body capability: compose backward field integration and supplied width profile | Root investigation of peces and current path API; no history-buffer premise | Root decides missing reusable algorithm; implement only if existing path values cannot express it clearly. Mature-frame evidence required; early none scores do not establish ranges. |
| C2 | Palette extraction/application helper | Root scope decision against Phase4 and existing color tools | Bounded deterministic image-to-palette proposal, explicit alpha/color/count semantics; known-color image and actual artist reuse. No new color core unless justified. |
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
