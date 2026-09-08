# Older Android starter restoration follow-up

BranchMarks exposed a pinned Android2D cache-restoration dependency on a surface-change
callback. Its runtime regression and accepted fix are recorded in
`evidence/conformance/branch-android-native-root-review.json`. The historical failing
attempt did not capture all runtime flags, so its exact cause remains unproven.

FieldMarks, PathMarks, PlacementMarks, RegionMarks and GrainMarks use the same pinned
noLoop restoration path and lack the resume hook. Apply only the same inner Probe.resume
method: call g.surfaceChanged when g exists. PApplet invokes this before restoreState and
resumeThread; Android2D only sets its existing changed flag. Do not resize, regenerate,
bypass cache restoration or change portable operations. Keep their differing cached
acknowledgment behavior initially; diagnose any actual failure separately.

Reuse each existing native workflow and its settings/counts/pixel/save assertions. Region
and Grain already have actual HOME/reorder handshakes; add that handshake before an
existing next edit in Field, Path and Placement. On the paused actual renderer clear
changed, invoke the real resume hook, require changed=true and clear it again. The actual
lifecycle must independently recover. Require missing_surface_callback_checked in final
results plus unchanged snapshot during resume and a successful subsequent edit/save.
This controlled regression would fail the earlier hook; it does not replace actual resume.

Root owns Field source/probe/runner, final integration and all device launches. Terra
branch_android_probe owns Region/Grain Activity/probe; Terra branch_python_package owns
Path/Placement Activity/probe/runner. No worker writes acceptance records. Compile in fresh
ignored stages, then serialize five native runs using the shared machine lock and existing
API33 environment. Each run has a bounded session; use180-second boot,210-second workflow
where supported and240-second cleanup deadline, with500-second shared lease. Field's
runner is updated to fresh output/serial arguments and local evidence instead of overwriting
its historical root record. Preserve every attempt and inspect representative output.

Acceptance requires current source/APK bindings, the original workflow checks plus the
restore regression, real pause/resume, next edit and cached MediaStore saving. Preserve old
records and artifacts as history; add reviewed successor evidence and refresh catalog
attestations only after each affected surface passes. Rebuild extracted local packages
before claiming their sources include the fix. Pure geometry fixtures and unaffected native
platforms do not need reruns. Missing/corrupt cache, other renderers and physical-device
coverage remain outside this focused claim. Stop and investigate any failure without
loosening existing visual/semantic checks.

## Field attempt 2: diagnostic observation only

Attempt 1 failed awaiting frame4 after the next palette tap; cached resume was acknowledged
once but root saw a black viewport. Preserve attempt1. Keep production unchanged for a
single diagnostic follow-up: observe real ACTION_UP dispatch, requested version/UI gates,
and pinned renderer flags at cached acknowledgment and after250/1000ms. These observations
do not invoke edits, change renderer flags, retry a tap, or relax original checks. Capture
diagnostics and available frame artifacts even on failure before executor cleanup.

## Field attempt 3: wait for the reordered window before the single tap

Attempt2 recorded no ACTION_UP and no requested-version advance after adb reported the
palette tap, while renderer flags showed restoration finished. Add a one-second transition
settle interval after the cached resume acknowledgment and before the existing focus check
and single physical tap. Production and all frame/pixel/save assertions remain unchanged.
Keep diagnostics. This tests delivery timing; it is not permission to retry a dropped tap
or to accept a black displayed canvas. Root must inspect the actual screen as well.

## Field attempt4: displayed viewport restoration

Capture device screenshots immediately before HOME and after resume/window settling,
before any edit. Probe reports actual viewport screen bounds. Require decoded RGBA equality
of that viewport, excluding system clock and status text. Preserve both screenshots and
fail immediately if different. This closes the gap between cached PNG identity and actual
SurfaceView display; production unchanged.

## Field attempt5: late surface presentation correction

Attempt4 confirmed a black replacement surface before any edit. Pinned SurfaceView
surfaceChanged invokes PApplet.surfaceChanged and setSize, but the former only marks
flags; after cached restoration has already stopped looping, it schedules no publication.
Field Probe now marks a presentation request and redraw on real surfaceChanged when a
composition exists. Its synchronized special-frame handler first honors Processing restore;
a current retained composition then gets a begin/end presentation frame on the animation
thread, without user draw/post/composition-count changes. Stale compositions fall through
to ordinary drawing. Callback and presentation share the sketch monitor, so an edit's
synchronized redraw cannot be cleared concurrently. No copying or regeneration is added.
Require attempt4's actual viewport equality plus all original workflow checks.

## Field attempt6: restore pixels from the acknowledged snapshot

Attempt5 published a uniform gray bitmap: scheduling presentation alone is insufficient.
Use the already retained acknowledged PNG as the source of truth, decoding one temporary
bitmap only for surface presentation and releasing it in finally. Draw it through PImage
on the animation thread with isolated style/matrix, then end the presentation frame.
This revises attempt5's no-copy preference based on observed loss of the primary bitmap;
no geometry, RNG, composition generation, saved bytes, or public operation changes.
All actual viewport equality and original workflow checks remain required.

## Shared presentation helper and propagation

Field6 passed exact displayed viewport equality and the complete original workflow. Root
extracted its decode/draw/recycle into internal AndroidSnapshotPresentation so the six
starters share bitmap cleanup and style/matrix isolation. Nested finally blocks now restore
style if matrix setup fails; Probe clears insideDraw even if decode fails. No new portable
operation or public drawing capability is introduced. Field7 validates this extraction.
Workers propagate scheduling and add actual screen comparisons to Region/Grain and
Path/Placement; root retains native execution and acceptance. Branch must also receive
this review because earlier saved-image checks did not prove immediate resumed display.

## Branch follow-up

Apply the same shared-helper presentation correction, preserving Branch's distinct cached
Activity acknowledgment and stale-edit retry. Test-only resumed probe now waits for a
private display-reviewed marker before its existing next control callback. Runner captures
actual viewport before HOME and after resumed/window settling, requires exact RGBA equality,
then writes the marker. Fifteen-second handshake bound; unchanged 18-state/count/save checks.
No new native support attestation until root review of this stronger workflow.

Branch native4 restored the tree, but the before screenshot retained a global launch fade
(lighter margins, tree colors and navigation bar). Preserve failed equality. Settle one
second before baseline capture as well as after resume; keep exact viewport comparison.

Path native3 passed actual viewport equality and native lifecycle/edit/save checks, but the
host retained the original CP2 renderer class-name assertion. Current AndroidSurface is the
previously reviewed internal PGraphicsAndroid2D subclass (android-native-review.json); root
read its source, which inherits drawing unchanged. Follow-up now binds that exact current
class name separately; historical plan unchanged. Run full host image checks before acceptance.
Root also repaired interim-status polling in Path/Placement runners: wait-loop timeout
only on exhaustion, ignore known lifecycle markers while awaiting final save, and keep
Placement radial ignored-edit checks sensitive to actual terminal records.
