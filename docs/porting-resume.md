# Deferred port integration — Java buildout resumes

## Current Java handoff: Java0.35.0

Pin a separate checkout and branch to pushed commit
`d7f95a06f55fd0937ebb2c12bb2192c7644922c4`.
This baseline contains 31 accepted Java operations and 37 workflows, reviewed in
`evidence/distribution/contact-java-review.json`. The exact operation/target inventory
is in `catalog/validation/`; Java acceptance never implies port acceptance.
The source archive SHA is
`7dcc30541cd6deaee2b27056555b3039d4ae58c88d495df0ca3d8d61472c3724`.

Since the previous CP29 handoff:

- PathClipMarks composes retained field paths with the existing polygon segment clipper.
- MaskedPartitionMarks uses immutable region masks with replaceable local, canvas-space
  and image content. This is adapter/workflow expansion, not another core operation.
- `geometry.nearest-segment-contact-2d` adds exact first-contact selection and retained
  obstacle identity; ContactMarks demonstrates editable obstacle geometry. Its 26 shared
  fixtures cover closed contacts, overlap, exact ordering and representation collapse.
- `SegmentClip2D` now shares a package-private exact arithmetic helper with the contact
  operation. Preserve the reviewed arithmetic semantics; the helper is not a public API.

Pending: prior deferred ports, Android ProfileMarks integration, polygon clipping and
nearest-contact ports, and the masked-region adapter/workflows. Review representative
native results on each claimed platform. Port work remains paused during this Java
sprint; this handoff does not schedule a restart. Root alone accepts shared support
records. Coordinate all native renders with the machine-wide shared lock through
`tools/with_native_render_lock.py`, including renders from separate checkouts.

Maintainer direction: pause port integration and develop new Java functionality. This
supersedes the current ports-first sequence. Preserve frozen contracts and accepted target
work; new Java capability admission still requires root architecture review and focused
validation. No port or native-render task is currently running.

## Accepted checkpoints

Latest pushed baseline before this scheduling change: `88ac268d`.
Java0.15 has15 operations and15 workflows. Ten operations have accepted native evidence and
local packages on all four targets. Radial-profile surfaces additionally have accepted
JavaScript/Python cores, root exports, ProfileMarks native workflows and local0.7 packages.
Those scoped records do not establish Android or completed shared radial support.

## Java buildout additions to the deferred queue

Historical Java library baseline: `7d5c941f`
(Java0.20, 20 operations and 20 workflows), reviewed in
`evidence/distribution/cp17-java-review.json`. Earlier Java0.19 baseline:
`5197dc6e2d4754699bbafb2cd1e5418a75ab9f08`. Repository tooling checkpoint `1dabca75`
adds seeded JAVA2D rendering and sweeps without changing the accepted library archive.
The earlier `88ac268d` records the scheduling-change checkpoint.
RasterRemap2D/WarpMarks and StopRamp/RampMarks are accepted Java additions awaiting ports.
CP15 adds NoiseBandPath2D/BandMarks; use its explicit distribution review and a pushed
revision containing accepted implementation, not the earlier prototype-only checkpoint.

Keep deferred work in this order: finish Android ProfileMarks lifecycle validation and
root integration; then port accepted Delaunay, target-spring, occupied-lattice, line-pool,
raster, positioned-ramp, noise-band and closed-spline capabilities in bounded batches. NoiseBandPath2D,
like LinePool2D, requires exact elementary math for branch-sensitive decisions. Preserve
shared fixtures and contracts; workers must not author root acceptance records. No port
task is required to finish the current Java milestone.

## Android ProfileMarks draft

Unfinished implementation, manifest, README, builder, native probe and runner are retained
in their normal project paths and explicitly remain unaccepted. Successful probe compilation:
`.work/android-profile-probe3`. The second native run is
`.work/native/profile-marks-android2`; it reached nine states through trio and verified the
actual MediaStore PNG after a250ms quiet interval, then timed out after HOME/resume.
Root viewed the pre-pause viewport and confirmed visible cylinder/waist/pointed forms.

The first native attempt produced no frames. A local PFragment.canDraw correction now
allows noLoop redraw dispatch; it does not import the old 2D support claim into P3D.

Terra's subsequent pinned-source investigation suggests resume restoration waits for a
surface-changed flag that may not arrive when EGL is preserved. Candidate correction:
call `g.surfaceChanged()` from Sketch.resume() before restoration, then request redraw.
This has NOT been implemented or verified. On resumption, reread the pinned runtime paths:
PApplet.onResume/handleSpecialDraw, PGraphics.restoreState, PGraphicsOpenGL.restoreSurface
and PSurfaceGLES. Instrument changed/restoreCount/restoredSurface/looping/redraw only as
needed. Do not weaken viewport equality or skip resume to accept the port.

Next port integration steps:

1. Resolve P3D resume, compile fresh and rerun the bounded native sequence under the shared
   machine lock. Verify actual viewport equality before the next edit and saved pixels after it.
2. Root review complete source/bindings and representative baseline/open/trio/resumed results.
3. Validate Android radial core against shared fixtures on the claimed runtime, package the
   Android workflow and verify extracted-package build. A compiled APK alone is insufficient.
4. Add only justified radial target attestations and regenerate/check catalog consumers.
5. Port Delaunay, target springs, occupied lattice paths and mutable line-pool branching in
   bounded batches. Line-pool elementary-math behavior needs its established portable policy.

All machine-local builds, PNGs, logs and toolchains remain excluded from Git. Fresh checkouts
need the established environment preparation. Every native command uses the same machine
lease via `tools/with_native_render_lock.py`; never use a checkout-local replacement lock.

Recipes, exporters, MCP/web, further guides/helpers and recreation coverage remain in the
full roadmap. This scheduling change neither cancels them nor marks them complete.

CP16 adds ClosedSpline2D/LoopMarks to the Java queue after noise-band paths. Its per-chord
lookup, periodic seam/plateau choices, raw tangents and exact fdlibm hypot behavior must be
ported from the frozen contract and fixtures, not inferred from the source Spline helper.
Use a pushed revision with accepted Java0.19 distribution evidence when this batch resumes.

CP17 adds BinaryCellPartition2D/PanelMarks after closed splines. Preserve exact integer
bounds, survivor-then-child ordering, failed-attempt RNG consumption, RANDOM/LONGEST axis
semantics and all-interior cut mapping. Use the accepted Java0.20 distribution checkpoint
at `7d5c941f`; do not port the earlier private probe or claim Processing source replay.

CP18 adds GradientNoise3D01/DepthMarks after binary panels. Preserve safe-corner coordinates,
three-stage hash, unsigned modulo12 gradients and exact x/y/z interpolation. Its z=0 slice
is deliberately distinct from the2D field. Native mesh transfer requires target-specific
P3D-equivalent evidence; the Java source bundle review is evidence/distribution/cp18-java-review.json.

CP19 adds RadialPull2D/PullMarks after3D noise. Preserve fdlibm hypot/pow, original-query
ordered displacement summation, adding the query once, exact-center zero and atomic target
writes on overflow. Fold/self-intersection behavior is intentional. Use the Java0.22
distribution checkpoint identified by evidence/distribution/cp19-java-review.json; core-only
9e702ab1 is not the packaged baseline. Root retains port acceptance ownership.
