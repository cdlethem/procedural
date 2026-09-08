# Android lifecycle v2 result decision

Root accepts the scoped result in `evidence/conformance/android-adapter-lifecycle-v2.json`.
The first revised run passed all 19 ordered markers on one main-instance nonce. It used
the internal Android2DFragment; no original frame drawing or ownership source changed.
The two prior plain-fragment attempts remain failed evidence and are not superseded
by a claim that their integration works.

The native journal records four actual pauses, three resumes, three real UI-thread
inputs, four ordinary pre/draw callbacks (one native startup plus three edits), and 26
restoration-only dispatches. Each resume included four observed idle dispatches with
unchanged frameCount/pre/draw and closed host admission. Each subsequent input added
exactly one ordinary frame; frameCount advanced from 2 at startup to 5 after the edits.
No assertion or cleanup diagnostic failed.

All five exact captured bitmaps ended recycled; native clearing occurred once apiece and
all canvas/pixel/native/parent references were detached. Both active frames remained
aborted and all three completed frames remained completed. The unconsumed stop-wins
lease rejected consumption, and the actual overlapping consumer observed admission
closure before its exact lifecycle rejection and final release. Actual UI finish
produced the fourth pause, onDestroy and dispose with empty final ownership maps.

This establishes the registered idle-redraw and lifecycle integration on the pinned
Android2D fragment route. It does not establish lossless in-flight input queuing,
configuration/process recreation, other devices/versions/renderers, or complete target
support. CP1 and the editable example remain required. The passing native suite must
not be repeated for metadata; later code changes require an explicit source-delta review.

The standalone adapter compilation checker now includes the six resolved AndroidX
binary dependencies required by the new fragment superclass. It hashes original artifacts
and extracted class jars, uses stable module coordinates rather than transform cache
paths, and passes `javac --release 8`. This is compilation evidence, separate from the
actual lifecycle result.
