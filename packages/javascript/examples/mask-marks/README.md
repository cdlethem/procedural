# Mask marks in the browser

This source-checkout starter keeps four layers (ground, source, marks,
alpha mask) independently and displays one of three composites: marks over
ground through the mask, source over ground through the mask, or a
marks-to-source crossfade weighted by the same mask - using
`raster.masked-source-over-2d` and `raster.crossfade-2d` (premultiplied
encoded-color arithmetic, single binary64 rounding per channel). All three
composites were cross-checked pixel-by-pixel against a real
`MaskedComposite2D`/`RasterCrossfade2D` Java reference run on the same
synthetic rasters before writing the JS model test (byte-identical results,
including partial-alpha and transparent-pixel cases).

M cycles the content, V shows the retained mask itself, and S saves the
displayed raster (alpha included) without redraw. The Java source is marked
a candidate example; the compositing operations it demonstrates are the
accepted operations above.

This starter is not a browser-native conformance or reproduction claim; it
is a scoped port of the MaskMarks composition's mechanism to p5.js.
