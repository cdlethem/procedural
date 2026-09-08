# GrainMarks Android resume correction draft

Native1 completed baseline, motif, and palette, then resumed with the cached third
snapshot but did not reach the observer's next distribution edit before its deadline.
Native2 passed the unchanged production code, so the stall is intermittent evidence and
does not by itself establish a deterministic model or renderer failure.

The Activity previously delivered a cached snapshot through two paths after a no-loop
resume: its UI `onResume` post and `Probe.handleSpecialDraw` after Processing's
restoration frame. Pinned Processing returns early from special draws, bypassing the
ordinary `post` callback. The second acknowledgment was added as compensation, but the
Activity's own cached UI post already performs that role. The two paths do not prove an
edit is lost in a particular ordering: if the second callback sees the old requested
version it merely repeats the acknowledgment; if it sees a newer requested version it
returns. They do create unnecessary ordering variation around observer-triggered input.

The correction makes `onResume` the only cached-snapshot acknowledgment. A special draw
only requests a redraw when its desired version is stale. Observer hooks record the
acknowledgment source and whether the resumed distribution click entered the normal edit
gate and published its next version. The native probe requires exactly one
`resume-cache` acknowledgment, an accepted distribution edit, all ten existing states,
retained-geometry/reset checks, quiet save, real HOME/resume, and the same cached
MediaStore bytes. It does not weaken image, lifecycle, or state assertions.

The observer counts every acknowledgment of the resumed version-2 cached snapshot until
the final save, not merely callbacks while the pause flag is set. Hook assertion failures
are written through the probe's normal failure record so a diagnostic violation retains
its ordering trace instead of terminating the Activity before evidence is published.
