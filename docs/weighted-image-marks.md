# Make marks follow an image's density

In the [weighted image atlas](../packages/javascript/examples/weighted-image-atlas/), the left panel is a locally authored grayscale source and the right panel places editable dots where the source carries more mass. The relief and thermal masks show that the same sampling and centroid operations work with different images.

Run the p5 example with the repository's local study server, then use the buttons or matching keys:

| Control | Canvas effect |
| --- | --- |
| D invert density | Move sampling preference from dark source areas to light areas without altering the displayed input. |
| N count | Add marks while leaving the source and mark treatment alone. |
| R relax | Move each sampled mark once toward the weighted center of its assigned image pixels. No point is silently replaced or repelled. |
| T transfer image | Replace the relief field with an independently drawn thermal mask, using the same sampler and drawing code. |
| M mark | Draw each retained position as a short stitch instead of a dot. |
| I ink | Change mark color without moving any position. |
| 0 reset / S save | Restore the original state or download the currently displayed PNG. |

To use your own raster, replace the `relief`/`thermal` input functions in `sketch.js` with a local image-to-weight conversion. Supply one nonnegative integer weight per pixel in row-major order. A zero-weight pixel is never selected. The operations do not choose a luminance formula, handle alpha, supply source colors, or render marks; those are useful artistic choices in the example. `weightedRasterPoints2D` returns sampled positions and source pixel indices. `weightedRasterCentroids2D` accepts those positions, assigns positive-weight pixel centers to their nearest original site, and returns one synchronous update plus mass per site. Repeating a call is an explicit edit, not hidden iteration.

The sampler draws with replacement, so several marks may originate in one pixel, and the weighted step may move marks away from their initially sampled pixels. There is no minimum distance or circle packing. The explicit LCG state makes a given input replay exactly; it does not promise statistically independent or unbiased marks. The example's count, density transform, shapes and colors are authored study settings, not corpus-derived recommended ranges. The [capability decision](../design/capabilities/weighted-image-marks.md) discusses Sighack's brightness-to-circle-radius packing and Secord's continuous weighted Voronoi method as related context.
