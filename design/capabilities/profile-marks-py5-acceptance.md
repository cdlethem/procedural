# ProfileMarks py5 P3D acceptance draft

This preregisters one locked 640×640 density-one py5 P3D callback run. It uses the retained CP7 mesh, supplied flat normals, package cyclic palette and cached `get_pixels()` image. The ten states are baseline, waist, pointed, coarse pointed, coarse cylinder, start-open, both-open, palette, trio and reset, with 1088,1088,1024,256,272,264,256,256,760,1088 submitted faces.

P/C/X retain the composition; D/B/T/0 rebuild it. Injected key callbacks are serialized with draw callbacks by a probe-only lock; the controller never renders. This tests actual callback behavior, not physical keyboard delivery. Draw completion is acknowledged before each next input, with a bounded timeout and a quiet interval for Processing endDraw bookkeeping. The callback probe checks each actual normal and vertex submission, settings, revision, retained identity and full geometry digest. It saves at trio and reset without a new draw, compares decoded saved pixels with the captured display and observes a quiet interval without an extra revision. Reset pixels equal baseline. All preceding edits change pixels except start-open: the rear cap is occluded in the fixed Java camera, so its removal preserves pixels while exact geometry and submitted face counts change. This corrects the original all-edits-visible assumption after attempt2 stopped at start-open; no numeric threshold is relaxed. Attempt1 exposed an incorrect get() spelling, corrected to py5 get_pixels(). Failed artifacts are preserved. The pointed mesh remains unchanged when its end cap is toggled. Root reviews baseline, both-open and trio images before acceptance. Source/runtime hashes must remain unchanged.

After review, run through the common lease with the pinned py5 environment used by `tests/native/py5_branch_marks.py`:

```sh
python3 tools/with_native_render_lock.py --timeout 240 -- env JAVA_HOME=/home/colin/dev/procedural/.work/toolchains/jdk-17.0.20.1+1 xvfb-run -a .work/environments/py5/bin/python tests/native/py5_profile_marks.py --output .work/native/profile-marks-py5-1
```
