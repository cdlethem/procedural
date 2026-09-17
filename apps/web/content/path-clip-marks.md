# Path clip marks

Draw straight rows, wandering paths or a fan, then retain only the segments inside a chosen boundary. The source paths and boundary are independent: changing either one reveals a different part of the same clipping technique. The layer stays clear outside the retained marks and optional boundary outline.

| Control | Canvas effect |
| --- | --- |
| Source paths | Starts with rows, a seeded vertical wander, or rays fanning from the left. |
| Paths | Number of separate trajectories passed to the clipper. |
| Segments per path | Sampling of each source trajectory before clipping; more segments resolve wander at a higher cost. |
| Wander | Vertical step variation in **wander** mode. It has no effect on straight rows or the fan. |
| Clip boundary | Uses a rectangle, a portal cut into the bottom, a bay cut into the right side, or a regular polygon. |
| Boundary center X/Y | Moves only the clipping shape, leaving source paths in place. Exact entry can move it outside the canvas. |
| Boundary width/height | Sets the uncut boundary extent; for a regular polygon these scale its horizontal and vertical radius. |
| Notch opening/depth | Sets the portal or bay cut. Zero opening or depth gives a rectangle. A full-depth cut that would split the polygon is rejected. |
| Polygon sides/angle | Changes the regular boundary's corners and rotation. |
| Stroke weight | Thickness of the retained source segments. |
| Show boundary | Draws the actual clipping outline so the cut is easier to read. |
| Palette | Colors retained paths in source order. |

Start with rows and the portal. Switch to a bay without changing the rows to compare the missing area, then use the same bay with the fan. Move the boundary sideways to crop a new part of those rays. Turn off **Show boundary** when the cut itself should be the only visible trace.

The study calls `geometry.clip-segments-simple-polygon-2d` with explicit segments and a simple polygon. The source layouts, boundary families, and line styling are editable drawing choices around that operation. Large path, segment and boundary combinations have a shared work limit rather than silently reducing any control.
