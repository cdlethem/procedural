# BranchMarks p5 native acceptance

Preregister one17-composition p5.js2.3.2/Chromium153 canvas2D run at640x640/density1.
Reuse the accepted GrainMarks harness and pinned runtime under the shared240-second lock;
runner deadline180 seconds. No core/model edits during execution. Preserve every attempt.

The accepted Java BranchMarks PDE is the draw-treatment reference; model parity covers
actual Java geometry/ancestry and case-specific trig bounds. This run exercises the actual
p5 UI, native lines and4px terminal dots, not a source-sketch recreation or Java pixel diff.
Motivation and numeric exclusions: branch-marks-port-boundary.md.

Use the same17-state sequence as the Java workflow. Expectations below were computed from
the reviewed retained model before rendering, not adjusted from raster observations.
N adds/removes rules; G narrows; W widens; B changes slots; R changes seed; X transfers roots;
M toggles taper/tips; C changes palette. M/C must preserve composition identity and every
retained value. Added rules must preserve earlier geometry/attributes/ancestry on every
tree, allowing child counts and terminal membership to change. Reset must regenerate and
match initial geometry and PNG bytes. Every edit must visibly change the previous PNG.

| State | Segments | Trees | Drawn terminal dots |
| --- | ---: | ---: | ---: |
| initial | 101 | 1 | 53 |
| extended | 192 | 1 | 99 |
| extended-restored | 101 | 1 | 53 |
| narrowing | 101 | 1 | 53 |
| reset-1 | 101 | 1 | 53 |
| wide | 101 | 1 | 53 |
| reset-2 | 101 | 1 | 53 |
| binary | 38 | 1 | 16 |
| reset-3 | 101 | 1 | 53 |
| recolour | 101 | 1 | 53 |
| thin | 101 | 1 | 0 |
| forest | 288 | 7 | 0 |
| forest-taper | 288 | 7 | 145 |
| forest-palette | 288 | 7 | 145 |
| forest-extended | 560 | 7 | 280 |
| forest-seed | 634 | 8 | 313 |
| final-reset | 101 | 1 | 53 |

Require correct settings/revision and counted native lines/dots for every composition,
640-square PNGs, no console/page errors and unchanged source/runtime hashes. After final
reset, unknown Q must leave geometry/canvas/revision unchanged for250ms. Save the actual
cached canvas through the UI, read download bytes and verify equality with displayed PNG
before/after another250ms quiet period. Capture every composition and saved PNG.

Root inspects representative baseline/extended/narrow/binary/thin/forest/taper/extended
forest images before acceptance. Runtime-specific antialiasing and clipping remain normal
renderer behavior. No physical keyboard, human usability study, source recreation or
package acceptance is implied. On failure preserve evidence and diagnose the earliest
failed layer without loosening counts or prefix requirements.
