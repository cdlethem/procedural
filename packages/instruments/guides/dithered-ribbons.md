# Dithered Ribbons: Dithered Marks starting recipe

The Ribbons starting recipe opens Dithered Marks with elongated strokes from retained bits; Engraving begins with small dots. Compact seeded source features combine solid density, directional stripes and portable grain, then pass through real Floyd–Steinberg diffusion. Mark length and angle can change independently of cell pitch, and background bits are transparent.

| Control | Canvas effect |
| --- | --- |
| Source X/Y, footprint width/height, feature count/spread/radius/aspect/angle | Move and sculpt occupied islands independently of print spacing. Count or footprint extent zero yields no source. |
| Solid/wave/noise weights, wave contrast/frequency/angle, noise scale, source gain | Mix orderly ribbons and grain within those islands. Zero gain or all weights leaves a blank layer. |
| Sample cell, threshold | Set sampling resolution and error-diffusion threshold separately from the source geometry. |
| Mark shape, length, width, angle, fill, row/stitch spacing | Set ribbon stroke geometry and clear spacing; switch to dots/cells for comparisons. Fill or line width zero draws nothing. |

For **thin wandering threads**, use features 5, spread .8, radius .12, footprint 480 × 520, aspect 2.5, feature angle -45°, solid .3/waves 1/noise .2, wave frequency 8, threshold .52, row spacing 2, stitch spacing 1, line length 3.5, width .12, angle 60°. For **dense textile bands**, try 16 features, spread 1.25, radius .27, aspect .55, footprint 580 × 540, solid .8/waves .4/noise .1, threshold .39, row spacing 1, stitch spacing 2, line length 1.8 and angle -20°. Changing mark angle or width does not change any sampled scalar.

Exact-entry bounds permit sample cell 4–120, feature count 0–48 and stroke length 0–10 cell widths, subject to the 700,000 cell-feature sampling cap. The operation remains `raster.floyd-steinberg-dither`.
