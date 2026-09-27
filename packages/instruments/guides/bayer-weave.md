# Bayer Weave

The same local seeded scalar source drives `bayerDither`, but retained bits print crossed horizontal and vertical bars instead of dots. Each bar direction has its own real width; either can be zero independently. No off-bit or background marks are drawn.

| Control | Canvas effect |
| --- | --- |
| Footprint center/size, feature count/spread/radius/aspect/angle | Arrange compact supporting shapes without changing bar thickness or Bayer pitch. |
| Solid/wave/noise weights, wave contrast/frequency/angle, noise scale/gain | Continuously vary ordered versus granular tone inside occupied shapes. |
| Sample cell and Bayer order | Set source pixel pitch and ordered screen period separately. |
| Across weight, down weight, bar reach, mark fill, row/stitch spacing | Build crossed, horizontal-only, vertical-only or open lattice marks from the retained bits. Both weights zero, reach zero or fill zero means no ink. |

For **open horizontal warp**, use center .42/.56, footprint 370 × 480, features 6, spread .65, radius .16, wave 1 at frequency 7 and angle 15°, solid .35, order 3, across weight .37, down weight 0, bar reach 1.8, row spacing 3. For **crossed mesh**, try footprint 570 × 540, 16 features, spread 1.2, radius .27, wave .45/noise .3/solid .7, order 4, across weight .16, down weight .38, bar reach 1.3, row spacing 1, stitch spacing 1.

Practical controls sit inside hard limits: sample cell 4–120, feature count 0–48, bar reach 0–6 cell widths, Bayer order 1–6. Preflight caps source cell-feature checks at 700,000.
