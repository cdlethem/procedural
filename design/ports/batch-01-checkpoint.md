# Porting batch 01 checkpoint

Porting agent checkpoint for the deferred I2 port batch. Root owns main, shared
contracts, fixtures, accepted evidence, and final support acceptance. This branch
submits target-specific work and proposed shared metadata for integration review.

## Baseline

- Baseline SHA: `467eafd2d1fc9ea4492698f5763091a775eddbb1` (origin/main tip at porting
  start; the named Java0.15 baseline `e5a604ac` is its ancestor).
- Branch: `porting/batch-01` in a separate checkout at
  `/home/colin/dev/procedural/.work/porting/checkout`, origin
  `https://github.com/cdlethem/procedural.git`.
- The main checkout was not switched, edited, reset, or cleaned. A normal Git
  checkout of the baseline is the implementation input; nothing was substituted from
  the live working tree.
- Reconciliation of `e5a604ac..467eafd2`: no changes to `catalog/operations/*`,
  `fixtures/*`, Java core sources, or the JavaScript draft files. Changed: packaging
  manifest `packages/java/source-bundle.json`, attestation
  `catalog/validation/target-springs-2d.json`, source-bundle builder/tests,
  `tools/with_native_render_lock.py` SIGTERM hardening, contact-sheet helper, docs.
  Porting inputs are byte-stable across the baseline.

## Inventory verification (against docs/porting-handoff.md)

- 15 operation contracts in `catalog/operations/`; 15 validation attestations in
  `catalog/validation/`. Batch-01 pair: `sampling.ordered-circle-filter-2d@0.1.0`,
  `sampling.seeded-circle-placement-2d@0.1.0`; Java core conformant on both via
  `evidence/conformance/circle-placement-java.json` (68 fixture cases).
- Fixtures: `fixtures/operations/ordered-circle-filter.json` (37 cases + 3 native-only)
  and `fixtures/operations/seeded-circle-placement.json` (31 cases + 4 native-only,
  5 seed vectors, 5 mapping vectors, 3 cross-case checks).
- JS drafts present as handed: `packages/javascript/src/circle-placements.js`,
  `tests/native/circle-placements-javascript.mjs`,
  `packages/javascript/examples/placement-marks/` (4 files). No index export yet.
- Accepted Java workflow present: `packages/java/examples/PlacementMarks/PlacementComposition.java`
  + `packages/java-processing/examples/PlacementMarks/PlacementMarks.pde`;
  accepted native evidence `evidence/reproductions/cp3-java2d/pde-result.json`
  (counts 424/353/239/613/517/432/111).
- Frozen p5 acceptance: `design/capabilities/placement-marks-p5-acceptance.md`.
- Python conventions: `packages/python/procedurals/` (layout.py, colors.py, paths.py,
  fields.py, `_drawing*.py`, `_py5_frame.py`). Android: `packages/java-android/`
  (Android2D* adapter + FieldMarks/PathMarks activities).

## Shared machine resources (explicit reuse, read-only)

- Render lease: `python3 /home/colin/dev/procedural/tools/with_native_render_lock.py -- <cmd>`
  (fixed lock `/home/colin/dev/procedural/.work/native-render-machine.lock`).
- p5 runtime: `/home/colin/dev/procedural/.work/environments/p5js` (p5 2.3.2,
  Playwright 1.63.0). Chromium: `/home/colin/dev/procedural/.work/toolchains/playwright`
  (Chromium 153). JDK17: `/home/colin/dev/procedural/.work/toolchains/jdk-17.0.20.1+1`.
  Android SDK/AVD: `/home/colin/dev/procedural/.work/toolchains/android` +
  `/home/colin/dev/procedural/.work/environments/android/avd`.
  Processing 4.5.6: `/home/colin/dev/procedural/.work/toolchains/processing-4.5.6`.
- These are ignored machine-local resources; the fresh checkout is not
  self-contained, per the handoff.

## Batch 01 plan (dependency order)

1. JS core: run final fixture runner in this checkout; review draft
   semantics/ownership against both frozen contracts; add index export; commit.
2. p5 native: `tests/native/placement-marks-browser.mjs` +
   `tools/run_p5_placement_marks.mjs` adapted from the accepted PathMarks harness;
   run the frozen 22-step sequence under the machine render lease; 10 declared
   images + restoration hashes + Save/quiet; commit example + evidence.
3. Python slice: `packages/python/procedurals/placements.py` (ordered_circle_filter_2d,
   seeded_circle_placement_2d) + `tests/native/circle-placements-python.py` consuming
   the same fixtures; then py5 PlacementMarks workflow run; commit.
4. Android slice: reuse `CirclePlacements2D` core in `packages/java-android` with
   fixtures run on the native runtime; PlacementMarks workflow on the emulator; commit.
5. Handoff: proposed `catalog/validation/` attestation changes (p5js/py5/
   processing-android rows) prepared separately for root review; batch handoff doc.

Stopping conditions: contract ambiguity or Java defect -> minimal reproducer +
proposed resolution to root, semantics unchanged; missing runtime/reference images ->
affected dimension recorded unvalidated, not mocked; every native claim runs the
actual target under the shared lease.

## Progress

- [x] Baseline checkout + branch pinned.
- [x] JS fixture runner passed in fresh checkout (37+31 cases, host ownership/access).
- [x] Draft semantics/ownership reviewed against both contracts (see handoff notes).
- [x] Index export + JS core commit (`99110da5`).
- [x] p5 native acceptance run (`688670b8`): 21 rendered states, 10 declared images,
      restoration hashes, cached Save PNG, keyboard edit, 300ms quiet.
- [x] Python core + fixtures + py5 workflow (`e04c165e`): 37+31 cases, 36 native
      invariants, 17-composition py5 sequence, save decode equality.
- [x] Android core + fixtures + workflow (`a8681d8a`): probe APK on pinned API33
      emulator, 17 compositions with Java-matching counts, ignored-edit window,
      radial band structure verified against a JVM dump, MediaStore save round-trip.
- [x] Checked conformance reports + proposed attestations (`0e678dcf`): every
      predicate pre-verified against recorded evidence; acceptance records pending
      root review per the proposal.
- [x] Batch handoff doc: `design/ports/batch-01-handoff.md`.

## Notes for the next batch

- origin/main advanced by exactly one commit to `bf70f72c` while this branch was
  active (draft recipe grammar + catalog execution bindings; only
  `PROJECT_STATE.md`, `design/recipes/*` and `tests/test_recipe_draft_schema.py`)
  — no porting inputs changed, evidence carries forward unchanged.
- Android attempt history: attempt1 failed a version-bump check on ignored taps;
  attempt2 recorded the plan renderer as the declared family instead of the actual
  `AndroidSurface` runtime class (fixed to match the accepted cp2 evidence value);
  attempt3 passed. Failed attempts preserved outside Git.
- The p5 acceptance document
  (`design/capabilities/placement-marks-p5-acceptance.md`) remains the frozen
  sequence authority for the p5 target; the py5 and Android slices follow the same
  composition sequence so counts are directly comparable.
