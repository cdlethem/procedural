# Image field marks in the browser

This source-checkout starter samples one of two retained source images at
every point of a fixed 45x30 `layout.regular-grid`, using
`raster.bilinear-remap-2d` (the same accepted core WarpMarks uses,
edge-clamped bilinear interpolation) to read brightness/color at each grid
point. Dot diameter tracks the sampled brightness; a visibility mode makes
bright points disappear entirely instead of shrinking.

Both underlying operations were already cross-checked against Java in
earlier ports; this starter's own new logic (the visibility-skip/diameter
formula and source/color selection) is checked in the JS model test against
an independent computation using the same accepted sampling core.

M toggles visibility mode, I swaps the source image, C colors dots with
their sampled color, and S saves without redraw. The Java source is marked
a candidate example; the operations it demonstrates are accepted.

This starter is not a browser-native conformance or reproduction claim; it
is a scoped port of the ImageFieldMarks composition's mechanism to p5.js.
