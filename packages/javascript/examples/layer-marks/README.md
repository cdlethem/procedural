# Layer marks in the browser

This source-checkout starter partitions the canvas into four fixed
retained-rectangle quadrants (`layout.retained-rectangle-cuts-2d`) and
displays one of four region-layering passes over one retained source image:
a canvas-positioned "picture" pass, a locally cropped-and-decorated "local"
pass with sharp or feathered region edges, or a horizontal crossfade between
both. The region coverage/compositing kernel mirrors Java's
`Java2DRegions.render` (a JAVA2D-only Processing adapter built on the
accepted `raster.masked-source-over-2d` core) and was cross-checked
pixel-by-pixel against a real `Java2DRegions.render` run - Space.CANVAS vs
Space.LOCAL translation and the feather ramp formula - before writing the JS
model test (byte-identical results).

M cycles the four modes, and S saves the displayed raster without redraw.
The Java source is marked a candidate workflow; the compositing operation it
demonstrates is accepted.

This starter is not a browser-native conformance or reproduction claim; it
is a scoped port of the LayerMarks composition's mechanism to p5.js.
