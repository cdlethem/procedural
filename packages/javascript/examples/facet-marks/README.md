# Facet marks in the browser

This source-checkout starter retains one Delaunay facet mesh over either disc-scattered
sites (an authored `java.util.Random` example source) or `layout.seeded-quadrant-partition-2d`
cell centres, plus a per-face uniform `sampling.seeded-triangle-points-2d` grain batch. It
draws the mesh filled, as wire, or as grain, matching the established FacetMarks/
Delaunay marks conventions.

Open `index.html` (served from the repository-local pinned p5 runtime; see
`tools/serve_facet_marks.mjs`), or use the on-page buttons/keys:

- `M`: fill / wire / grain draw mode (restyle only)
- `C`: base / alternate palette (restyle only)
- `P`: show sites (restyle only)
- `N`: coarse / fine site count; rebuilds
- `X`: disc / cell-centre sites; rebuilds
- `R`: next seed; rebuilds
- `0`: reset to the baseline seed/settings
- `S`: save the already displayed canvas to a PNG

`M`, `C`, and `P` repaint from the same retained mesh and grain batch. `N`, `X`, and `R`
rebuild replacement geometry. This starter is not a browser-native conformance or
reproduction claim; it is a scoped port of the accepted FacetMarks composition's
mechanism to p5.js.
