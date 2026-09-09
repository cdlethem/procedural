# B2: bounded frame-sequence export

Root-approved helper behavior; no new core operation or renderer claim. Extend existing
tools/render_java.py in place. Preserve no-option/default and --frame single-capture schema,
filenames and behavior so existing consumers continue to work.

Add --frames comma-separated ordinals, mutually exclusive with --frame. Require1..64
strictly increasing unique integer ordinals, each1..10000. Reject empty elements, ranges,
zero, duplicates, decreasing order and excess counts before runtime/output creation.
Retain sweep maximum16 variants; each variant is one fresh sketch/process which executes
all draws1..last requested ordinal in order. Capture only requested completed draws.
Continue after noLoop exactly as current helper. Never restart between captures, skip
intermediate draws or change simulation time. Wall-clock/replay claims remain excluded.
Existing shared lease/timeouts and32-million-pixel limit apply unchanged.

Sequence-mode native filenames frame-00001.png etc. Capture get()/save snapshot synchronously
at each requested ordinal (confirm Processing save lifecycle); final metadata may report
success only after all requested captures exist. Record actual draws, requested_frames,
frames=capture count, width,height,seed,hook. For top-level report, requested_frames lists
ordinals; each variant contains captures [{frame,image,image_sha256}] and native metadata.
No single image alias in sequence mode. Single-frame mode remains byte/schema compatible.
Generate one contact sheet of every captured image across variants, labels identify variant
and ordinal. Existing maximum64*16 means bounded1024 contact tiles; no GIF/video encoder.

Failure must leave report status failed and existing captured PNGs inspectable; do not
fabricate success metadata when the sketch exits early or times out. Report need not
promote unverified partial captures into accepted variant records. Assets remain per-variant
and verified before execution/after final capture; do not reset them between frames.

Validation: focused CLI/parser cases; native accumulating FrameSelection fixture captured
at1,3,5 in one run. Compare each to known cumulative pixels and final to existing single
--frame5 output. Assert actual draw count5, images exactly3, distinct ordered ordinals,
noLoop handled. Exercise source/assets unchanged behavior with existing tests. No broad
render matrix or generic event scripting. Existing no-assets and asset native tests still
apply to shared path; root runs final native tests after implementation handback.

Terra owns tools/render_java.py, tests/test_render_java.py and docs/rendering-java.md.
Root owns new native sequence test and final integration. Do not edit catalog, root evidence,
renderer profiles or other worker files. Freeze these sources before native runs.
