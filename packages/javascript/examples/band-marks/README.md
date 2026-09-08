# Band marks in the browser

This source-checkout starter retains 64 public attempt-bounded noise-band paths, then
draws either their connected movement or a perpendicular tick mark every 8th vertex. It
uses the versioned internal p5 Canvas2D frame adapter already used by the browser Path
marks starter (both views are plain capped line segments, matching the shared
`drawing.fresh-raster-2d` vocabulary exactly).

Serve this directory together with `packages/javascript/src/` and pinned p5 2.3.2, mapping
the p5 script to `/p5.js`. Open `index.html`, then use the visible controls or keys:

- **T** switches the trace tolerance between narrow (0.002) and wide (0.008) and
  rebuilds all 64 paths.
- **C** switches palettes without rebuilding.
- **M** switches between the connected path and the tick-mark view without rebuilding.
- **0** resets to narrow tolerance, base palette, and the path view.
- **S** saves the already displayed canvas.

`band-marks.js` keeps composition constants in `createBandMarks()`, which reproduces the
Java example's 8x8 start grid, per-path seeds, and shared field seed exactly.
`bandPathCommands()` generates each view lazily. Change it to invent another treatment
of the same retained paths.

Motivation and native acceptance for the reference Java composition are recorded in
`catalog/validation/noise-band-path.json` (`targets.processing-java.technique`). This
starter is not a browser-native conformance or reproduction claim; it is a scoped port
of that accepted composition's mechanism to p5.js.
