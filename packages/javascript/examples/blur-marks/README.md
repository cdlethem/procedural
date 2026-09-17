# Blur marks in the browser

This source-checkout starter filters one semi-transparent artwork layer three
ways with a normalized separable convolution (`raster.separable-blur-2d`:
isotropic soft, horizontal-only streak, vertical-only streak), optionally
crossfades left-to-right back toward the sharp original
(`raster.crossfade-2d`), then composites the result over a striped ground
(`raster.masked-source-over-2d`). Cross-checked the full blur/crossfade/composite
pipeline against a real `SeparableBlur2D`/`RasterCrossfade2D`/`MaskedComposite2D`
Java reference run on a synthetic raster before writing the JS model test
(byte-identical output at four sampled pixels, including mode 2 + blended).

The `blur-marks.js` composition takes pre-rendered ground/artwork ARGB rasters
(`{width,height,pixels}`) so its blend/composite logic is testable without a
canvas; `sketch.js` owns drawing those two source rasters via `p.createGraphics`
and converting between p5's straight RGBA pixel buffers and Processing's packed
ARGB `PImage.pixels` format.

The **Source coverage** slider adds a second, transparent composition path.
At 100% the original retained blur/blend/ground composition is unchanged.
Below 100%, the source artwork is first composited with its authored ground,
then a diagonal mask cuts clear gutters through 96-pixel source-space bands before the
same separable filters run. **M** selects sharp, soft, horizontal-only or
vertical-only; **B** blends the selected treatment with sharp; **0** restores
the starting mode, blend and full coverage. Release the slider to render.
**S** saves the displayed canvas with transparency. The mask and rendered
ground are example-level source choices, not portable blur defaults. The
masked path returns the filtered image directly so no opaque ground is painted
behind its clear areas; the core blur handles premultiplied color internally.

This starter is not a browser-native conformance or reproduction claim; it is a
scoped port of the accepted BlurMarks composition's mechanism to p5.js.
