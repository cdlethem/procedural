# Projection marks in the browser

This source-checkout starter pushes a filled contour and twelve parallel
scanlines outward by four fixed discs, applied one at a time in a chosen order,
at a chosen strength (`geometry.sequential-disc-projection-2d`). All six
order/strength combinations are precomputed once, matching the Java example's own
precompute-then-select structure; the interactive controls only select and recolor
an already-computed result. Cross-checked the precomputed output against a real
`DiscProjection2D` Java reference run before writing the JS model test
(3386-value flat output, byte-identical first point).

This starter is not a browser-native conformance or reproduction claim; it is a
scoped port of the accepted ProjectionMarks composition's mechanism to p5.js.
