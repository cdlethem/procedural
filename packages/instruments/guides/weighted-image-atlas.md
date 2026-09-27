# Weighted image atlas

Construct a *local* density field and sample it into marks. There is no obligatory source panel, title, frame, or page fill; the source overlay is off by default. Weighted positions may overlap because sampling is not blue-noise packing.

| Controls | Effect |
| --- | --- |
| Density source, density grid | Relief builds winding ridges; thermal builds clustered plumes; grid uses your digit rows. Use 2–32 equal-width rows of 2–32 digits, without spaces; one terminal newline is allowed. Sampling needs positive mass after floor, inversion and threshold—not necessarily positive raw digits. No external URL or file is loaded. |
| Features, spread, feature size/aspect/angle, source seed | Construct seeded source features; the source seed is separate from the mark sampling seed. Grid mode ignores the feature construction knobs. |
| Background floor, threshold, invert | Adjust pixel weights before sampling. Even a visually faint feature can be removed by the threshold; inversion changes which areas attract marks. |
| Center X/Y, field width/height | Place and size the field *locally* in layer coordinates; it is not automatically fitted to the canvas. |
| Samples, sampling seed, centroid passes | Sample independent seeded positions with `weightedRasterPoints2D`; each centroid pass calls `weightedRasterCentroids2D` on the explicit weighted pixels. Changing the sampling seed moves sites without rebuilding the underlying density image. |
| Marks, mark size/angle, field alignment, source overlay | Dots, stitches, or broad bars use the same retained sites. Direction can follow the density gradient. These material/display controls do not resample the sites. |

For a narrow fault-line fragment, choose **relief**, six features, source size **0.06**, aspect **0.5**, background floor **0**, threshold **0.25**, field width **270**, field height **470**, 180 dots and source overlay off. For an irregular fog of strokes, choose **thermal**, three features, size **0.22**, aspect **1.7**, floor **0.1**, threshold **0.08**, sampling seed **91**, 110 field-aligned stitches and one centroid pass. For a crisp hand-authored mask choose **grid**, enter `09000\n09900\n00990\n00090\n00009` as *five separate lines*, set threshold **0.3**, invert off, and choose bars. Distinct seeds change sampling positions even on an unchanged grid.

The underlying raster is 40 × 40 weights. A combined preflight caps the worst-case pixel × sample × centroid-pass work at 500,000, before expensive centroid computation begins; oversized combinations are rejected, not silently shortened. Color, placement, source visibility and mark shape are independent of sampled pixel choices. Parameter slider intervals are conveniences; exact-entry hard limits remain finite.
