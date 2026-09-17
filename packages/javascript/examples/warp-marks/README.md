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
- **Source coverage** cuts coherent diagonal gutters through 96-pixel bands in
  the captured source before remapping. At 100% it keeps the original opaque
  pattern; at 0% the canvas and saved PNG are transparent. Release the slider to
  render an intermediate value.
- **0** resets to strength 32, the noise field, the dot source and full coverage.
- **S** saves the already displayed canvas, including its alpha channel.

`warp-marks.js` keeps the retained palette/noise field in `createWarpMarks()`, and
`displacementAt()` is the place to invent another displacement field. `remapSource()`
composes the exact per-pixel field with the public `bilinearRasterRemap2D` operation.
The optional source mask is example composition code: for masked pixels it
premultiplies RGB before the single remap and unpremultiplies its result to
avoid dark edge halos. Full coverage retains the original source and pixel path.

Motivation and native acceptance for the reference Java composition are recorded in
`catalog/validation/bilinear-raster-remap.json` (`targets.processing-java.technique`).
This starter is not a browser-native conformance or reproduction claim; it is a scoped
port of that accepted composition's mechanism to p5.js.
