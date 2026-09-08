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

Ten operations now have reviewed core/native evidence and local packages on all four
targets: grid, palette, gradient noise, gradient paths, circle filtering, seeded circle
placement, quadrant partition, triangle coordinate mapping, seeded triangle points and
endpoint branching. Branch distribution integration was pushed at `41ba718121ab41a33c49621c5897d91e115998b7`.

The Android restoration successor covers FieldMarks, PathMarks, PlacementMarks,
RegionMarks, GrainMarks and BranchMarks. See
`evidence/conformance/android-snapshot-restoration-root-review.json` and
`evidence/distribution/android-restoration-review.json`, with build instructions in
[Android restoration patches](installing-android-restoration.md). It preserves historical
core versions and supplies adapter0.3.0; old package records describe historical artifacts.
Actual API33 resumed viewport equality is checked before the next edit. This does not
extend the claim to other renderers or physical devices.

Five operations remain to port: radial-profile surface, Delaunay topology, target springs,
occupied lattice paths and mutable line-pool branching. Radial-profile surface is next;
read its frozen contract and every auxiliary fixture section before implementation.

Root integrated the reviewed p5.js/py5 circle placement cores, public exports and
PlacementMarks workflows in `a7ea7ec5`. The exact source-bound native evidence and
root integration findings are in `design/port-batch-01-root-review.md`. Python's
integrated core conformance report is tracked; both native workflows have reviewed
representative images. Placement core/native target attestations are recorded for p5.js, py5 and Android API33.
Technique/recreation claims remain separate. Local JavaScript/Python distributions are
reviewed in `evidence/distribution/cp3-ports-review.json`; Android distribution is reviewed
in `evidence/distribution/cp3-android-review.json`. See the PlacementMarks installation guide.
Do not infer package release acceptance from source integration alone.

The older FieldMarks/PathMarks evidence remains historical. An exact root-reviewed
entrypoint compatibility record accounts for the added exports without changing old
render hashes: `evidence/conformance/placement-export-compatibility-review.json`.
Unrelated edits still invalidate the source checks.

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

## Placement core check on Android

Reuse the frozen Java vector generator and ownership/access checks. Preparation performs
only desktop preflight and dexing; use a fresh ignored output directory:

```sh
python3 tools/prepare_circle_placement_android_core.py \
  --java-home .work/toolchains/jdk-17.0.20.1+1 \
  --android-sdk .work/toolchains/android/sdk \
  --output .work/placement-art-prepared
```

With the existing API33 emulator booted, run under the shared lease (or inside a session
already holding it; do not acquire the same lease twice):

```sh
python3 tools/with_native_render_lock.py --timeout 300 -- \
  python3 tools/run_circle_placement_android_core.py \
  --prepared .work/placement-art-prepared \
  --android-sdk .work/toolchains/android/sdk \
  --serial emulator-5582 --adb-port 5038 \
  --output .work/placement-art-result
```

The runner verifies the preparation chain and remote dex, runs two pure ART mains and
removes only its temporary dex. It does not install an APK, draw, or start/stop the
emulator. The owner of the emulator session handles its lifecycle. The ownership probe
excludes desktop allocation/performance measurements; no Android performance claim follows.
