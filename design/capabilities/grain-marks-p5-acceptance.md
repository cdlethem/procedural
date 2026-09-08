# GrainMarks p5 native acceptance plan

Scope: the actual p5.js2.3.2/Chromium153 sketch, its retained model, browser edits and
cached PNG save. The six Java/JS composition comparisons already establish exact retained
geometry, including caller-side biased sampling and CP4 transfer. Native pixels are
renderer-specific; no Java pixel identity or original-sketch recreation claim is intended.

Use the established localhost/Playwright runner under the shared machine render lock.
Register one run with180-second local deadline and240-second whole-process lease. Preserve
failed attempts and wait for terminal cleanup before a corrective run. Images stay in a
fresh ignored `.work/reproductions` directory. Bind input and runtime hashes before/after.

Exercise these nine compositions in order, drawing once per edit:

1. Baseline: seed42, density0.1, uniform, one triangle,15680 dots.
2. M: strokes; same composition and point geometry.
3. Keyboard C: alternate palette; same composition and point geometry.
4. B: first-vertex concentration; new geometry,15680 points.
5. B: edge concentration; new geometry,15680 points.
6. N: density0.2; new geometry,31360 points.
7. R: seed43; new geometry,31360 points.
8. X: quadrant transfer;26 triangles,81920 points, new geometry.
9. 0: restore all baseline settings; new composition and baseline-identical canvas.

For each, inspect actual model identity, all retained coordinates, settings, revision,
640x640 density1 canvas and mark count. Capture baseline, strokes, colour, both biased
states, cell transfer and reset. Require style images to change, geometry edits to change
geometry and reset PNG to equal baseline. Unknown Q and save must preserve revision9,
geometry identity and canvas; observe a250ms quiet interval. Downloaded save must equal
the displayed cached PNG. Browser errors fail the run. These are automated browser clicks
and keyboard events, not a human usability study.

Root inspects baseline, a style edit, both concentration images and cell transfer before
any target-support decision. No export, package or shared attestation is implied by a
runner pass alone. No fresh performance matrix or new renderer infrastructure is required.

## Corrective native boundary after attempts1/2

Both attempts returned runner passes but root rejects their native support claim. Visual
inspection of attempt2 found uniform dots clipped at x≈256; strokes cover the full triangle.
The pinned p5 source constructs points as lines from x to x+0.00001. This is consistent
with the observed float-resolution cutoff; the exact browser internals were not instrumented.
Use explicit native p5 filled1px circles for the example dot motif. This is a documented
renderer choice, not a change to retained geometry, the sampling API or a Java pixel match.

Before attempt3 add a baseline pixel-envelope check: non-background raster bounds must be
within2px of the actual retained point extrema on each side. The tolerance accounts for
1px disks and raster rounding; it is fixed before the corrected render. This checks whole
triangle extent and catches the observed cutoff. All original edit/reset/save checks remain.
Attempt1 additionally had an incorrect palette hash comparison; attempt2 corrected it.
Preserve both reports/images. Reinspect all five representative images after the fix.
