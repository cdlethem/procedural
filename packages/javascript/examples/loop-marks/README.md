# Loop marks in the browser

This source-checkout starter retains four public closed splines, then draws either an
oriented-tile outline or a triangle-fan view of the same curves. It uses the versioned
internal p5 Canvas2D frame adapter already used by the browser Path marks starter for
its outline/tile view; the fan view draws directly on the main canvas, matching the
established Profile marks precedent for content outside the shared drawing vocabulary
(triangles are not part of `drawing.fresh-raster-2d`, which admits only capped segments
and convex quads).

Serve this directory together with `packages/javascript/src/` and pinned p5 2.3.2, mapping
the p5 script to `/p5.js`. Open `index.html`, then use the visible controls or keys:

- **T** moves the second control point of each loop and rebuilds all four curves.
- **C** switches palettes without rebuilding geometry.
- **M** switches between the tile outline and the triangle-fan view.
- **0** resets to baseline geometry, base palette, and the tile view.
- **S** saves the already displayed canvas.

`loop-marks.js` keeps composition constants in `createLoopMarks()`, which reproduces the
Java example's `java.util.Random(42)` control-point radii exactly (a local, self-contained
LCG matching `java.util.Random.nextInt`, not the library's private xoshiro sampling
stream). `loopTileCommands()` and `loopFanTriangles()` generate each view lazily. Change
either generator to invent another treatment of the same curves. Rounded tile corners
(radius 3/1 in the Java source) are drawn as plain rectangles: the shared command
vocabulary has no rounded-rect primitive.

Motivation and native acceptance for the reference Java composition are recorded in
`design/capabilities/loop-marks-native-plan.md`. This starter is not a browser-native
conformance or reproduction claim; it is a scoped port of that accepted composition's
mechanism to p5.js.
