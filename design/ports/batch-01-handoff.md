# Port batch 01 — handoff to root

Deferred I2 port batch: `sampling.ordered-circle-filter-2d` and
`sampling.seeded-circle-placement-2d` (both v0.1.0) ported to p5.js, py5 and
Processing for Android, plus the complete PlacementMarks artist workflow on all
three targets. Java reference implementation and accepted Java evidence are
unchanged.

## Binding

- Baseline: `467eafd2d1fc9ea4492698f5763091a775eddbb1` (origin/main tip at
  porting start; named Java0.15 baseline `e5a604ac` is an ancestor).
- Branch: `porting/batch-01` (separate checkout at
  `/home/colin/dev/procedural/.work/porting/checkout`; the main checkout was not
  switched, edited, reset or cleaned).
- Implementation commits (oldest first):
  - `99110da5` JavaScript core export (filter + placement)
  - `688670b8` p5 browser acceptance harness + evidence
  - `e04c165e` Python core + py5 PlacementMarks workflow
  - `a8681d8a` Android example + native acceptance evidence
  - `0e678dcf` checked conformance reports + proposed attestations
  - final docs commit (checkpoint finalization + this handoff) = branch HEAD at
    push; list with `git log --oneline porting/batch-01`
- origin/main advanced to `bf70f72c` during the batch (contact sheets + recipe
  design drafts only); no porting input changed, evidence carries forward.

## Contract versions and source hashes

- `catalog/operations/ordered-circle-filter.json` v0.1.0
  `d4e93aa0dc219b0730af1e3eecad5cb9a8be3030e9f0761b9b23d0886f6c2083`
- `catalog/operations/seeded-circle-placement.json` v0.1.0
  `04de90b19cbd39a5aa4840dfd1ee80cbeb96b69b9981af95b176be7bc0480267`
- `fixtures/operations/ordered-circle-filter.json`
  `b5fb3743676b6a268b3cfa8467e727a2e713482feff2fa44ac08c71d976f103b`
- `fixtures/operations/seeded-circle-placement.json`
  `c625d372435be9ae25e721407458ba4c189cfae48c09e4cd530ebfa6e8240699`
- Implementation hashes for every file: see the table in
  `design/ports/batch-01-attestation-proposal.md`.

## Exact commands and results

All runs in the porting checkout unless noted. Native runs under the shared
machine lease: `python3 /home/colin/dev/procedural/tools/with_native_render_lock.py -- <cmd>`.

### JS core

```
node tests/native/circle-placements-javascript.mjs
```
First attempt in this checkout: `status: passed`, 37 ordered cases (3
native-only), 31 seeded cases (4 native-only), 5 seed vectors, 5 mapping
vectors, 3 cross-case checks, host ownership/access passed. Report:
`evidence/conformance/circle-placement-javascript.json`
(`643ce9b3ac057f45e67180a6a80a87fdb13bac6edaedd2c9a85ffcffe9438cec`).
Runtime: Node.js v22.22.1.

### p5 native + technique

```
python3 /home/colin/dev/procedural/tools/with_native_render_lock.py -- \
  node tools/run_p5_placement_marks.mjs
```
`status: passed`. Frozen 22-step sequence from
`design/capabilities/placement-marks-p5-acceptance.md`: 21 rendered states,
10 declared images (baseline, diamonds, spacing, size-min, size-max,
count-extended, seed, radial, radial-spacing, palette), restoration frames
hash-equal, retained motif/palette edits, budget extension 517 retaining the
accepted prefix of 5000, ignored edits while radial, authored radial transfer
111 of 160 (matches accepted Java count; host trigonometry recorded, not
asserted), cached Save PNG decode equal to the displayed canvas,
keyboard-triggered palette edit, 300ms quiet observation. Evidence:
`evidence/conformance/p5js-placement-marks.json`
(`70284ed473e74409a3d115f4ffefd31ec92e0ae2af117279f2a75bb6bb8e4818`).
Runtime: Chromium 153.0.8010.12 (Playwright 1.63.0), p5 2.3.2, 640x640.

