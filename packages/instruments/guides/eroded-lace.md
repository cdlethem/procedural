# Eroded Lace

The same editable seeded scalar source as Dilated Stamps becomes a binary mask at **Mask cutoff**. `binaryMorphology2D` then erodes it with the selected active element, repeating the operation exactly the selected number of times. Out-of-bounds samples are zero, so contours at the edge shrink rather than wrapping around. Source geometry and output mark size are separate.

| Control | Canvas effect |
| --- | --- |
| Footprint center/width/height; feature count/spread/radius/aspect/angle | Place independent compact mask source features. Feature count or footprint extent zero yields a blank mask. |
| Solid/wave/noise weights, wave contrast/frequency/angle, noise scale, source gain, mask cutoff | Sculpt the image *before* thresholding; raise cutoff for increasingly selective source islands. |
| Sample cell, odd element width, element shape, passes | Change actual binary grid, square/disk/cross active taps, and repeated erosion (zero passes displays original binary source). |
| Output mark dot/square, output size | Draw surviving cells only; zero size draws no ink but does not change the morphology. |

Try **fine negative lace**: center .5/.5, footprint 510 × 510, features 12, spread 1, radius .27, solid .8/wave .4/noise .1, cutoff .28, cell 9, square element 3, 1 pass, dot size .55. For **broken carved islands**, try center .27/.7, footprint 330 × 320, features 4, spread .38, radius .32, aspect 2.3, wave 1 at frequency 8 and angle 70°, solid .4, cutoff .5, cell 12, cross element 5, 2 passes, square output size .85.

Practical element width 1–7, passes 0–5; exact hard bounds 1–15 odd and 0–8. Before source allocation the combined grid × active element taps × passes must fit 1,200,000 operations (and source cell × feature count 700,000). An over-budget combination fails rather than silently changing resolution.
