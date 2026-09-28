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

## Structural field operators (W1 first batch, 2026-09-28)

[Frozen slice contract and implementation map](composition-structural-operators.md) admits
three studies built on the W0 reference boundary:

1. **Recursive Cell Worlds** (brief 06) — bounded recursive subdivision with replaceable
   terminal fillers; stable lineage, depth bounds, selective stopping, and child retention
   that leaves negative space without affecting sibling seeds. Terminal leaves reuse the
   region-quilt fill path (`regionGeometry` + `regionFill` + three-level nesting).
2. **Ordered Disorder** (brief 07) — regular lattice under a shared correlated value-noise
   field. Displacement, rotation, scale and omission are coherent across nearby cells.
   Anchored sites stay pinned. A smooth falloff limits disorder to a focal region. Zero
   disorder is exactly ordered.
3. **Wallpaper Motifs** (brief 22) — seventeen explicit plane groups with lattice bases
   and operation tables. Fingerprint deduplication, margin culling, and stable lattice
   IDs (`wall:i:j:op`) survive viewport changes. A new **arrow** mark makes rotation and
   mirror visible. Symmetry breaking selects a stable subset of instances.
4. **Contour Scores additions** (brief 04 completion) — `phaseSpread` (cross-path phase
   spread) and `levelRamp` (bead size mapped from contour band index). Both default to
   zero, preserving the accepted reference artifact.

Shared changes: `CompositionSurface.scale(x, y?)` supports mirror (negative scale);
`Path.levelFraction` stores normalized band position; `LatticeSite` adds origin/anchor/kept/exception;
`RegionTreeNode` adds id/parentId/depth/terminal; `MotifSpec.kind` adds "arrow".

**Verified**: package build passes, 48 tests pass (27 existing + 21 new covering all four
studies and material boundaries), pack/smoke test passes, `referenceComposition` resolves
all three new IDs with correct kinds (wallpaper/lattice/cells) and palettes, draw paths
produce sites/leaves without errors. The host was exercised with a verified three-package
install (123 workflows generated, 102 API entries current); full authenticated Studio
workflow was not completed.

This admits the three studies and their shared additions, not all W1 briefs or W2+.
Continue from the frozen types, sources, materials, reference resolution, instrument
definitions and guides rather than inventing parallel loaders or parameter conventions.

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
