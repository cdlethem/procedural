# Porting backlog review — p5.js / py5 / Android port batch

Porting-agent review handoff for the deferred porting batch, prepared against the
pinned baseline for root (main-thread architect) integration review. This is a
**port-side** record: it documents what was ported, the evidence produced, and the
proposed shared-metadata changes. It is **not** a root acceptance record and does not
update `catalog/validation/*.json` (those are prepared separately for integration).

- Repository: `/home/colin/dev/procedural`
- Porting checkout: `.work/porting/checkout`
- Branch: `porting/backlog`
- Pinned baseline: `76c21f6e` ("Investigate three-coordinate fields for depth edits
  and volumetric reuse", Java 0.20). The branch fast-forwarded from `5197dc6e` through
  `34fc902a` to `76c21f6e` with 0 unique porting commits before this session's work.
- Every native run used the shared machine render lease:
  `python3 /home/colin/dev/procedural/tools/with_native_render_lock.py -- <cmd>`

## Commit inventory on `porting/backlog` (newest first)

| SHA      | Batch                                   | Kind          |
|----------|-----------------------------------------|---------------|
| `fddb4e8b` | CutBranchMarks workflow (p5.js + py5) | workflow port |
| `de2ab3e0` | BandMarks workflow (p5.js + py5)      | workflow port |
| `fdb5f4f5` | WarpMarks workflow (p5.js + py5)      | workflow port |
| `b8edac46` | RampMarks workflow (p5.js + py5)      | workflow port |
| `a2fae309` | LoopMarks workflow (p5.js + py5)      | workflow port |
| `01043520` | topology.seeded-line-pool-2d core     | core port     |
| `3394ecb6` | path.occupied-lattice-paths-2d core   | core port     |
| `87378857` | motion.target-springs-2d core         | core port     |
| `15a12554` | path.noise-band-trace-2d core         | core port     |
| `828cdb85` | raster.bilinear-remap-2d core         | core port     |
| `b31ff324` | color.stop-ramp core                  | core port     |
| `1af69adc` | geometry.closed-spline-2d core        | core port     |
| `4b3f6921` | topology.delaunay-2d core             | core port     |

Plus the radial-profile-surface-3d Android P3D resume fix committed earlier this session
(draft was on main; fix + bounded native evidence committed here).

## Core ports (8 operations, JS + Python, host conformance)

All 8 close the Java-only core backlog. Each has: a JS core
(`packages/javascript/src/<name>.js`), a Python core
(`packages/python/procedurals/<name>.py`), fixture-driven native runners
(`tests/native/<name>-{javascript,python}.{mjs,py}`) passing the shared
`fixtures/operations/<name>.json` cases, and Android dex-on-ART core evidence run live
under the shared lease (host/ART checksums matched desktop preflight for every op).

| Operation (catalog id)            | Core SHA   | JS+Py fixture cases | Elementary-math note |
|-----------------------------------|------------|---------------------|----------------------|
| `topology.delaunay-2d`            | `4b3f6921` | 36/36 + 4 cross     | None (fixed a JS `edgeKey` BigInt precision defect) |
| `geometry.closed-spline-2d`       | `1af69adc` | 14/14 + 5 query     | fdlibm5.3 `hypot`, ported bit-exact from OpenJDK17 `FdLibm` |
| `color.stop-ramp`                 | `b31ff324` | 12/12 + 5 query     | None (plain binary64) |
| `raster.bilinear-remap-2d`        | `828cdb85` | 13/13               | None (fixed a BigInt product-bound hazard + a Python `array('L')`→`array('I')` bug) |
| `path.noise-band-trace-2d`        | `15a12554` | 18/18 (incl. 12-attempt walk) | fdlibm5.3 `sin`/`cos`, ported bit-exact from netlib fdlibm 5.3 |
| `motion.target-springs-2d`        | `87378857` | 44/44               | None (pure binary64); exposed the pure `{state,targets}→next` transition as the entry point (deliberate, documented divergence from Java's mutable factory) |
| `path.occupied-lattice-paths-2d`  | `3394ecb6` | 14/14               | None (fixed a JS Set-key precision defect + an all-or-nothing `cellInto` write in both languages) |
| `topology.seeded-line-pool-2d`    | `01043520` | 14/14               | fdlibm5.3 `atan`/`atan2`, ported bit-exact from netlib fdlibm 5.3 (0/200000 + 0/50000 mismatches) |

Shared numeric infrastructure produced: `packages/{javascript,python}/.../fdlibm-trig`
modules (sin/cos/atan/atan2, line-for-line from netlib fdlibm 5.3), reusable by any
operation with the same exact-elementary-math requirement. The xoshiro128**1.1 RNG is
reused verbatim from the quadrant-partition port (not re-derived).

Real bugs found and fixed during core porting (each changed observable behavior toward
the Java reference):
- delaunay JS `edgeKey` precision (Number inexact > ~2^21 vertices) → BigInt.
- closed-spline: a hardcoded `INVALID_INPUT` in a `passiveRecord()` helper that needed
  `INVALID_QUERY`; `wrap()` overflow miscoded as `INVALID_QUERY` instead of
  `NUMERIC_OVERFLOW`.
- bilinear-remap: BigInt product-bound hazard (dims up to 2^31-1); Python `array('L')`
  is 8 bytes on this platform → `array('I')`.
- occupied-lattice: JS Set numeric-key precision; `cellInto` skipped the atomic
  two-writable-slots check in both languages.
- seeded-line-pool: Python `_access_index` floated huge ints before bounding → uncaught
  `OverflowError` instead of `INVALID_INDEX`.

## Workflow ports (5 examples, p5.js + py5, native-verified)

Each workflow port adds an artist-facing example to both the p5.js and py5 targets over
an already-ported core. Structure (established by the Path marks precedent and confirmed
by Loop marks): a JS core module + p5 Canvas2D `sketch.js` + `index.html` + `README.md`;
a Python core module + py5 `sketch.py`; `tests/native/<name>-model.mjs` (pure model
checks against the shared `drawing.fresh-raster-2d` contract) and
`tests/native/py5_<name>.py` (real py5/JAVA2D observer, not a mock). All are scoped
conformance ports: **no renderer/pixel reproduction claim** (that is a separate
full-corpus claim), and no Android workflow activity yet (queued separately).

All five underlying operations are root-accepted in Java
(`catalog/validation/<op>.json` → `targets.processing-java.technique.status =
"validated-scoped"`) before their port was started.

### 1. LoopMarks — `a2fae309` (geometry.closed-spline-2d)
- Reproduced the Java source's `java.util.Random(42) nextInt` sequence exactly (local
  per-file LCG, not the library xoshiro stream); verified bit-exact between JS and Python.
- Outline+tile view uses the shared `drawing.fresh-raster-2d` vocabulary (segment2 +
  quad2, reusing `P5Frame`/`Py5Frame`); the fan view is outside that vocabulary (no
  triangle primitive) and draws directly on the main canvas (Profile-marks precedent).
- Verified: headless-Chromium browser run (all keys, SHA-256 reset identity) + real
  py5/JAVA2D `tests/native/py5_loop_marks.py`, both first-run passing under lease.

### 2. RampMarks — `b8edac46` (color.stop-ramp)
- Stop-ramp gradient composition over the ported `color.stop-ramp` core.
- Verified: browser (all edit keys, reset identity) + real py5 observer, first-run
  passing under lease.

### 3. WarpMarks — `fdb5f4f5` (raster.bilinear-remap-2d)
- Bilinear raster remap composition over the ported `raster.bilinear-remap-2d` core.
- Verified: browser (all edit keys, reset identity) + real py5 observer, first-run
  passing under lease.

### 4. BandMarks — `de2ab3e0` (path.noise-band-trace-2d)
- Noise-band path composition over the ported `path.noise-band-trace-2d` core (reuses
  the `gradient-noise-2d-01` field + the fdlibm-trig module).
- Verified: browser (all edit keys, reset identity, save) + real py5 observer
  (`tests/native/py5_band_marks.py`), first-run passing under lease; py5 saved PNG
  byte-verified against the displayed canvas.

### 5. CutBranchMarks — `fddb4e8b` (topology.seeded-line-pool-2d)
- Motivated by `2019/generativos/brotes` (independently drawn; see
  `catalog/validation/seeded-line-pool-2d.json`,
  `targets.processing-java.technique`). The example is only an editable seed-stroke
  policy; **all** mutable cutting is performed by the public `seeded-line-pool-2d`
  operation. Retains one attempt-bounded branching line pool, drawn as capped segments.
- Files + committed hashes (short sha256):
  - `97a4e8fceb259c59` `packages/javascript/examples/cut-branch-marks/cut-branch-marks.js`
  - `6d94d11aa0b978bb` `packages/javascript/examples/cut-branch-marks/sketch.js`
  - `c32f4f92ca270200` `packages/python/examples/cut_branch_marks/cut_branch_marks.py`
  - `c20cd9583e6cfb84` `packages/python/examples/cut_branch_marks/sketch.py`
  - `6e60b1de2684d4a0` `tests/native/cut-branch-marks-model.mjs`
  - `c052180a7a3e598b` `tests/native/py5_cut_branch_marks.py`
  - `b79f06fee15106b0` `tools/serve_cut_branch_marks.mjs`
  - (overlays the ported cores `a24604d0e17316d7` `packages/javascript/src/line-pool.js`,
    `25c76296429103f9` `packages/python/procedurals/line_pool.py`)
- Exact commands + results:
  - `node tests/native/cut-branch-marks-model.mjs --output .work/native/cut-branch-marks-model.json`
    → `status: passed`; pool size 12616 (seed 42 / wide / dense / base), 12616 commands,
    sparse work 4362; angle-scale edit changes traced geometry; colour cycle preserves
    geometry and changes rgb; all commands validate against
    `drawing.fresh-raster-2d`.
  - `python3 /home/colin/dev/procedural/tools/with_native_render_lock.py --timeout 100 -- xvfb-run -a .work/environments/py5/bin/python3 tests/native/py5_cut_branch_marks.py`
    → `passed: true`, py5 0.10.11a0; 6 checks (C colour-without-rebuild, W sparse
    rebuild, R reseed, reset byte-identical baseline, reset fresh pool, save matches
    displayed without redraw). Saved PNG sha256 `b33e584c0d6079f1…`.
  - Real headless-Chromium browser run (`tools/serve_cut_branch_marks.mjs`, pinned
    p5 2.3.2): all seven edit keys verified — C (4 distinct colours, cycles back to
    start), A (narrow, rebuilds, geometry changes), W (sparse 4,362), T (alternate
    15,650), R (seed 43, 4,239), 0 (byte-identical baseline restore), S (no redraw, no
    error). Seed 42 base/dense/wide retains **12,616 cuts across JS and Python**
    (cross-language pool-size agreement).
- Visual: the retained pool renders as a coherent branching "sprout" (matches the
  `brotes` motivation) on a near-black field; observed identically in the py5-saved PNG
  and the browser canvas.
- Limitations: scoped conformance only — no browser-native or cross-host pixel
  reproduction claim; no Android activity; the browser run is not committed as a
  permanent evidence artifact (only the model + py5 tests are).

## Status summary (core / native / technique, per target)

Current `catalog/validation/*.json` state for the 7 workflow operations (all identical
shape): `processing-java` core=`conformant`, native=`validated-scoped`,
technique=`validated-scoped` (root-accepted). `p5js`, `py5`, `processing-android` are all
`unvalidated` for every dimension. This batch produces the p5js/py5 evidence that root
can review to move those to accepted; no validation JSON has been modified by this
branch (per the handoff, shared attestations are prepared separately).

## Proposed shared-metadata changes (for integration review — NOT applied)

For each of the 5 workflow ports, root would update the corresponding
`catalog/validation/<op>.json` `p5js` and `py5` targets (core/native/technique) from
`unvalidated` to the reviewed status, citing the new example source + test hashes above
and the native evidence. Concretely the operations are:
- `geometry.closed-spline-2d` ← LoopMarks
- `color.stop-ramp` ← RampMarks
- `raster.bilinear-raster-remap` (op id `raster.bilinear-remap-2d`) ← WarpMarks
- `path.noise-band-path` (op id `path.noise-band-trace-2d`) ← BandMarks
- `topology.seeded-line-pool-2d` ← CutBranchMarks

Plus a `.gitignore` hygiene addition already committed on this branch:
`packages/python/examples/*/output/` (local py5 render scratch; the convention every
py5 example already uses, previously untracked — prevents accidental `git add -A` of
render PNGs).

## Remaining workflow ports (next bounded batch) — scope assessment

Three accepted Java example compositions remain, all over **already-ported** cores (no
new core work). Ordered by rising complexity:

1. **LatticeMarks** (`packages/java/examples/LatticeMarks`, 32-line composition) —
   single op `path.occupied-lattice-paths-2d`, static, thin composition (same shape as
   CutBranch). **Highest feasibility / lowest risk.** Edit keys per its
   `LatticeMarks.pde`.
2. **FacetMarks** (`packages/java/examples/FacetMarks`, 135-line `strictfp` composition)
   — combines 3 ops (`topology.delaunay-2d` + `sampling.triangle-points-2d` +
   `layout.quadrant-partition-2d`, all ported). Heavy: 50M triangulation work budget,
   20K grain limit, two site sources (disc / CP4 leaf centres). Static but render-heavy.
   `strictfp` → must preserve the exact binary64 recurrence.
3. **SpringMarks** (`packages/java/examples/SpringMarks`, 127-line `strictfp`
   composition) — **animated** (`motion.target-springs-2d` + `topology.delaunay-2d` +
   `layout.regular-grid`, all ported). 121-sample trail history buffer, explicit
   `step()`/`reset()`/`disturb()`/`response()`. The only animated workflow in the batch:
   needs a per-frame animation loop + trail rendering, a materially larger p5/py5 lift
   than the five static examples already delivered.

Stopping conditions / economics (per the 2026-09-08 sustainable-pace directive): this is
a clean logical stopping point. A complete, verified, committed, pushed slice
(CutBranchMarks) has been delivered; the remaining three are a well-defined next batch.
If resumed: do **LatticeMarks** first (cheap, de-risks the pattern), then **FacetMarks**
(static but heavy — budget for the 50M-work render under the lease), then **SpringMarks**
(animated — plan the animation loop explicitly). Each follows the now-standard
`<name>.js`/`<name>.py` + `sketch.js`/`sketch.py` + `tests/native/<name>-model.mjs` +
`tests/native/py5_<name>.py` structure. No Android 2D workflow activity is in scope for
these unless explicitly requested (separate, larger lift).

## Limitations (whole batch)

- Scoped conformance, not full-corpus reproduction certification.
- No Android workflow (activity) ports this batch — only Android **core** (dex-on-ART)
  evidence per operation, plus the radial-profile-surface-3d Android workflow fix.
- Browser runs are verification, not committed evidence artifacts.
- `tools/check_catalog.py` and `design/phase2/cluster-decisions.json` have drifted from
  `evidence/investigations/cp10-contract-review.json`'s recorded hashes at this baseline
  (pre-existing, not caused by this branch); noted for root.
