# Next release: current direction and progress

Updated 2026-09-28. The [next-release roadmap and implementation guide](next-release-roadmap.md)
is the authoritative direction for the successor to
[`web-toolkit-v0.2.2`](https://github.com/cdlethem/procedural/releases/tag/web-toolkit-v0.2.2).
This is its current progress snapshot, replaced as work advances—not an accumulating handoff log.

## User-directed decisions

- Greatly expand what artists can discover and compose in Studio. Plan closer to **50
  substantial artistic additions than ten**, without manufacturing entries to hit a quota.
- Make **functional composition** central: techniques can consume other techniques.
  Separate placement from marks, paths from materials, regions from fillers, and fields
  from the processes they control. Drawing a dot is one possible callback, not a baked-in
  property of a distribution algorithm. Nested compositions must retain substitution points.
- Grow capability without corresponding algorithm/API bloat. A useful new composition may
  require no new public computation; a new algorithm must remove real reusable work.
- Review the visual corpus broadly, including several examples of each major observed style
  for each artist. Names, descriptions and three contact sheets are not sufficient research.
- Root owns the authoritative roadmap and may reconcile contradictory agent-facing guidance.
  The earlier “strengthen everything first” ordering is superseded: extraction, improvements,
  functional composition and substantial additions form one coordinated release program.

## Completed observations

- Exact release audit: commit `189b288e42965d7b2a179103c13160f004216349`;
  **117 workflow IDs, 99 canonical instruments, 14 discovery families**. These are different
  dimensions, not 117 independent algorithms. Existing flames, reaction diffusion, weaving,
  screen registration, flow tracing and growth must not be proposed as wholly absent.
- Read package ownership, input validation and preparation interfaces. Current instrument
  parameters are scalar number/string/boolean values; existing local image-like sources
  are not a general asset or typed cross-technique input contract.
- Corpus index maps **6,497 distinct local images**, 24 artist/studio groups, 1,988 of 2,023
  selected records. There are 383 unavailable source URLs; absent images do not prove absence
  of an artistic style. The tracked corpus remains the provenance authority.
- Created **229 labelled contact sheets** covering the available assets, with per-image
  source mappings in `.work/next-release-visual-review/`. Eight visual research workers
  report completing all groups. Root also viewed a sheet from each group and 58 mapped originals,
  plus all six existing instrument-baseline contact sheets. Contact-sheet review is not
  full-resolution review of every asset; some mapped originals are themselves small.

## Completed planning and reference implementation

The [roadmap](next-release-roadmap.md) specifies **56 capability briefs in eight areas**,
eight shared foundations, six delivery waves, existing file ownership, the first vertical
slice, twelve layered acceptance scenarios and release/verification requirements.
These are not 56 promised new algorithms or a mechanical count of gallery tiles.
The [visual synthesis](next-release-visual-review.md) covers all 24 groups; the
[review mapping](../evidence/external-art/2026-09/next-release-review.json) preserves
root's 58 exact original references and the narrative's numbered source citations.

Supplementary original-image comparisons corrected initial worker misattributions and
missing-feature claims. Still-only, small-source, process/photo and one-image exceptions
remain explicit. Reas #143 could not be individually opened by the worker; its sheet
thumbnail remains available. No missing variant was invented to satisfy a sample count.

Agent entry points now agree: `AGENTS.md`, `PROJECT_STATE.md`, the delivery roadmap and
creative-quality guidance point to functional composition and coordinated expansion.
The two historical external-expansion documents have updated authority banners; their
historical evidence and implementation records are preserved.

**Completed W0 reference examples**, authorized as a bounded implementation after planning:

1. **Motif Ecologies** separates immutable Poisson sites from dot/ring/rosette callbacks.
2. **Contour Scores** separates sampled contours from ink, tangent stitches and nested beads.
3. **Region Quilts** substitutes hatch, motif and contour fillers; the last two genuinely
   nest the same point/path consumers and share their work/depth budget.

The [reference contract and implementation map](composition-reference-slice.md) is the
entry point for subsequent agents. Public geometry, callback frames, identity/seed rules,
named typed recipes, cooperative preparation and conditional inspector metadata are
implemented. Three existing adapter families now use the shared consumers. Artist guides
include control tables, deliberate variations and ordinary-function examples.

Root reviewed thirteen real-interface configurations and three layered pairs in both
orders, including sparse supporting fragments and third-level region/path/mark nesting.
The [evidence record](../evidence/web/composition-reference-slice.json) binds exact inputs,
images, packages, current host documents, observed costs and explicit limits. The final
artifact source is `d7bb73551d23d71a6e00f3c201411d2ab67a99fd`; it contains **120 workflow
IDs / 102 canonical instruments**, not 120 new algorithms.

This admits the reviewed three-study slice, not all shared foundations or the 56-brief
program. General graphs, cross-layer geometry links, richer domains/assets and later waves
remain roadmap work. Continue from these patterns rather than adding parallel loaders,
drawers or parameter conventions.

The package is **unreleased**. The private host was exercised with an isolated, verified
three-package install; primary private-app pins, tenant services and deployment were not
changed. Integrate a matching package bundle at the appropriate release milestone.

## On main for dev preview: structural operators and Fold Atlas (W1 first batch)

Recursive Cell Worlds (06), Ordered Disorder (07), Wallpaper Motifs (22) and Fold Atlas (26/27
shape) are on `main` and in the package metadata, so the private app's dev preview shows them.
They render and pass their tests but are **not accepted as finished studies**. The
[slice contract](composition-structural-operators.md) records the workflow, the exact semantics
and the review record.

Root reviewed rendered output (defaults, seeds, all 17 wallpaper groups, every fold map,
control sweeps, and one map applied to released wallpaper, contour and motif sources) and fixed
real defects it found: unreadable per-site coloring, incomplete p4m/p4g operation sets, wrong
mirror angles, a cell tree that only cut horizontally at exact halves, disorder too weak to
see, a warp that erased a source's own colors under a fold, and a phase-spread precedence bug
that put up to 4% of stations off an open path. Still open: real-interface exploration of each
control, layered compositions in both orders, responsiveness at large settings, and whether
Cell Worlds is distinct enough from Region Quilts.

Fold Atlas is the first coordinate-map **consumer**: `warpSites`/`warpPaths` fold any existing
sites or paths, with an explicit singularity policy, so Motif Ecologies, Wallpaper and Contour
Scores geometry can be swirled, inverted or unrolled without new per-study code.

Existing entries: only the three reference entries changed (an `arrow` mark option, and
`phaseSpread`/`levelRamp` on Contour Scores, both defaulting to zero). Their 36 default/variant
renders across three seeds match the reference-slice commit pixel for pixel; the other 117 are
untouched.

Verification: package build, 58 tests (31 new property tests; mutations of six behaviours
confirmed to fail them) and the `--allow-dirty` preview build over all 124 instruments. The
isolated private host was not run.

## In progress on branch `conditional-controls`: conditional controls (F9)

Scope added by the maintainer: the app should show only the controls relevant to the current
choices. [Contract, evidence tooling and coverage](conditional-controls.md); planned as
foundation F9 in the [roadmap](next-release-roadmap.md), with a per-brief declaration and a
verification requirement.

Built: a precise `visibleWhen` contract (discrete drivers, effective visibility through hidden
drivers, retained values), load-time validation, a shared `visibleParameters(id, values)`
helper, and an overlay (`control-dependencies.ts`) so legacy adapters get conditions without
hand edits. Coverage is **measured**: a recording-canvas audit of all 124 instruments
(2,362 controls, about 40,000 drawing probes) produced 292 conditions across 84 instruments,
each tried against randomized numeric settings and rejected if it hid a control that matters;
38 were rejected that way. The audit found two real defects in the newest studies (a wrong
hand-written condition, and a cell-height leak with a stale-cache path), both fixed.

Left visible on purpose: 364 controls whose relevance is a disjunction (`weight` matters if
any of several `show…` toggles is on), 46 that are numerically disabled, and 38 refuted. The
first group needs alternatives in `visibleWhen`, which should wait for the private app to adopt
`visibleParameters` (its current `LayerControls` would throw on an array).

Open: private-app adoption of the helper and empty-group hiding; alternatives for disjunctions;
numeric-threshold drivers; a real-interface pass over a sample of the newly conditional
inspectors.

## Committed on main (9213ae94): control groups (F10)

Scope added by the maintainer: the package decides, for every instrument, which control groups
exist and which controls belong to them; the app decides presentation (sections, ratio locks,
one slider driving a cluster). [Contract and authoring guide](control-groups.md).

Built: a required `InstrumentDefinition.controlGroups` tree (labelled, ordered, at most three
deep, every control in exactly one group), load-time validation, a derived `Parameter.group`
path with `parameters` reordered into group order (so the app's current nested fieldsets pick it
up unchanged), and `inspectorItems(id, values)`, which applies F9 visibility and omits empty
groups. `proportional` marks clusters of non-negative numbers in one unit that may be
ratio-locked; validation rejects signed, non-numeric or nested members.

Coverage: all 124 instruments (2,362 controls) are grouped, with 144 proportional clusters
(footprint sizes, mark diameter with line weight, grid columns/rows, paired radii, weights and
opacities). Reference entries were regrouped from their earlier inline paths. Root reviewed every
outline and normalized section order (`Placement` follows the first construction section) and
recurring labels. Grouping is organization only: 496 default and seeded random configurations
draw identical fingerprints before and after, and all 73 package tests pass, including six new
ones. The `--allow-dirty` toolkit preview built and passed its installed-consumer checks.

Open: private-app adoption of `inspectorItems` and a ratio-lock UI for proportional groups; a
real-interface pass over a sample of the regrouped inspectors. Label and `visibleWhen`
inconsistencies the grouping workers noticed are not fixed here (e.g. `annular-marks` light
controls lack the conditions `profile-marks` has; `registered-screens` screen offsets are
inconsistently conditional).

## Program status (updated as waves land)

**W1 structural discovery: built, on `main`, not closed.** Beyond the earlier entries (01, 03, 04,
06, 07, 22, 27), seven more briefs are instruments with guides, tests and control groups:
Branch Ornament (02), Graph Roles (05), Substitution Tilings (23), Optical Plates (28),
Typographic Rhythm (39), Gesture Scores (40) and Data Scores (42). Each has its own doc
`docs/composition-<name>.md` with frozen semantics, limits and review notes. Package tests: 277.

Input contract frozen for briefs needing assets: the library defines typed, frozen, resolved
values (`Recording`, `DataTable`, `TextSource`) that the direct API and typed descriptors accept,
and each study ships bundled deterministic samples chosen by a validated select. Binding a user's
own recording, table or text to a saved instrument is future host work.

Real-interface review (isolated copy of the private app on a separate port, package preview built
with `--allow-dirty`, `LayerControls` patched there to render `inspectorItems`): all seven new W1
studies plus the seven earlier entries were operated through their actual controls with
structural sweeps; defects found and fixed for Graph Roles (forest ran off canvas, route vanished
across components, arrow hairballs), Branch Ornament (looped default, single-root two-lobe) and
Data Scores (opaque column selects). Layered pairs were reviewed in both orders with unmodified
instruments for all new studies. Latency through the real controls at large settings:
27–391 ms per edit. Still open: Contour Scores with waves plus beads at default spacing clogs;
extreme-limit and combined-setting review is partial; the real Studio (auth/backend) was not
available, so layering used the host compositors' equivalent SVG surface, not Studio.

Deduplication resolved on main: the two graph types are bridged by `graphFromBranchTree`;
Recording and Word Echo's recorded-control sampling stay distinct with a typed adapter (rationale
in the gesture doc); the plates stencil and typographic-rhythm ring geometry now run on the
planar-domains foundation; the bristle and sand consumers were extracted from Gesture Scores and
are shared with Dry Bristles and Sand Deposition. `fm-engraving` and `iso-rings` still carry their
own small clips (recorded in their docs) and are retrofit candidates.

