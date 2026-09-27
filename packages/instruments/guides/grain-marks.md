# Grain marks

Place one or more editable source polygons with **Center X/Y**, **Polygon width/height**, **Polygon sides**, **Source angle**, **Source groups**, and **Group spread**. Each polygon is triangulated by the accepted polygon operation, then sampled by area. **Distribution** chooses uniform interior, vertex-near, or exact triangle-edge coordinates. Edge mode includes the triangulation's interior edges, not only the outer perimeter. **Point density** controls how many positions are sampled from polygon area; count is deliberately integer-valued per group, so a very small source at low density may yield no dots.

| Controls | What changes on the canvas |
| --- | --- |
| Center X/Y, Polygon width/height, Polygon sides, Source angle | Place and shape the source polygons whose interiors or triangle edges supply sample positions. |
| Source groups, Group spread | Repeat the local polygon sources around separate centers without painting a mandatory connecting frame. |
| Point density, Distribution, seed | Resample positions by polygon area with uniform, vertex-near or triangle-edge sampling. Even low density can produce zero marks; sampled points are subject to the area-based work budget. |
| Strokes, Mark size, Size variation | Draw dots or short strokes at retained sampled centers and vary their painted size, not their locations. |
| Stroke weight, Stroke angle, Angle spread, palette | Set stroke thickness, direction and color without rebuilding source polygons or resampling positions. |

**Strokes** switches dots to short lines; **Mark size**, **Size variation**, **Stroke weight**, **Stroke angle**, and **Angle spread** control their material and direction without relocating sampled points. Varying density or distribution changes the sampled source rather than merely recoloring it. The drawing has no paper or mandatory frame. The 25,000-point budget uses the triangulated polygon areas across all groups, not their bounding rectangles; excess density is rejected before sampling rather than quietly clipping the mark count.

For one soft pocket, try Center X 145, Center Y 470, Width 110, Height 105, Sides 5, Groups 1, Density .012, Uniform, Size 1.5. For directional multiscale fragments, try Center X 340, Center Y 320, Width 165, Height 210, Sides 6, Groups 4, Group spread 200, Density .01, Strokes on, Size 4, Size variation .8, Angle 60, Angle spread 35. Increase density for texture only while preserving the source shape, then combine separate layers at different sizes if independent grain scales are needed.
