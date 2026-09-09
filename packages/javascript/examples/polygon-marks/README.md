# Polygon marks in the browser

This source-checkout starter proposes 600 seeded convex outlines (rounded
capsules or diamonds) across a canvas and keeps only the ones that don't overlap
or touch any earlier-kept shape, in proposal order
(`sampling.ordered-convex-polygon-filter-2d`). Cross-checked the seeded pose
generation and filtered output against a real `java.util.Random(42)` +
`ConvexPolygonPlacements2D` reference run before writing the JS model test
(110 of 600 kept; placement 0 vertex 0 byte-identical).

This starter is not a browser-native conformance or reproduction claim; it is a
scoped port of the accepted PolygonMarks composition's mechanism to p5.js.