Process notes: the first browser and Chromium review sessions ran without the native render
lease; later scripted Chromium runs use `tools/with_native_render_lock.py`. Several workers wrote
into the main checkout by relative path; each reverted its own hunks, and every merge is now
built and fully tested before it is committed.

**W2 materials and sources: built and merged** (19 briefs): Polygon Watercolor (08), Dry Bristles
(10), Sand Deposition (11), Stroke Relief (12), Region Stitch (13), Quilled Paths (14), Pixel
Sorting (29), Adaptive Compartments (30), Value Regions (31), Painterly Source (32), FM Engraving
(33), Slit Compositions (34), Image Directed Field (35), Outline Type (36), Glyph Packing (37),
Path Typography (38), Bundled Relations (41), Shape Packing (47), Crossing Lace (48). Foundations:
planar domains (F4, exact predicates, Booleans, offsets, mask/label extraction) and raster plus
image structure (F3). Real-interface review: defaults of all studies and randomized operation of
every control of all 20 newer studies (no console errors or blank canvases); layered pairs in both
orders with unmodified older instruments; latency 27-391 ms per edit at large settings. Not yet
done: per-study structural sweeps through the real controls for the W2 studies, and the real Studio.

**W3 stateful construction: foundation and two briefs merged, ten in flight.** F7 stateful
snapshots (`composition-snapshots.md`) is on main; five older dynamics instruments now run through
it with identical drawings. Merged: Chemotactic Trails (17) and Random Walk Fronts (21).
In flight (agents were interrupted by a host restart and resumed from their uncommitted
worktrees): Wet Pigment (09), Aggregation Colonies (15), Laplacian Fronts (16), Pattern
Competition (18), Cyclic Fronts (19), Cell Division (20), Roads and Parcels (43), River Ribbons
(44), Drainage and Erosion (45), Collision Scores (49).

