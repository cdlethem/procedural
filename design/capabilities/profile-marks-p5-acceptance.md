# ProfileMarks p5 WEBGL acceptance draft

This is a prepared browser workflow, not native acceptance or a JavaScript support claim. It consumes the reviewed CP7 retained mesh without changing core behavior.

The adapter requires p5 WEBGL triangle submission, supplied per-face normals, depth testing, a 640×640 density-one canvas, and an acknowledged canvas data URL that can be downloaded without a new geometry build. It maps the Java example’s x positions into p5’s centred WEBGL coordinates (`x - 320`), keeps local Z geometry intact, and explicitly uses a camera at `(0,0,800)` looking at the origin with `up=(0,1,0)`, orthographic bounds `[-320,320]`, ambient plus directional light, and the Java rotations `X=1`, `Y=.35`.

The registered sequence is the ten states in `profile-marks-port-boundary.md`: baseline cylinder, waist, pointed, 8-slice pointed, 8-slice cylinder, start-open cylinder, both-open cylinder, palette, trio and reset. It checks the stated drawn-face counts 1088, 1088, 1024, 256, 272, 264, 256, 256, 760 and 1088. P/C/X retain a composition; D/B/T/0 rebuild it. The pointed end flag stays topology-equivalent when changed during a rebuild. Save is checked at trio and reset: each download must equal its acknowledged canvas, with unchanged revision and retained geometry after a short quiet interval. Actual canvas screenshots are captured for root visual review.

Run only after root source/plan review through the common native-render lease:

`python3 tools/with_native_render_lock.py -- node tools/run_p5_profile_marks.mjs --output .work/native/profile-marks-p5`

Root reviews the browser image and runtime report before any support, reproduction or package claim.
