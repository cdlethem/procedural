# Dilated Stamps

This is the **same binary-mask instrument** as Eroded Lace, set to grow instead of shrink. A seeded compact scalar source is thresholded first, then `binaryMorphology2D` expands it with the chosen square, disk or cross element for each pass. The operation uses zero off-grid boundary data, not a periodic wrap. Empty input remains empty; output cell marks are separate from source features and structuring elements.

| Control | Canvas effect |
| --- | --- |
| Footprint center/width/height; feature count/spread/radius/aspect/angle | Place and orient small input stamps in a local region. Zero features or footprint size remains transparent. |
| Solid/wave/noise weights, wave contrast/frequency/angle, noise scale, source gain, mask cutoff | Change the actual binary mask *before* growth; choose sparse source with a higher cutoff. |
| Sample cell, odd element width, square/disk/cross shape, passes | Change grid sampling and the real extent/direction of repeated dilation. Zero passes shows unchanged input mask. |
| Output dot/square and size | Give occupied result cells a different mark from the growth kernel. Output size zero leaves no ink. |

For **widely separated seals**, try features 3, spread .8, radius .09, center .55/.42, footprint 460 × 360, solid 1/wave 0/noise 0, cutoff .4, cell 11, disk width 5, 2 passes, square output size .65. For **cross-branched clusters**, try features 10, spread .65, radius .1, center .34/.68, footprint 320 × 420, aspect 2, wave 1/frequency 7/angle 15°, cutoff .55, cell 9, cross width 5, 2 passes, dot size .85.

Practical element width 1–7 and 0–5 passes; exact hard bounds 1–15 odd and 0–8. Joint grid × active taps × passes cap: 1,200,000, checked before allocation, plus the 700,000 source sampling cap.
