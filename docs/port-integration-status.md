# Port integration status

Root review is pinned to `origin/porting/backlog` commit `47ec5b2b` in the isolated
`.work/port-review` checkout. The port author's checkout and branch are unchanged.

Accepted JavaScript source-checkout slices:

- StopRamp and RampMarks: `evidence/ports/stop-ramp-p5/root-review.json`.
- Bilinear raster remapping and WarpMarks:
  `evidence/ports/raster-remap-p5/root-review.json`.

These have root-reviewed core fixtures and actual browser edits/reset/save. They use
direct module imports. Common root-barrel exports and package-distribution validation
remain pending; py5/Android claims are not imported with these files.

Target springs core is also accepted through direct-module import after 44 shared cases
passed in Node and Chromium; native-workflow/technique support remain unvalidated.
See `evidence/ports/target-springs-p5/root-review.json`.

Occupied-lattice core is accepted separately in
`evidence/ports/occupied-lattice-p5/root-review.json`; 14 shared cases pass in Node and
Chromium. Native-workflow/technique acceptance remains unvalidated.

Delaunay core is accepted in `evidence/ports/delaunay-p5/root-review.json`, including
a root fix for function-argument overflow when joining a large hull. Rendering remains
unvalidated.

Closed spline and LoopMarks are accepted in
`evidence/ports/closed-spline-p5/root-review.json`, following the arithmetic replacement
and fresh 1,033-pair Java runtime oracle.

Remaining original JavaScript core work: noise-band paths
and line pools; BandMarks and
CutBranchMarks workflows. SpringMarks animation still needs separate native acceptance. Existing operation contracts and
shared fixtures stay authoritative, including any intentional host API differences.

## Spline provenance issue

The branch's `closed-spline.js` says its hypot code was ported from OpenJDK17
`java.lang.FdLibm.Hypot`. Root's worker verified the structural match against the local
Temurin17.0.20.1+1 `src.zip`: FdLibm.java SHA256
`24b6dc21d26d6f4f578ea35126a32b55311164e583d0b25e03b72b40f3f41887`.
That source includes an Oracle copyright and GPLv2/ClassPath Exception header, while
the JS/Python translations omit upstream notices and the project notices have no entry.
Do not merge those translations under an implicit project MIT claim.

Investigate the original netlib fdlibm hypot implementation with preserved source notices
and verify exact arithmetic behavior before choosing a replacement. A provenance label
alone does not make a copied implementation independent. Trigonometric fdlibm translations
also require their own complete source/notice review. No tolerance relaxation is authorized.

All native browser/Processing runs use the shared machine lock at
`tools/with_native_render_lock.py`. Gallery images remain ignored. Root alone writes shared
acceptance records; the Android ProfileMarks draft in main remains untouched.

The spline issue above is resolved for the integrated JavaScript slice: the OpenJDK-derived
block was removed. `src/internal/fdlibm-hypot.js` directly translates the named netlib source
and preserves its complete notice; an explicit scaled-high-word correction is documented.
Fresh Java runtime comparisons test the replacement without copying the JDK implementation.
The Python branch remains unchanged and is not accepted by this JavaScript review.
