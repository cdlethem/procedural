# Warp marks in the browser

This source-checkout starter draws a retained source pattern (dots sampled from a
public cyclic palette, or stripes) into an offscreen buffer, then remaps it through the
public raster.bilinear-remap-2d operation using a per-pixel displacement field driven by
either a public gradient-noise field or a pair of sine waves.

Source-pattern drawing is renderer-owned content generation, matching the Java example's
own approach (`sourceCanvas.ellipse()`/`rect()`, then `.get().pixels`): it is not part of
the portable remap operation, only its input. `sketch.js` extracts the offscreen buffer's
canvas RGBA pixels and packs them into the unsigned32 ARGB8 format the shared contract
expects, then unpacks the remapped result back into a displayable image.

Serve this directory together with `packages/javascript/src/` and pinned p5 2.3.2, mapping
the p5 script to `/p5.js`. Open `index.html`, then use the visible controls or keys:

- **W** cycles displacement strength through 0, 32, and 64 pixels.
- **F** switches the displacement field between the gradient-noise angle and a pair of
  sine waves.
- **P** switches the source pattern between dots and stripes.
- **0** resets to strength 32, the noise field, and the dot source.
- **S** saves the already displayed canvas.

`warp-marks.js` keeps the retained palette/noise field in `createWarpMarks()`, and
`displacementAt()` is the place to invent another displacement field. `remapSource()`
composes the exact per-pixel field with the public `bilinearRasterRemap2D` operation.

Motivation and native acceptance for the reference Java composition are recorded in
`catalog/validation/bilinear-raster-remap.json` (`targets.processing-java.technique`).
This starter is not a browser-native conformance or reproduction claim; it is a scoped
port of that accepted composition's mechanism to p5.js.
