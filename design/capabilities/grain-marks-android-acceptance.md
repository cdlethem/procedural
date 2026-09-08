# GrainMarks Android native acceptance plan

Validate the accepted triangle operations through the unchanged Java GrainComposition
and native Android2D point/line renderer. Motivation and exclusions are recorded in
grain-marks-android-boundary.md; this is starter workflow validation, not an original
sketch recreation or cross-platform pixel identity claim.

Compile the actual Activity and observer before one API33 execution under the shared
machine render lock. Bound the emulator session to500 seconds, boot to180 seconds,
and runner to240 seconds including cleanup. Preserve every attempt outside Git.

Require ten actual UI-thread button-callback compositions: baseline, strokes, alternate
palette, vertex concentration, edge concentration, density0.2, seed43, quadrant cells,
reset, reset again. Counts are15680 for the first five,31360 for density/seed,81920
for26 cell triangles, and15680 for both resets. Style edits retain the same composition;
geometric edits replace it. Both resets reproduce baseline PNG bytes; reset from defaults
must still rebuild geometry. Require exact settings and640-square PNGs for every state.

For baseline dots, compare native non-background pixel bounds to retained point extrema
within2 pixels on all four sides. Inspect baseline, strokes, both concentrations and cells
to confirm full triangle coverage and the intended change in distribution.

After palette, send real HOME and reorder the existing Activity to front. Require actual
pause/resume and unchanged snapshot/geometry. Callback invocation does not claim physical
touch or keyboard testing. After the final reset require300ms quiet, then save through
the actual bounded writer and MediaStore. Read the saved URI, require finalized PNG row
and cached PNG byte equality, and require another300ms without a new frame/composition.

Bind source, staged project, APK, runner and plan hashes; verify unchanged inputs before
and after execution. Force-stop the probe and terminate the emulator on completion/failure.
Root image review and evidence review are required before native support acceptance.

## Diagnostic attempt2

Attempt1 compiled and passed three compositions plus actual resume identity, then reached
the execution deadline before composition4. Preserve its complete evidence. No production
change yet: add observer assertions that the post-resume button is enabled and invokes a
listener, and record requested state/version after that callback. Re-run the same ten-state
criteria with a fresh probe/output. This distinguishes missing callback publication from
native redraw scheduling; diagnostics do not count as successful workflow acceptance.
