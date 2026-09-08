# ProfileMarks Android P3D acceptance draft

This is a preparation record, not Android support or native acceptance. The workflow-local
[ProfileMarksActivity](../../packages/java-android/examples/ProfileMarks/ProfileMarksActivity.java)
uses Processing Android Mode 4.12's native `PApplet`/`PFragment` route with a measured square P3D surface and explicitly scaled logical640 coordinates. It deliberately does not add a public Android renderer adapter.

The Activity publishes immutable control state from Android UI callbacks. The PApplet draw
thread rebuilds when slices or either cap changes or a new reset is requested, and otherwise submits retained
`RadialProfile3D` triangles with their supplied normals. Profile, cyclic palette, and trio
controls retain the composition. Each completed draw captures `get()` into encoded PNG bytes;
Save passes a copy of those acknowledged bytes to `GalleryWriter` and does not request a draw.
`resume()` asks the native surface to redraw the same retained composition, without generating
new settings.

`tools/build_android_profile_marks.py --stage .work/<fresh-name> --build` stages a fresh,
profile-only Android project, binds source/bootstrap/runtime and staged-project hashes before and after compilation,
and writes `build-result.json`. It compiles only; it never installs, starts an emulator, or
renders. The builder includes the Android Mode 4.12 `processing-core.zip`, profile Activity,
shared Java core, `ProfileComposition`, and existing byte-oriented `GalleryWriter`.

Native review must run the exact ten states in
[profile-marks-port-boundary.md](profile-marks-port-boundary.md): 1088, 1088, 1024, 256,
272, 264, 256, 256, 760, and 1088 faces. It must verify complete retained metadata, normal
then three-vertex submission per face, and composition identity: P/C/X retain it, while
D/B/T/0 rebuild it. It must collect actual baseline, open/faceted, trio, and reset images.
The trio and reset saves must decode to the previously acknowledged displayed PNG without a
revision or geometry advance.

P3D surface recovery still needs native evidence. Pause after a completed P3D frame, resume,
wait for a completed redraw of the retained composition, issue one ordinary next edit, wait
for that edit's completed frame, then save its cached image. The old Android2D
`surfaceChanged()` proof does not establish this P3D path. In particular, native review must
confirm that `get()` returns the displayed P3D content after resume rather than an empty or
stale framebuffer.


The probe drives actual buttons through performClick on the UI thread (no physical touch
claim). It checks all ten option states, complete retained mesh hashes, actual submissions,
ignored pointed cap, baseline/reset equality, and actual MediaStore bytes after a250ms
quiet interval. At trio it reports awaiting-pause; the host sends HOME/resume and checks
exact square viewport pixels before allowing reset/next-save via display-reviewed marker.
The observer publishes only after Processing endDraw through post(). Prior 2D restoration
records do not establish this result. No tolerance is widened for this native sequence.

Compile the probe without rendering:

```sh
python3 tools/build_android_profile_marks.py --stage .work/android-profile-probe1 \
  --application-id org.procedurals.profilemarksprobe \
  --activity-class org.procedurals.examples.profilemarks.ProfileMarksProbeActivity \
  --extra-source tests/native/android-profile-marks/ProfileMarksProbeActivity.java --build
```

Run on the existing API33 emulator5582/adb5038 under the shared machine lease:

```sh
python3 tools/with_native_render_lock.py --timeout 240 -- \
  python3 tools/run_android_profile_marks.py --stage .work/android-profile-probe1 \
  --output .work/native/profile-marks-android1
```

The emulator must be started with the existing project-owned toolchain/environment under
the same lease if not already running. Preserve every failed attempt and inspect baseline,
open/faceted, trio and before/after resumed viewport images before root acceptance.


Attempt1 reached the native probe deadline without a frame. Root inspected pinned
PFragment.canDraw(): it returns sketch.isLooping(), preventing noLoop redraw dispatch.
ProfileMarks now has a workflow-local ProfileFragment that delegates that decision to
PApplet.handleDraw, using the established dispatch correction without claiming the old
2D native evidence proves GLES behavior. Attempt1 remains preserved; acceptance checks
are unchanged for the next run.
