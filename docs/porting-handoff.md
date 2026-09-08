# Porting handoff: Java 0.15 baseline

Pin the separate checkout/branch to the baseline commit supplied by root. Root owns main,
Java architecture, shared contracts and final support acceptance. Work on a separate branch;
submit reviewed patches and native results. Do not write root acceptance records, mark
shared attestations accepted, or merge/push ports to main independently.

## Accepted Java surface

The 15 operation contracts under `catalog/operations/` cover regular grid, cyclic palette,
gradient noise, gradient paths, triangle coordinate mapping, seeded triangle points,
ordered circle filtering, seeded circle placement, quadrant partition, endpoint branching,
radial profile surfaces, Delaunay topology, target springs, occupied lattice paths and
mutable line-pool branching. Exact operation IDs/versions and current target support are
in the contracts plus `catalog/validation/`; validation attestations supersede the frozen
contracts' historical implementation-status fields.

Accepted Java workflows: FieldMarks, PathMarks, PlacementMarks, RegionMarks, GrainMarks,
BranchMarks, ProfileMarks, GlyphMarks, FacetMarks, SpringMarks, LatticeMarks, ReliefMarks,
CityMarks, LandscapeMarks and CutBranchMarks. Java0.15 distribution acceptance is
`evidence/distribution/line-pool-review.json`. The archived bundle and native images are
machine-local ignored artifacts, not included in Git. Java2D/P2D/P3D and font requirements
remain workflow-specific. Three selected original sketches have reviewed structural
recreations; starter count is not original-sketch coverage.

## Start here

Four core operations already have all four recorded target scopes: grid, palette, gradient
noise and gradient paths. FieldMarks/PathMarks have scoped native target evidence. The other
11 operations still require deferred target ports and workflow validation. Begin with the
shared circle placement/filter result, then follow dependency order; see
`design/port-batch-01.md` and the frozen contracts, including all auxiliary fixture sections.

An unfinished JS placement core/runner and four browser example files are included as
**drafts**, without index exports, browser acceptance, target attestations or package release:

- `packages/javascript/src/circle-placements.js`
- `tests/native/circle-placements-javascript.mjs`
- `packages/javascript/examples/placement-marks/`

Root checked their syntax only for this baseline. Worker reports of fixture/helper passes
are not root acceptance; the earlier local fixture report predates final runner changes.
Run the final fixture runner in the fresh checkout, review semantics/ownership and then run
native acceptance from `design/capabilities/placement-marks-p5-acceptance.md`.
Do not infer support from these files' presence. No p5 PlacementMarks native runner exists yet.

Use `packages/python/` and `packages/java-android/` for the remaining targets. LinePool2D
requires reproducible fdlibm-style elementary math, not merely similar host sin/cos/atan2.
Keep numerical/error/iteration decisions shared; raise ambiguities to root before changing
contracts. Root reviews implementation and representative native results before acceptance.

## Shared machine resources

All native renders from every checkout must use:

```sh
python3 tools/with_native_render_lock.py -- <existing native command>
```

The common lock is `/home/colin/dev/procedural/.work/native-render-machine.lock`.
Never substitute a checkout-local lock. Existing runner locks remain subordinate. Preserve
failed attempts; do not remove a lock file or restart a live job because a poll timed out.
Toolchains/environments/renders/fonts are excluded from Git. Reuse this machine's existing
runtime locations explicitly or prepare ignored resources through the established tools.
GlyphMarks needs the exact separately licensed DejaVu font bundled by its existing builder;
no copied font asset is in this source baseline. Historical staging/package tools often bind
`.work` prerequisites, so a fresh checkout is not a self-contained render environment.

## Validation and scope

Baseline checks: 142 repository unit tests; catalog/source/fixture/reference and drawing
catalog checks; structural Phase2 ledger check; all15 Java core sources compile with
JDK17 `--release 8`. Existing source-bound native evidence is preserved rather than rerun.
The ledger still has1789 review-required candidates: it is a research backlog, not 1934
accepted components. Explicit design drafts and prior investigations remain tracked.

CP12 noise-band tracing remains deferred and unsupported. Java buildout may continue in
root's checkout; coordinate contract/evidence changes when rebasing ports. Recipes,
exporters, MCP/web, further guides/tools and remaining port/reproduction milestones remain
unfinished. Keep batches bounded and report capabilities/scenarios rather than expanded
assertion counts.

## Source build follow-up

The Java bundle can now be assembled without prior local archives using
[the source-build instructions](building-java-from-source.md). It still requires explicit
external JDK and font/license inputs. A spring atomicity proof formerly stored in ignored
scratch was preserved verbatim in tracked evidence and its attestation reference updated;
this changes no operation semantics or target support.
