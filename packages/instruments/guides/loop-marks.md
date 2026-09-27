# Draw and decorate closed loops

The starting row contains three differently phased, lobed loops with colored diamonds spaced along their outlines. Change the layout to a grid or nested set, then choose whether the same contours appear as outlines, edge marks, translucent fans, or outlines with marks. Loops remain transparent between marks so they can share a caller-owned canvas with other layers.

| Control | Canvas effect |
| --- | --- |
| Layout / Loops | Row places every loop along a line; Grid arranges the requested count in rows; Nested scales loops around one center. A count of one makes a single loop in any layout. |
| Grid columns | Sets loops per grid row. The last row centers its remaining loops. |
| Spacing X / Spacing Y | Moves row centers along a horizontal/vertical step, or separates grid columns/rows. Nested loops share one center. |
| Center X / Center Y | Moves the whole arrangement, including beyond the canvas edge. |
| Radius X / Radius Y | Set the horizontal and vertical base-loop sizes. |
| Nested scale | Multiplies each successive loop radius in Nested layout; a value of one keeps their radii equal. |
| Base knots | Sets the number of controls in the base closed spline. |
| Lobes / Lobe depth / Lobe phase | Add radial waves to the sampled base contour, set their depth, and rotate them. Zero lobes leaves the base spline smooth; phase and depth then have no visible effect. Successive loops shift the wave phase. |
| Subdivisions | Samples each base-spline span more finely before lobe displacement and edge treatment. More samples make high-lobe contours less angular. |
| Treatment | Shows just the outline, just edge tiles, triangle fans from each loop center, or outline with tiles. Fans are a drawing treatment, not a general fill algorithm for self-crossing contours. |
| Tile shape / spacing / width / height | Chooses bar, diamond, or perpendicular tick marks. Spacing follows the deformed contour by distance; width runs along a bar or sets tick stroke, and height crosses the contour. These controls affect tile treatments. |
| Outline weight / Fan opacity | Sets contour stroke width or translucent fan strength in the respective treatment. |
| Palette | Recolors the marks without changing loop geometry. |

The contour comes from a closed spline with evenly spaced base controls, followed by harmonic displacement of densely sampled points. Very high lobe depth can create sharp or self-crossing loops. Work is checked before painting, so combinations of many detailed loops and close tile spacing can be rejected instead of silently simplified. Exact values within the supported bounds remain available outside any future compact slider span.
