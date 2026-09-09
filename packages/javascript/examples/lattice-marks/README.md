# Lattice marks in the browser

This source-checkout starter retains twelve (or thirty-six) ordered cardinal cell paths
grown across a 24x24 lattice, drawn either as connected path outlines with pale
endpoints or as a per-cell dot fan. It draws directly on the main p5 canvas (not the
shared `drawing.fresh-raster-2d` vocabulary), matching the established Profile marks
precedent for non-vocabulary content.

Open `index.html` (served from the repository-local pinned p5 runtime; see
`tools/serve_lattice_marks.mjs`), or use the on-page buttons/keys:

- `C`: base / alternate palette (`CyclicPalette`, restyle only)
- `M`: path outline / per-cell dot rendering (restyle only)
- `W`: narrow / wide stroke (restyle only)
- `L`: short / long step limit; rebuilds
- `N`: few / many starts; rebuilds
- `R`: next seed; rebuilds
- `0`: reset to the baseline seed/settings
- `S`: save the already displayed canvas to a PNG

`M`, `C`, and `W` repaint from the same retained `path.occupied-lattice-paths-2d`
result. `L`, `N`, and `R` rebuild replacement paths. This starter is not a
browser-native conformance or reproduction claim; it is a scoped port of the accepted
LatticeMarks composition's mechanism to p5.js.
