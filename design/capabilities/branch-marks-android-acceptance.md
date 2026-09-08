# BranchMarks Android native acceptance

Execute unchanged Java BranchComposition and the actual Android Activity/renderer on
API33 Android2D. Root reviewed the edit-state/control conversion and Java-matching draw
treatment; the production Activity compiled at .work/examples/android-branch-marks-build1.
This plan is preregistration, not native acceptance.

Reuse the accepted GrainMarks button-callback probe, HOME/resume coordination and cached
MediaStore verification. Bound the shared machine lease to500 seconds, emulator boot to180,
runner execution to210 and cleanup to240. Preserve all attempts. No inputs change mid-run.

Exercise the Java/p5/py5 sequence through actual UI-thread button callbacks, followed by
an18th reset-again to prove reset from defaults still replaces the retained model.
The counts below are precomputed from accepted geometry, not raster observations:

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

| reset-again | 101 | 1 | 53 |

Require every setting, state version, actual renderer line/tip counts and retained tree
count. Independently tally actual childCount==0 tips. M/C retain model identity and all
values; geometry controls rebuild. Same-runtime growth preserves all-tree segments,
headings, lengths, parents and generations; terminal membership can change. Reset pixels
match baseline and every edit visibly changes pixels except reset-again. Capture640-square
PNGs for all18 compositions. Inspect initial, extended, narrowing, binary, thin, forest,
forest-taper and forest-extended output before root acceptance.

After the third composition send actual HOME and reorder the same Activity to front.
Require real pause/resume, unchanged snapshot/geometry, exactly one cached resume
acknowledgment counted through save, and accepted next G edit. Preserve the existing
stale-version redraw retry. After final reset require300ms quiet; save through actual
GalleryWriter/MediaStore and verify finalized PNG row plus cached PNG byte identity.
Require another300ms without another composition. Bind source/stage/APK/runner/plan hashes,
force-stop probe and terminate the owned emulator on success or failure.

Native callback execution does not claim physical touch/keyboard, source-sketch recreation,
portable drawing-command additions, cross-renderer pixel identity or package acceptance.

## Resume restoration regression after diagnostic attempt2

Native1 timed out after accepted post-resume edit; native2 passed with changed=true.
The original failure's runtime flags were not captured. Source review identifies a
missing-surface-change path that can leave pinned Android2D restoring indefinitely.
Branch Probe.resume now calls g.surfaceChanged before PApplet.restoreState/resumeThread.
This only sets the existing restore flag; it does not resize or bypass cached restoration.

Before actual resume, the observer exercises this hook on the paused actual renderer with
changed=false, requires changed=true, then clears it again. This controlled regression
would fail the previous hook and does not pre-satisfy the subsequent real lifecycle.
All18 original workflow requirements still apply. This does not certify missing/corrupt
cache recovery or prove the exact historical native1 state; preserve those limits.
