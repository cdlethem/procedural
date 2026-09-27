# Ordered Halftone

An editable seeded scalar source is sampled on a grid and screened with the actual `bayerDither` operation. The Bayer order changes periodic threshold structure; changing the source weights changes what the screen sees. Zero source or zero printed size remains transparent, even at low thresholds.

| Control | Canvas effect |
| --- | --- |
| Center, footprint width/height; feature count/spread/radius/aspect/angle | Place, stretch and scatter compact regions of source tone, independently of pixel size. |
| Solid/wave/noise weights, wave contrast/frequency/angle, noise scale, source gain | Choose broad density, coherent wave bands or seeded noisy tone in continuous proportions. |
| Sample cell and Bayer order | Separately control sampling pitch and threshold-screen period (order is a power-of-two exponent). |
| Mark dot/line/cell, fill, line length/width, angle and row/stitch spacing | Print only retained bits; change surface texture without regenerating source pixels. |

Try **isolated screen blooms** with center .7/.36, footprint 300 × 310, 4 features, spread .5, radius .21, solid .8, wave .3 at frequency 4, noise 0, order 2, dot fill .65. Try **broad striped screening** with footprint 580 × 520, 15 features, spread 1.2, radius .34, solid .1, wave 1 at frequency 13 and angle -65°, noise .2, order 5, line marks at 40°, fill .7, stitch spacing 2. Density comes from actual source/screen bits, not off-bit paper tiles.

Hard bounds: sample cell 4–120, feature count 0–48, Bayer order 1–6; practical sliders target the smaller ranges above. Source cell-feature work cannot exceed 700,000.
