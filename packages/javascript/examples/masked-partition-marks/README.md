# Masked partition marks in the browser

This source-checkout starter traces 24 `geometry.gradient-path-2d` fields and
draws an independent decorative source image, then reveals one of three
region-layering passes through per-region elliptical alpha masks over a
`layout.retained-rectangle-cuts-2d` four-quadrant partition (an alternate,
uneven split is available via N). The mask/content compositing kernel
mirrors Java's `Java2DRegions.renderMasked` (a JAVA2D-only Processing
adapter built on the accepted `raster.masked-source-over-2d` core) and was
cross-checked pixel-by-pixel against a real `Java2DRegions.renderMasked` run
with an irregular checkerboard coverage raster - proving mask pixels apply
across the whole destination, not just the region's own frame - before
writing the JS model test (byte-identical results).

M cycles the three modes, N swaps the layout (rebuilding the masks), 0
resets (rebuilding the layout only when it actually changed), and S saves
the displayed raster without redraw. The Java source is marked a candidate
workflow; the operations it demonstrates are accepted.

This starter is not a browser-native conformance or reproduction claim; it
is a scoped port of the MaskedPartitionMarks composition's mechanism to
p5.js.