**W4 spatial: foundation and three briefs merged, eight in flight.** Merged: the F8 spatial
foundation (indexed meshes, topology, sampling, cameras, exact hidden lines, planar sections and
surface iso-contours), Hyperbolic Gardens (24), Nodal Plates (25), Inversion Gardens (26).
In flight: Geological Cutaways (46), Surface Growth (50), Hinged Panels (51), Surface Weave (52),
Visibility-aware Mesh Drawing (53), Point Clouds (54), Local Mesh Abstraction (55), Implicit
Sculpture (56).

**Cross-cutting.** A layered-scenario pass (roadmap section 6) rendered seven of the twelve
scenarios from merged studies (ornament field, regional flow print, sparse ordered disorder,
material portrait, chemical garden, optical typography, gesture to many) with their decisive
edits; the remaining five need the in-flight studies. An option-by-option sweep through the real
select controls of 24 studies found no errors or blank canvases; inert-at-default options were
all disjunctive or numeric-threshold relevance, which the F9 extension (in flight) targets.


## Ownership and unchanged boundaries

- Public library: computations, reusable technique composition, drawing/preparation,
  instrument definitions, parameter descriptions, guides and source examples.
- Private `/home/colin/dev/procedurals-web`: UI, document bindings and serialization,
  asset storage, composition editing, canvas/layer lifecycle, authentication and persistence.
