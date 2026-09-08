# Ramp marks in the browser

This source-checkout starter retains one public positioned color ramp, then samples it
at a fixed 27x27 grid of dots using either a linear or radial scalar coordinate. Dots are
drawn with p5's native circle primitive directly (not the shared `drawing.fresh-raster-2d`
segment2/quad2 vocabulary, which has no round-fill primitive and would otherwise force a
visible square approximation), matching the established Profile/Loop marks precedent for
content outside that shared vocabulary.

Serve this directory together with `packages/javascript/src/` and pinned p5 2.3.2, mapping
the p5 script to `/p5.js`. Open `index.html`, then use the visible controls or keys:

- **T** shifts the second color stop from 0.25 to 0.6 and rebuilds the ramp.
- **C** switches palettes and rebuilds the ramp.
- **F** switches the sampled coordinate between linear (x position) and radial (distance
  from center) without rebuilding.
- **0** resets to the base stops, base palette, and linear coordinate.
- **S** saves the already displayed canvas.

`ramp-marks.js` keeps composition constants in `createRampMarks()`, which reproduces the
Java example's four-stop base/shifted/alternate configurations exactly. `rampGridDots()`
generates each grid dot's fixed position and sampled color lazily. Change it to invent
another treatment of the same ramp.

Motivation and native acceptance for the reference Java composition are recorded in
`catalog/validation/stop-ramp.json` (`targets.processing-java.technique`). This starter
is not a browser-native conformance or reproduction claim; it is a scoped port of that
accepted composition's mechanism to p5.js.
