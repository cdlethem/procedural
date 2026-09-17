# Weighted image atlas

A grayscale source raster fills the left panel. The right panel places marks where that raster assigns more weight. Swap the source image, invert its density, or move sampled marks once toward weighted pixel centroids.

| Control | Canvas effect |
| --- | --- |
| Source raster | Switch between an authored relief ridge and two thermal plumes. |
| Invert density | Shift sampling preference from dark displayed areas to light ones. |
| Marks | Change the number of sampled positions while retaining the source raster and mark treatment. |
| Centroid step | Move each sampled position once toward its weighted nearest-pixel center. |
| Mark shape | Draw retained positions as dots or short stitches. |
| Palette | Recolor the page and marks without moving sampled positions. |

The raster values are generated locally for this study. `weightedRasterPoints2D` samples the explicit integer pixel weights with a fixed random state, then `weightedRasterCentroids2D` performs the optional single synchronous move. The image-to-weight conversion and mark shapes are editable composition choices. Multiple marks can originate from one pixel; this is weighted sampling rather than minimum-distance packing.