- Code authors may use ordinary functions. Studio needs serializable named compositions
  backed by the same implementations, not serialized JavaScript closures or a second engine.
- Existing artwork is disposable; no legacy renderer or saved-work compatibility shim is
  required. Preserve historical release and acceptance records, and do not overwrite other
  workers' work. Private tenant work and disabled visitor ingress remain separate.
- Functional composition must specify stable element identity/randomness, local coordinate
  frames, output ownership, cancellation, bounded nesting/work, and clear type compatibility.
  Avoid an unbounded universal graph framework as a prerequisite.

## Verification

- Package build and 27 tests passed, including composition semantics and the material
  boundary regressions discovered during review. The existing builder packed and
  offline-installed all three packages and checked their manifests/imports.
- All thirteen actual-interface images replay exactly on the final artifact. Three
  layered pairs replay exactly through both existing host compositors in both orders.
  Direct typed recipes match named rendering, and an ordinary custom callback uses the
  same sites as a stock mark.
- Verified hidden child values, seed/palette undo, source sharing, out-of-slider exact
  values, invalid-input/work rejection without losing the last image, and latest-wins
  cancellation during an observed loading state. The corrected filled-dot boundary also
  passed through actual controls. Generated host metadata and host typechecking passed;
  the focused nested-control browser scenario passed, not the full authenticated suite.
- Five predecessor defaults were compared natively: four exact, one small recorded raster
  difference. No whole-gallery or cross-target recertification is claimed.
- The earlier planning audit covers all 56 briefs, the 24-group visual synthesis, 229
  mapped sheets and 6,497 assets. That research informs direction; it does not admit
  unimplemented studies.
