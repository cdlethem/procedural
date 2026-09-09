# JavaScript port integration

The p5.js batch from `origin/porting/backlog` at `2f9418e3` is reviewed against main
`aed135cc`. It adds **12 cores and 12 editable browser workflows**. Current shared support
is **30 conformant JavaScript cores, 29 operations with scoped native coverage, and four
with technique coverage**. These dimensions are separate, not additive.

| Added core | Browser use reviewed here |
| --- | --- |
| Binary cell partition | PanelMarks |
| Retained rectangle cuts | CutMarks, including selection, cuts and removal |
| Raster crossfade | BlurMarks blend between sharp and filtered images |
| Masked source-over | BlurMarks places filtered artwork over a background |
| 3D gradient noise | DepthMarks field and colored mesh |
| Convex polygon placement | PolygonMarks |
| Polygon segment clipping | PathClipMarks |
| Radial pull | PullMarks |
| Sequential disc projection | ProjectionMarks |
| Annular solid | AnnularMarks, including three-instance arrangement |
| Separable blur | BlurMarks |
| Nearest segment contact | Core only; ContactMarks browser workflow remains pending |

LatticeMarks, FacetMarks and animated SpringMarks add native workflow coverage to cores
reviewed in the previous batch. The earlier eight-core/five-workflow integration remains
accepted; its records are linked from [the previous package review](../evidence/ports/javascript-package/root-review.json).

## Review and corrections

- Preserved main’s previous spline, Delaunay, input-validation and numerical-notice fixes
  when resolving the older branch versions.
- Replaced the power helper’s OpenJDK-derived control flow with a direct netlib C
  translation and preserved the complete applicable notices. A reproducible Java17 oracle
  covers 741 boundary, moderate and seeded cases.
- Fixed SpringMarks’ Space shortcut so a focused button cannot also generate a second toggle.
- Checked all twelve workflows in real Chromium under the shared render lease: edits,
  button interaction, reset or reload identity, and saving without redraw. Canvas2D uses
  a fixed CPU raster backend; WebGL uses SwiftShader. Root inspected native images.
- Added the twelve operations to the public package exports and verified an offline-installed
  local tarball. Error names that would collide are exported as `BinaryPartitionError`,
  `ConvexPlacementError`, `AnnularMeshError`, `AnnularFaceLimitError` and
  `AnnularMeshArithmeticError`.

See the [core review](../evidence/ports/p5-backlog/core-root-review.json),
[native review](../evidence/ports/p5-backlog/native-root-review.json) and
[integration review](../evidence/ports/p5-backlog/integration-root-review.json).
These are scoped runtime checks, not Java pixel identity or new source-sketch reproductions.

## Install or run

Build a local package with:

```sh
node tools/build_ported_javascript_package.mjs .work/dist/my-p5-package
```

Use a fresh output directory. The package is private and has not been published to npm.
For an editable browser example, run `node tools/serve_annular_marks.mjs` (or the matching
`serve_*_marks.mjs` script) and open the printed local URL. These servers install pinned
p5.js automatically if needed.

## Work retained for later

The three Python core modules added in this batch are present as pending source and tests;
they are not newly exported or accepted for py5. Older Python/py5 and Android backlog
files remain at `2f9418e3` on the port branch and were deliberately excluded from this
p5 integration. The merge ancestry does not mean those files were accepted: bring their
patches forward explicitly for later review.

The Java candidate comments in LayerMarks, MaskMarks, ClipMarks and ContactMarks are stale.
Their current Java acceptance is recorded in `catalog/validation/`; these standalone p5
workflows remain legitimate porting tasks. See [the handoff](porting-resume.md).
