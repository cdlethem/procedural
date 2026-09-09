# JavaScript branch integration

The JavaScript portion of `origin/porting/backlog` at
`47ec5b2b73d7ac4466e7192e0695c64ee5664158` was reviewed and integrated into main through
`3f56c0c3f88de0700a7b7e6682a34b9b48e356e0`. The author's branch/checkout was preserved.
The batch adds eight cores and five workflows; it is not the total JavaScript inventory.

| Accepted core | Browser workflow in this batch | Root review |
|---|---|---|
| Stop ramp | RampMarks | [Review](../evidence/ports/stop-ramp-p5/root-review.json) |
| Bilinear raster remap | WarpMarks | [Review](../evidence/ports/raster-remap-p5/root-review.json) |
| Target springs | Core only | [Review](../evidence/ports/target-springs-p5/root-review.json) |
| Occupied lattice paths | Core only | [Review](../evidence/ports/occupied-lattice-p5/root-review.json) |
| Delaunay triangulation | Core only | [Review](../evidence/ports/delaunay-p5/root-review.json) |
| Closed spline | LoopMarks | [Review](../evidence/ports/closed-spline-p5/root-review.json) |
| Noise-band paths | BandMarks | [Review](../evidence/ports/noise-band-path-p5/root-review.json) |
| Seeded line pool | CutBranchMarks | [Review](../evidence/ports/line-pool-p5/root-review.json) |

The reviewed browser workflows cover actual edits, reset and save. Core-only rows do not
claim native animation or rendering. No new technique-level source recreation is implied.

## Integration corrections

Root corrected large-hull argument overflow in Delaunay and indexed getter validation in
line-pool. The OpenJDK-derived spline hypot block was replaced by a notice-preserved netlib
translation, checked against a fresh Java runtime oracle. The shared trigonometric helper
also preserves its full netlib notice and has fresh exact-runtime comparisons. Details and
hashes remain in the operation reviews; Python's branch translation was not accepted.

## Package use

All eight operations and their error classes are exported from `@procedurals/javascript`.
The [package review](../evidence/ports/javascript-package/root-review.json) verifies offline
local tarball installation, installed source inventory, export identities and representative
fixtures. The additive export successor preserves historical acceptance records.

```sh
node tools/build_ported_javascript_package.mjs .work/dist/<fresh-directory>
```

The package remains private and unpublished. Native acceptance covers source-checkout
examples; the tarball check covers installed code and import behavior. Remaining target
work and separate radial-profile acceptance obligations are in [the port handoff](porting-resume.md).
