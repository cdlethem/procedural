# Deferred port integration — Java buildout resumes

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

Latest accepted Java baseline: `4d61438862d4f93fa617f228ac44424e64db26e7`
(Java0.18, 18 operations and 18 workflows). The earlier `88ac268d` records the scheduling-change checkpoint.
RasterRemap2D/WarpMarks and StopRamp/RampMarks are accepted Java additions awaiting ports.
CP15 adds NoiseBandPath2D/BandMarks; use its explicit distribution review and a pushed
revision containing accepted implementation, not the earlier prototype-only checkpoint.

Keep deferred work in this order: finish Android ProfileMarks lifecycle validation and
root integration; then port accepted Delaunay, target-spring, occupied-lattice, line-pool,
raster, positioned-ramp and noise-band capabilities in bounded batches. NoiseBandPath2D,
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