### Python core

```
python3 tests/native/circle-placements-python.py
```
`status: passed`: 37 ordered + 31 seeded cases, 36 native invariants,
host ownership/access, exact xoshiro128** state/unit vectors, detached-view
mutation, hostile-list output rejection. Report:
`evidence/conformance/circle-placement-python.json`
(`2165668bdec4f64973765869e1b4b33382988490e64b8e6141925bde5a49e174`).
Runtime: CPython 3.14.4.

### py5 native + technique

```
python3 /home/colin/dev/procedural/tools/with_native_render_lock.py -- \
  python3 tests/native/py5_placement_marks.py
```
`status: passed`, `native.passed: true`: 17 registered compositions matching
the Java sequence (424 baseline, diamonds/rings/palette/spacing-restored at
424, spacing 353, size-min 239, size-max 613, count-extended 517 with prefix,
seed 432, radial 111 of 160, radial-spacing 95, radial-spacing-restored 111),
retained style edits, rebuild replacement on geometry edits, ignored edits
while radial, cached save decode equal to the displayed canvas, 300ms quiet.
Evidence: `evidence/conformance/py5-placement-marks.json`
(`c100f0aa2d4b71ac9b4ae41072238d52174b1be1b156574b31edbe0290d7b008`).
Runtime: py5 0.10.11a0 on CPython 3.14.4, PyGDI offscreen, 640x640.

### Android core + native + technique

```
python3 /home/colin/dev/procedural/tools/with_native_render_lock.py -- \
  bash .work/run-placement-android-session.sh
```
Session script: host preflight (javac core + vector checks, gradle build of
the probe APK), install on the pinned API33 AVD (`emulator-5580`), 17-frame
sequence, save pull, verification, cleanup. Attempt 3 passed; attempts 1-2
preserved with their failure reports (version-bump check on ignored taps;
plan renderer recorded as the declared family instead of the actual
`AndroidSurface` runtime class — fixed to the value the accepted cp2 evidence
records). Evidence: `evidence/reproductions/placement-marks-android/`
(plan `88c1244c873279bb8e12a709ee96d6d95d7b3c8e451a981da0d659d0f3482539`,
result `b46910af5b00f170061e123e3dd476dcf67713ecd281ca23003da7c49e2b7180`).
`status: passed`: 17 compositions with Java-matching counts, retained
identity on motif/palette edits, exact accepted prefix on budget extension,
four ignored taps while radial with no frame within 1.5s, restoration frames
pixel-identical, saved bytes equal to the displayed frame 17 and published to
MediaStore, 300ms quiet observation, renderer
`org.procedurals.android.internal.AndroidSurface`, API 33, 640x640 density 1.

## Status per target and dimension

| Target | core | native | technique |
|---|---|---|---|
| processing-java (existing, unchanged) | conformant | validated-scoped | validated-scoped |
| p5js | conformant (Node v22.22.1) | validated-scoped (Chromium 153) | validated-scoped |
| py5 | conformant (CPython 3.14.4) | validated-scoped (py5 0.10.11a0) | validated-scoped |
| processing-android | conformant (shared Java core, host JVM, stated) | validated-scoped (API33 emulator, Android2D) | validated-scoped |

All non-Java rows are **proposed, not accepted**: see
`design/ports/batch-01-attestation-proposal.md` for the exact rows, evidence
bindings and predicates (every predicate pre-verified against the recorded
JSON). No attestation file was modified; root creates the batch acceptance
record, fills the `acceptance_review` placeholders, applies the rows and
regenerates the reference through the catalog checker.

## Runnable examples

- p5: `packages/javascript/examples/placement-marks/` — serve that directory
  together with `packages/javascript/src/` and pinned p5 2.3.2, mapping the p5
  script to `/p5.js`, then open `index.html`; visible buttons plus keys
  R/N/X/G/I/O/M/C/S. Full acceptance run (under the shared lease):
  `node tools/run_p5_placement_marks.mjs --render`.
