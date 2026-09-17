# Nearest feature mosaic

Seeded sites divide a grid into regions owned by the nearest feature. Fill those regions as a color map, trace only their true boundaries, or combine both views.

| Control | Canvas effect |
| --- | --- |
| Cell size | Changes the resolution of the region grid and the stepping of its edges. |
| Features | Changes the density of seeded sites that own regions. |
| Region display | **Regions** paints the existing translucent cells; **boundaries** leaves their interiors clear; **both** draws edges over the cells. |
| Boundary width | Sets the thickness of lines only where neighboring cells have different owners. Zero hides these lines. |
| Show sites | Marks the actual seeded feature cells, not every cell assigned to them. |
| Site size | Sets the diameter of those feature marks. |
| Palette | Colors the region IDs and the optional boundary and site marks. |

Use **boundaries** above another artwork to expose its colors through the region interiors. The region view uses translucent ink, so it still covers much of a lower layer; lowering overall layer opacity fades the entire map. Increasing **Features** makes smaller regions and generally more boundary segments.

The ownership grid comes from `raster.euclidean-distance-transform-2d`. The boundary lines simply compare adjacent owner IDs in that result.
