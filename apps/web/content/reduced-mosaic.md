# Reduced mosaic

A seeded field becomes a grid of color tiles, then median-cut reduction groups its colors. Show all tiles for a continuous mosaic, or keep only high- or low-valued source cells to reveal lower layers in the openings.

| Control | Canvas effect |
| --- | --- |
| Cell size | Changes the sampling density and size of the square tiles. |
| Colors | Requests the number of reduced colors used across the full source field. |
| Show source values | Shows every tile, only high-valued cells, or only low-valued cells. |
| Source cutoff | Divides the source scalar field when the high or low view is selected. The all-tiles view ignores this cutoff. |
| Seed | Shifts the generated source field, changing which tiles receive each reduced color. |
| Palette | Supplies the colors used to construct the source before reduction. |

The color reduction always sees the complete source. Changing the mask selects tiles **after** quantization, so a tile that remains visible keeps its original color. Try high and low at the same cutoff to see complementary parts of the source above another layer.

The study uses `color.median-cut-quantize`; the generated field is replaceable in the editable source.
