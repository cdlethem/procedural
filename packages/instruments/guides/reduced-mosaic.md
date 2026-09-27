# Reduced mosaic

An independently seeded collection of compact source features supplies local scalar samples. Each occupied sample becomes RGB from the layer's palette, then the existing `medianCutQuantize` reduces *only occupied source cells*. Empty surroundings stay transparent rather than becoming another quantized color. The high/low view and cell spacing select tiles **after** quantization; surviving tiles retain their exact reduced colors.

| Control | Canvas effect |
| --- | --- |
| Center, footprint width/height, feature count/spread/radius/aspect/angle | Change occupied color-bearing territory independently of the grid. Count or footprint extent zero means no tiles. |
| Solid/wave/noise weights, wave contrast/frequency/angle, noise scale/gain | Change actual sampled RGB input; mix orderly gradients and seeded variation instead of screening fixed waves. |
| Sample cell, colors | Choose grid resolution and requested median-cut palette boxes independently. |
| Show source values, source cutoff | Select all occupied cells, high-valued occupied cells or low-valued occupied cells *after* quantization. |
| Cell interval and cell fill | Place every nth occupied column/row and shrink tiles to reveal lower layers without changing source or quantized palette. Fill zero draws no tiles. |
| Seed and palette | Reseed geometry/noise, or recolor source RGB **before** quantization. |

For **small stained fragments**, use center .3/.7, footprint 300 × 380, features 4, spread .55, radius .18, solid .8, wave .2, noise .35 at scale 12, sample cell 18, colors 4, interval 2, fill .75. For **interlocking mosaic fields**, use center .5/.5, footprint 590 × 560, features 18, spread 1.2, radius .32, solid .3, wave 1 at frequency 9/angle 65°, noise .1, sample cell 19, colors 8, interval 1, fill .94. Comparing high/low at cutoff .4 isolates complementary portions of the *same* reduced source.

Practical sliders: sample cell 17–30 and colors 2–9; hard bounds: 4–120 and colors 1–10, but cell² × cell² × colors plus additional quantizer work may not exceed 15,000,000. Source checks have their own 700,000 cell-feature cap. The joint quantizer cap is checked before source allocation.
