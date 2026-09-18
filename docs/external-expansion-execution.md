# Full external corpus expansion execution

The maintainer's 17 September 2026 instruction requires implementation of the entire
[delivery plan](external-art-p5-expansion-plan.md). Its batch stopping conditions are
integration checkpoints, not permission to end the overall assignment. This execution
record supersedes that document's immediate-handoff scheduling, while preserving the
research snapshot and its evidence hashes.

## Starting point, 17 September 2026

Everything below is on `main`. The last integration merged the web identity redesign with the
previously uncommitted expansion work, so there is no separate branch to recover: the local
`integration/*` and `web/studio-ui-refinements` branches were fully contained in `main` and have
been deleted. `origin/porting/backlog` is also contained in `main`; **`origin/porting/batch-01`
still holds eight unique commits** and belongs to the port handoff, not to this work.

What this checkpoint settled, with evidence in
[the integration record](../evidence/web/main-integration-checkpoint.json):

- The nine dynamics studies are integrated in the gallery (104 generated workflows) and are now
  interactive. A retained replay snapshot chain replaced full recomputation, so a single slider
  press costs 5–635ms instead of up to 9.2s, with drawing output unchanged across 62 command
  hashes. They remain **drafts**: no web review record, no release.
- The weighted-image, recorded-controls, mesh-attribute and implicit-ray operations are exported
  from the JavaScript package index, bound in the reference generator and published in the
  generated reference (89 operations). Their pure fixtures pass (30, 43, 38 and 21 cases) and
  their native browser harnesses pass today.
- `apps/web`: 208 tests pass, typecheck passes, generated-metadata check passes, production build
  passes. Twelve stale study manifests were repaired and the stepped-footprint sliders now expose
  only valid ledges.

## Next actions, in order

1. **Accept or reject the five surfaced operations.** They have contracts, fixtures, editable
   examples, passing harnesses and reference pages, but `catalog/validation` holds no record, so
   support is unvalidated. Re-run the four harnesses under the shared render lease, review their
   images, then author the attestations the way
   [flock-steer-2d](../catalog/validation/flock-steer-2d.json) does.
2. **Art-direct the nine dynamics studies, then review them.** Latency is resolved; composition is
   not. Dye currents and guarded bands read as artwork. Bridge web, elastic loops and neighborhood
   growth still read as technical diagrams, and hatched islands exposes no continuous structural
   control. Apply [creative quality](creative-quality.md) before proposing a release.
3. **Reconcile the catalog binding check.** `tools/check_catalog.py` reports stale implementation
   hashes for warp-marks, blur-marks and several py5 records that the creative-quality revision
   changed. Decide per record whether to re-attest or to mark the binding superseded.
4. **Then continue the delivery table below**, starting with the families marked Design.

Working state that is deliberately not on `main`: `.work/web-ui-release` still holds an old
release worktree with an uncommitted 21-file diff, captured as
`.work/handoff/web-ui-release-uncommitted.patch`. Its branch content is an ancestor of `main`;
discard the worktree once you have confirmed nothing there is still wanted. Measurement scripts
and harness reports from this checkpoint live under `.work/handoff/`.

## Progress

