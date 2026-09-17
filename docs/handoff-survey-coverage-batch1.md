# Handoff: implement the highest-value additions from the survey coverage report

Authored 2026-09-17 for delegation to an implementing agent. Task-specific brief; the durable
assignment template remains [agent-briefs.md](agent-briefs.md).

## Mission

Close the largest remaining corpus-recreation gaps identified in
[survey-operation-coverage-report.md](survey-operation-coverage-report.md), **after** reconciling
that report against operations that landed since it was written. Deliver reviewed contracts, a
single-target implementation, runnable examples, native/visual evidence and an updated coverage
ledger.

## Pinned state — read before anything else

- Report: `docs/survey-operation-coverage-report.md` (currently **untracked**).
- Per-sketch ledger: `evidence/coverage/survey-operation-coverage.json`, 826 records (**untracked**).
- The report was authored 2026-09-13 against repo HEAD `d4f5e77124d423a30ad7206619f37a1960b12eec`
  and a **34-operation** catalog (digest `133dfe793d7f6b3edfaaaaa7a9e93b8e449ccc5365e85e5b7a682738214b78a1`).
- Current HEAD is `47c78d2f1742e4a167028043a6f67f5cbe1a70a9`. `catalog/operations/` now holds
  **64 operations**. Thirty landed in commit `4724f0d7` ("Add thirty p5 operations and sixty
  editable gallery studies").
- Those 30 are **p5-only**: `p5js.implementation_status = pending`, `native_status = unvalidated`;
  `processing-java`, `py5` and `processing-android` are `deferred`. Java remains at
  **31 operations / 37 workflows**. Several of the 30 carry `"description": "Draft proposal only."`
- Therefore **every count in the report's tables is stale by construction.** Do not quote report
  numbers as current without redoing step 0.

## Step 0 — mandatory reconciliation (no design or code before this is done)

1. Rebuild the operation inventory from `catalog/operations/` (all 64): id, semantics,
   `deliberately_excluded` / `exclusions`, and per-target implementation status.
2. For every blocking family in the report's 69-family inventory, classify against **current**
   semantics as `closed`, `partial` or `live`, citing the specific catalog entry and clause.
   Name matches are not evidence; read the contract.
3. Treat the table below as a **hypothesis to verify**, not as findings.
4. Note that many of the 30 new operations (`adjacency-tile-collapse-2d`, `life-like-step-2d`,
   `elementary-cellular-rows`, `gray-scott-step-2d`, `damped-wave-step-2d`,
   `euclidean-distance-transform-2d`, `binary-morphology-2d`, `median-cut-quantize`,
   `oklab-ramp`) are technique expansions that map to **no** surveyed gap family. They must not be
   counted as corpus coverage without an explicit sketch mapping.
5. Output `evidence/coverage/reconciliation-2026-09-17.json`: per-family verdict, cited evidence,
   revised affected/sole-gap counts, and revised plausible-support totals with explicit
   denominators (assessed 800, snapshot 826, target 901).

### Overlap hypothesis — likely CLOSED by the new operations (verify, then drop from scope)

| Report family | Report affected / sole-gap | Candidate current coverage |
|---|---:|---|
| `sampling.poisson-disk` | 4 / 3 | `poisson-disc-2d` |
| `layout.packing-shelf` | 4 / 2 | `skyline-pack-2d` |
| `geometry.polygon-offset` | 1 / 1 | `offset-polyline-2d` |
| `geometry.open-spline` | 2 / 1 | `chaikin-polyline-2d` + `simplify-polyline-2d` |
| `post.edge-detect` | 1 / 1 | `convolve-2d-signed` |
| `mesh.extrude` | 5 / 2 | `extrude-simple-polygon-3d` |
| `geometry.point-in-polygon` | 1 / 0 | `triangulate-simple-polygon-2d` |

### Overlap hypothesis — PARTIAL, needs a real semantic decision

| Report family | Report affected / sole-gap | Candidate | What to check |
|---|---:|---|---|
| `path.flow-trace` (report rank 2) | 45 / 31 | `rk4-vector-grid-trace-2d`, `scalar-grid-curl-2d` | Corpus cases sample analytic noise **per position** and map scalar → heading; the new op consumes an explicit **bilinearly sampled vector grid**. Decide whether caller-built grids preserve structural fidelity or whether a scalar-to-heading trace is still required. |
| `path.unrestricted-grid-walk` (rank 6) | 13 / 11 | `seeded-depth-first-spanning-tree`, `cost-grid-paths-2d` | Those are maze/least-cost topology. Revisiting stochastic lattice walks are probably still live. |
| `topology.triangle-subdivide` (rank 10) | 7 / 6 | `loop-subdivide-triangles-3d` | Loop subdivision is deterministic uniform refinement; corpus cases select a face and split stochastically. Probably still live. |
| `mark.tapered-line` | 7 / 3 | `parallel-transport-ribbon-3d` | Check the 2D variable-width ribbon case with joins/caps. |
| `sampling.circle-pack` | 5 / 2 | `lloyd-relaxation-2d` | Relaxation versus growth packing. |
| `path.custom-state-walk` | 10 / 4 | `cost-grid-paths-2d`, `seeded-depth-first-spanning-tree` | Likely mostly live. |
| `post.threshold` | 4 / 2 | dither/quantize ops | Thresholding/levels versus dithering are different contracts. |

### Confirmed UNAFFECTED — no operation in the 64 addresses these

`post.pixel-grain`, `field.fbm`, `field.noise-displace`, `field.simplex-noise`,
`field.radial-attract-repel`, `field.raster-domain-warp`, all five rectangle-partition families
(`unequal-four-way`, `variable-grid`, `biased-binary`, `conditional-mixed`, `retained-parent`),
`layout.quad-subdivide`, `layout.box-subdivide-3d`, `layout.grid-transform`,
`path.heading-wander`, `topology.proximity-graph`, `post.vignette`, `post.color-grade`,
`post.scanlines`, `post.directional-mask-blur`, `geometry.segment-intersection`, `post.feedback`.

Both noise operations explicitly exclude `octave accumulation` and `signed simplex`; no catalog
entry provides pixel grain. Re-verify by grepping the catalog rather than trusting this line.

### Revised live ranking (recomputation; reproduce it, do not assume it)

Baseline plausible support was 439/800. Recomputed: **449/800** if only the clearly closed
families are removed, **513/800** if every partial overlap above verifies.

| Rank | Family | Affected | Sole gap | Projected gain (conservative → full-overlap) |
|---:|---|---:|---:|---|
| 1 | `post.pixel-grain` | 57 | 30 | +30 → 479 / +31 → 544 |
| 2 | `field.noise-displace` | 49 | 28 | +28 → 507 / +30 → 574 |
| 3 | `field.fbm` | 30 | 9 | +19 → 526 / +22 → 596 |
| 4 | `layout.unequal-four-way-partition` | 24 | 15 | +15 → 541 / +15 → 611 |
| 5 | `path.heading-wander` | 18 | 7 | +7 → 548 / +12 → 623 |
| 6 | `layout.variable-grid-partition` | 13 | 10 | +10 → 558 / +10 → 633 |

## Scope of this assignment — batch 1 only

Implement **exactly three** capabilities, in this order:

1. **Pixel grain** (raster): seeded per-pixel brightness/alpha perturbation. Cohesive, cheap,
   largest sole-gap closure, and it reuses the raster boundary already set by
   `separable-blur-2d` / `masked-source-over` / `raster-crossfade`.
2. **Field-driven coordinate displacement**: displace supplied points/polylines by a sampled
   two-channel field. Keep radial attract/repel and raster-source-coordinate warping **out**.
3. **Octave (fBm) accumulation** over the existing gradient-noise fields: octave count,
   frequency/amplitude progression, normalization, exact binary64 order.

Then **stop and report**. Do not start rectangle partitions, heading wander, simplex noise,
proximity graphs or any shader-adjacent work in this pass. The rectangle families touch the
accepted boundaries of `seeded-quadrant-partition`, `binary-cell-partition-2d` and
`retained-rectangle-cuts-2d` and need a root decision first.

## Target

Implement **p5.js first**, matching the cadence of the 30-operation batch and leaving the Java
0.35 runtime baseline untouched. Mark `processing-java`, `py5` and `processing-android` as
`deferred` with no support claim. If you believe Java-first is better, say so in your plan and
get root sign-off before writing code — do not silently choose.

## Required process per capability

Follow the existing lifecycles; do not invent new ones:

- `skills/parameter-evidence/SKILL.md` — exposure, defaults, hard bounds, recommended ranges are
  separate decisions. Do not invent ranges. Measured change alone does not establish a useful range.
- `skills/operation-contract/SKILL.md` — written API design and reviewed contract precede code.
- `skills/deterministic-generative-semantics/SKILL.md` — RNG, noise, ordering, numerics explicit.
- `skills/portable-operation-implementation/SKILL.md` — implementation and fixtures.
- `skills/capability-and-adapter-boundaries/SKILL.md` — required for the raster grain operation.
- `skills/corpus-reproduction/SKILL.md` — for the motivating recreation.
- `skills/catalog-surface-synchronization/SKILL.md` — derived reference, UI, export metadata.
- `skills/generative-performance/SKILL.md` — only if the operation is count/resolution sensitive.

Deliverables per capability:

1. `design/capabilities/<id>.md` answering all seven questions in
   [artist-capabilities.md](artist-capabilities.md), including the before / projected-gain / cost /
   transfer / after-validation statement required by
   [recreation-coverage.md](recreation-coverage.md). Cite motivating sketch notes by path and hash.
2. `catalog/operations/<id>.json` with exclusions, error order, ownership, numerics, parameters
   and per-target status; plus `fixtures/operations/<id>.json` with semantics-distinguishing cases.
3. Implementation with the named native surface, and one editable example/study.
4. `catalog/validation/<id>.json` + bound evidence, scoped to what actually ran.
5. Evidence JSON under `evidence/` with a root review record.
6. One **transfer check** using a sketch withheld from the API design, status stated explicitly.

## Acceptance gates

- Every native render goes through the shared lease:
  `python3 tools/with_native_render_lock.py -- <existing native command>`. Never bypass it.
- Register meaningful images in `docs/visual-review.json`, then run
  `python3 tools/build_visual_review.py`. Gallery inclusion is navigation, not acceptance.
- Focused checks, run once per meaningful change:
  - `uv run python tools/check_catalog.py`
  - `node tools/build_ported_javascript_package.mjs .work/dist/<fresh-directory>`
- Regenerate derived surfaces with their tools; never hand-edit generated output.
- Update `PROJECT_STATE.md` by **replacing** stale entries (operation counts, target table,
  current work), not by prepending history. Keep it near 100 lines.
- Update the coverage ledger and report for **affected families only**. Do not re-run the whole
  800-sketch classification.

## Hard constraints

- No generic custom-shader operation. Shader evidence decomposes into grain, colour grade,
  vignette, scanlines/chromatic offset, directional/spatially varying blur, depth fade.
- Do not widen `seeded-quadrant-partition`, `binary-cell-partition-2d` or
  `retained-rectangle-cuts-2d` to absorb new partition families.
- Do not hand-edit `survey/`, `data/`, `reports/`, `benchmarks/corpus.json`, `analysis/phase2/`
  or `design/phase2/candidate-triage.json`. `design/phase2/cluster-decisions.json` is authored
  state — never overwrite it with suggestions.
- No rendered images, toolchains, environments, logs or temporary builds in Git. Temporary work
  goes in ignored `.work/`.
- Never infer native or technique support from a core fixture pass, another platform, compilation
  or mocks. Never mark a deferred target validated. A selected suite is not full-corpus certification.
- Do not weaken checks, omit failures, or mark incomplete work accepted to publish a checkpoint.
- Do not reopen completed CP1/CP2 decisions.
- Preserve the unrelated working-tree edit in
  `packages/java-android/examples/ProfileMarks/ProfileMarksActivity.java`. Do not stage or delete
  the `.gradle/` directories under `packages/java-android/distribution/templates/` or
  `tests/native/android-bootstrap/`.
- No force-push, no `git reset --hard`, no discarding another worker's changes. Commit useful
  integration checkpoints only, after tests and review.
- Root owns public boundaries and semantics. Propose; do not self-admit public API.

## First commit suggestion

Commit the untracked `docs/survey-operation-coverage-report.md` and
`evidence/coverage/survey-operation-coverage.json` unchanged as the analysis baseline, then add
`evidence/coverage/reconciliation-2026-09-17.json` on top so the correction is auditable.

## Report back with

1. The reconciliation table: per-family `closed` / `partial` / `live` with cited catalog evidence.
2. Revised plausible-support totals with all three denominators, and the delta versus the
   report's 439/800 and 346/800 figures.
3. Which of the three batch-1 capabilities you designed, implemented and validated, with
   evidence paths and exactly what ran versus what you only walked through.
4. Measured coverage change after validation, separating newly **demonstrated** recreations from
   **plausible** ones.
5. Anything you deliberately did not do, and the decision root still owes you.
