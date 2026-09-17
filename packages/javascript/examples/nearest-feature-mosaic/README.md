# Nearest feature mosaic

Seeded sites own their nearest grid cells. Show the translucent regions, only the boundaries between different owners, or both.

| Control | Canvas effect |
| --- | --- |
| Cell size | Grid resolution and edge stepping. |
| Features | Density of seeded feature sites. |
| Region display | Regions, boundaries, or both. |
| Boundary width | Thickness of owner boundaries; zero hides them. |
| Show sites | Draw circles on the actual feature cells. |
| Site size | Diameter of the feature circles. |

The page provides sliders for quick exploration and exact number fields for supported values. **T** applies alternate settings, **C** swaps the palette, **0** resets, and **S** saves a transparent PNG. The canvas shows paper through CSS for preview only.

The reusable computation is [`raster.euclidean-distance-transform-2d`](../../../catalog/operations/euclidean-distance-transform-2d.json). The generated source field and mark treatment remain editable drawing choices in `../materials-a-studies.js`.