- py5: `packages/python/examples/placement_marks/sketch.py` —
  `PYTHONPATH=packages/python python
  packages/python/examples/placement_marks/sketch.py` from a repository checkout
  with Python 3, Java 17 and py5 available; same control set (button + key
  callbacks).
- Android: `packages/java-android/examples/PlacementMarks/` —
  `uv run python tools/build_android_placement_marks.py` stages an isolated
  project (no emulator, no render); add `--build` to compile the staged debug
  APK (the tool never installs or launches). Same control set as buttons; Save
  PNG publishes to MediaStore.
- `evidence/conformance/p5js-placement-marks.json`
- `evidence/conformance/py5-placement-marks.json`
- `evidence/reproductions/placement-marks-android/{plan,result}.json`
- Rendered images are not checked in (per repo policy); representative frames
  were inspected during acceptance:
  - p5: ring baseline, diamonds motif, radial with visible concentric bands,
    palette shift, size extremes, count-extended.
  - py5: same set, visually consistent with p5 modulo rasterizer AA.
  - Android: baseline (ring), diamonds (4-vertex outlines at retained
    positions), radial (band structure objectively verified: annulus profiles
    at distances 48/96/144/192/240 from the authored origin match the JVM dump
    of the same `PlacementComposition`, bands 11/15/21/32/32, corners empty),
    size extremes, saved MediaStore PNG.

## Limitations and documented platform differences

- No cross-host pixel-identity claims anywhere; rasterizers differ (canvas 2D,
  PyGDI, Android2D) and radial trigonometry is host-composed on non-Java
  targets (recorded, not asserted, outside exact core semantics).
- Android2D has no closed stroked outline command: motif outlines are
  round-capped `segment2` sequences (accepted PathMarks polyline convention),
  documented in the Android README.
- Android save round-trips through MediaStore (bytes verified equal to the
  displayed frame before the pull); py5 save is a decoded-canvas comparison;
  p5 save is a canvas-ImageBitmap decode comparison.
- Scoped example acceptance only; not full-corpus certification.

## Proposed shared metadata changes

- `catalog/validation/ordered-circle-filter.json`: replace the three
  `unvalidated` target blocks (p5js, py5, processing-android) with the rows in
  `design/ports/batch-01-attestation-proposal.md`.
- `catalog/validation/seeded-circle-placement.json`: same, with the
  seeded-side fixture bindings and predicates.
- New accepted review record (e.g. `evidence/distribution/port-batch-01-review.json`)
  to fill the `acceptance_review` placeholders, mirroring `cp3-review.json`.
- Generated reference regeneration + unit tests after applying.
- No changes to `catalog/operations/*`, `fixtures/*`, Java sources, or the
  main `PROJECT_STATE.md` (root owns that update).

## Next bounded batch (queue)

After root acceptance of this batch, in dependency order:
1. `triangle-coordinate-map` — pure geometry, no RNG; small core + fixtures
   port for the three targets (no workflow yet; no accepted example consumes
   it alone).
2. `seeded-quadrant-partition` — RNG consumption order matters (xoshiro
   vectors exist in fixtures); core-first, then look for an accepted Java
   workflow to complete.
3. `seeded-triangle-points` + `seeded-endpoint-branches` — paired
   construction; core ports together.
4. `radial-profile-surface` — rendering-leaning; needs a workflow target
   chosen first.
5. `delaunay-2d` — algorithm port (Bowyer-Watson) with its own numeric
   contract review; largest remaining core.
6. `target-springs-2d`, `occupied-lattice-paths-2d` — iterative/sequential
   semantics; check convergence predicates before porting.
7. `seeded-line-pool-2d` — held for the explicit binary64 elementary-math
   dependency decision (see `design/operations/line-pool-numeric-decision.md`);
   JS `Math` and Python `math` are not assumed equivalent to
   StrictMath/fdlibm semantics. Do not port before that decision.

Stopping conditions per slice: contract ambiguity or Java defect -> minimal
reproducer to root; missing runtime -> affected dimension unvalidated, not
mocked; every native claim under the shared lease on the real target.
