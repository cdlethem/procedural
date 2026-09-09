# Pointer marks in the browser

This source-checkout starter holds forty-nine spring bodies on a fixed 7x7 grid.
Each tick, the bodies' targets relax back toward the grid, and a held pointer
pulls nearby targets toward itself; the wire mode transfers the fixed initial
Delaunay connectivity to the moving bodies. Cross-checked body count, edge
count, and one-tick pointer pull against a real `RegularGrid`/`TargetSprings2D`/
`Delaunay2D` Java reference run before writing the JS model test
(body24 after one tick at pointer (300,300): 319.94942809041584,
byte-identical).

The JS core's `targetSprings2D` always performs one step, while Java's
`TargetSprings2D.create()` wraps state with no physics; the example keeps an
example-owned no-step accessor view for the initial state, the same divergence
documented in `spring-marks.js`.

This starter is not a browser-native conformance or reproduction claim; it is a
scoped port of the accepted PointerMarks composition's mechanism to p5.js.