17 September 2026 — step 1 complete. All five surfaced operations are accepted in
[the visual operations root review](../evidence/expansion/visual-operations/root-review.json).
The native harness reports were re-run under the shared render lease (weighted-image 30 pure
cases, implicit-ray 43, mesh-attribute 38, recorded-controls 21, plus the installed-package
runs and the two web study harnesses), the harness images were reviewed, and five
`catalog/validation` records were authored in the flock-steer-2d format. `check_catalog.py`
reports no error for the five new records; the 13,355 remaining lines are the pre-existing
binding backlog measured against pristine `HEAD`. The web surface lands with the
image-and-controls adapter wired into the studio, gallery and API generator (106 workflows,
89 operations); 208 web tests, typecheck and the generated-metadata check pass. Step 3
blocks the `docs/reference/operations.md` regeneration, which is also where the
raymarch-implicit-rays-3d entry (added after the reference's last write) lands.

18 September 2026 — step 2 complete. The nine dynamics studies were art-directed and
reviewed in the real web interface: the five flagged studies (sensing-trails, bridge-web,
neighborhood-growth, elastic-loops, hatched-islands) now expose continuous structural
controls with visible, distinct outcomes across each range; the other four (dye-currents,
guarded-bands, lingering-links, flocking-marks) passed unchanged. Elastic loops was
realigned to the accepted native sketch geometry and collision regime, with range and
strength as two controls and combined upper bounds verified runnable. The control model,
exploration and root verdict are recorded in
[docs/dynamics-creative-review.md](dynamics-creative-review.md); the renders are registered
as `dynamics-web-quality-draft-20260918` in the visual review. The studies remain drafts:
saved-work migration, reset/reload and export checks still precede release.

18 September 2026 — step 3 complete. Reconciled the catalog bindings that the
creative-quality revision and the additive barrel exposure made stale. The per-record
decision:

- **warp-marks** (`bilinear-raster-remap`) and the **fourteen blur-marks batch records**
  (annular-solid-3d, binary-cell-partition-2d, clip-segments-simple-polygon-2d, delaunay-2d,
  gradient-noise-3d-01, masked-source-over, occupied-lattice-paths-2d,
  ordered-convex-polygon-filter-2d, radial-pull-2d, raster-crossfade,
  retained-rectangle-cuts-2d, separable-blur-2d, sequential-disc-projection-2d,
  target-springs-2d): the redesigned native examples are drafts ("not a root acceptance
  record") and their render evidence predates the new bytes, so the p5js dimensions bound to
  those example bytes are marked `unvalidated` (superseded), per
  [creative quality](creative-quality.md) ("preserve historical technical evidence without
  grandfathering quality"). The core operations and the processing-java reference acceptance
  are unchanged and remain accepted. These dimensions re-attest with fresh model and render
  evidence when the drafts pass creative review.
- **Six py5 records** (cyclic-palette, gradient-noise-2d-01, gradient-path,
  ordered-circle-filter, regular-grid, seeded-circle-placement): the only staleness was the
  additive package-barrel exposure (`packages/javascript/src/index.js`,
  `packages/python/procedurals/__init__.py`); their cores are unchanged. Re-attested by
  updating the barrel drift-pins in the records and in the four live-bound reviews that pin
  them (cp2-p5js, cp2-py5, placement-p5js and placement-py5 root reviews). The acceptance
  decisions and the historical barrel (via the export-compatibility review) are preserved.

`check_catalog.py` now reports zero errors for these 21 records (468 stale lines removed).
The remaining ~12,900 lines are the pre-existing binding backlog (records and reviews that
pin the web app, docs and other live files) and are not part of this step. Because the check
returns early on any error, the `docs/reference/operations.md` regeneration — and with it the
`raymarch-implicit-rays-3d` entry that postdates the reference's last write — stays blocked
until that backlog is reconciled.

## Standing priority

Apply [creative quality](creative-quality.md) to existing and new components, techniques and
studies. Correct the shared range model and the ornament/panel and embossed/signed-edge studies
first, then address the broader gallery audit by computational family.
Preserve all completed implementation and historical technical evidence.
The delivery table below records expansion scope; its earlier acceptance and design labels
do not establish current creative approval or live deployment. The full expansion remains
required after this corrective work; adding entries is not the immediate release objective.

## Expansion scope

The corpus and 50 default palettes are delivered. Batch A and the first B slice are
accepted in [their review](../evidence/expansion/first-batch/root-review.json). Remaining
work below is active; a proposal, passing core test or generated image alone is not completion.
Every implemented slice needs reviewed semantics, distinguishing checks, an editable native
workflow, structural and appearance edits, substitution, package replay and root review.
No new port or original-artist recreation is implied.

`Accepted` means a root acceptance record exists. `Cores accepted; studies draft` means the
operations carry acceptance in [the second batch review](../evidence/expansion/second-batch/root-review.json)
while their gallery studies are tracked drafts without a web review. `Implemented; acceptance
open` means contracts, fixtures, package exports, reference pages and passing native harnesses
exist with no `catalog/validation` record yet.

| Delivery | Required remaining result | State |
|---|---|---|
| A | Three compositions, retained motifs and independent controls | Accepted |
| B | Radius pairs and reciprocal synchronous response | Accepted |
| B | Stable contact history; separate sensor and flock rules; bounded gravity/contact model | Cores accepted; studies draft. Bounded gravity/contact model still missing |
| C | Width-aware strip regions, collision/negative-space acceptance, caps/joins | Cores accepted; studies draft |
| D | Connected elastic evolution, growth and stable split ancestry | Cores accepted; studies draft |
| E | Image-weighted sampling/centroids, region hatching, related wash layers, plot/SVG output | Hatching and plot/SVG accepted; weighted sampling/centroids implemented, acceptance open; wash layers pending |
| F | Explicit framebuffer history; projected fluid velocity and dye transport | Cores accepted; studies draft |
| G | Known-font geometry, recorded signals and mapping; scoped live input lifecycle | Recorded signals and mapping implemented, acceptance open; font geometry limited to the bundled GlyphMarks face; live input lifecycle pending |
| H | Mesh normals/UV/p5 presentation and bounded implicit fields/mesh or shader output | Mesh attributes and implicit rays implemented, acceptance open; shader output pending |
| I | Attractor-consumption veins, DLA, multiscale competition, flames, complex dynamics, maps | Pending |
| Audit | Coupled agent deposition/diffusion/sensing | Pending |
| Audit | Crossing/stitch topology, hinged panels, periodic identified domains | Pending |
| Audit | River migration/cutoffs; visibility-aware projected lines | Pending |
| Audit | Intersection graph editing; relative-neighborhood graph evolution | Design |
| Audit | Density/color accumulation and independent exposure; bounded analytic maps | Pending |
| Audit | Image k-means; seeded color-front growth; moving-spline deposition | Pending |
| Audit | Retained graph subset queries; separate Hilbert, Ulam and Penrose constructions | Pending |
| Audit | Bounded cell ancestry/reconnection; panel/seam assembly data; material fields | Pending |
| Composition map | Optical/periodic grids, spectral patterns, pixel sorting, point clouds and data-driven studies | Pending |
| Integration | Installed package, generated reference, visual gallery and final coverage reconciliation | Pending |

The plan explicitly excludes learned-model training, distributed evolutionary services,
full 3D cellular growth and production fabrication pending a separate task. These remain
exclusions, not implemented capabilities. Camera acquisition and segmentation are separate;
font geometry does not promise general multilingual shaping. Unsampled research families
such as tensegrity, optimal transport and full weather remain evidence limits. Each scoped
choice must explain what it implements without silently counting its adjacent exclusions.

Root owns contracts, public admission and integration. Workers receive disjoint bounded
slices and return evidence; checkpoints preserve completed results while execution proceeds.
Historical acceptance bytes and corpus research reports remain unchanged. The current export
predecessor was preserved under `.work/expansion-full/predecessor/` before further changes.
