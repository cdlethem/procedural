# Weighted image atlas

This p5 study keeps image mass, mark positions, and drawing style separate. The left panel shows an authored relief mask, while the right panel samples editable marks from its integer weights. `D` inverts density without changing the source preview; `N` changes the count; `R` takes one synchronous weighted-centroid step. `T` substitutes an independent thermal mask. `M` switches dots to stitches, and `I` switches ink, both without changing the retained point geometry. `0` resets and `S` saves the displayed PNG.

Edit the `relief` and `thermal` functions or replace `densityImage` with your own raster-to-weight mapping. The shared operations consume only integer weights and positions, so luminance conversion, mark radius/shape, color lookup, and rendering stay in this example. A centroid step can move a point out of its originally sampled pixel; `pixelIndices` retains the source draw record.

The [artist guide](../../../../docs/weighted-image-marks.md) explains each control and how to substitute an input.
