# Dithered Marks: Engraving starting recipe

Dithered Marks composes an independently seeded set of compact features into a local scalar image. The Engraving starting recipe prints small dots; Ribbons begins with elongated strokes, and both use Floyd–Steinberg diffusion. Solid tone, directional waves, and grain mix continuously inside those supports. `floydSteinbergDither` then propagates tonal error across sample cells; only retained source bits print. Empty support never becomes paper-colored marks.

| Control | Canvas effect |
| --- | --- |
| Source X/Y; footprint width/height | Move and size the source region without resizing cells. Width or height zero leaves nothing. |
| Source features; spread; feature radius; aspect; feature angle | Change the number, placement, silhouette and rotation of independent compact features. Count zero leaves nothing. |
| Solid source; wave source/contrast/frequency/angle; noise source/scale; source gain | Continuously remix the same supports into orderly bands, textured islands or both; zero all weights or gain for transparency. |
| Sample cell; diffusion threshold | Change sampling separately from the Floyd–Steinberg decision. |
| Mark shape; mark fill; mark angle; line length/width; row/stitch spacing | Print dots, short strokes or cells from retained bits, with gaps. Fill zero draws no marks; these controls do not regenerate the source. |
| Seed; palette | Reseed feature placement and noise; recolor printed marks independently. |

Try **sparse etchings**: features 3, spread .35, radius .13, footprint 260 × 340, center X .3/Y .65, solid 1, waves 0, noise .15, threshold .5, cell 10, dots with fill .55. For **layered hatching**, try features 13, spread 1.1, radius .3, footprint 580 × 500, solid .2, waves 1, frequency 10, angle 70°, noise .1, threshold .42, lines of length 1.9, line width .14, mark angle -28°, row spacing 2. The second is a different source and mark arrangement, not a recolor.

Practical sliders are narrower than exact-entry hard limits: sample cell 4–120, feature count 0–48, and feature radius .005–1. Source sampling work is capped at 700,000 cell-feature checks. Floyd–Steinberg remains the named frozen operation; its results supply the marks, not a synthetic drawing substitute.
