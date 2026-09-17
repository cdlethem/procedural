# Rounded panels

Repeat softened polygon panels as a loose quilt, a tight grid, or overlapping shapes.
Each panel begins as an editable straight-sided outline. Chaikin corner cuts round that
outline before p5 draws a fill, an edge, or both.

| Control | Canvas effect |
| --- | --- |
| Panels / Columns | Set the total number of panels and the number placed in each row. A single column makes a vertical stack. |
| Column gap / Row gap | Separate neighbouring panel bounds on each axis. Negative gaps overlap them. |
| Row stagger | Moves later rows horizontally by a fraction of the column pitch. |
| Sides | Changes how many corners the source polygon has before smoothing. |
| Notch depth | Pulls one source edge inward to break the regular outline. Zero keeps it unnotched. |
| Height ratio / Rotation | Stretch and turn the source outline before the corner cuts. |
| Panel radius | Sizes each source outline and, with the gaps, changes the layout pitch. |
| Corner cuts | Sets how many Chaikin passes soften each outline. Zero keeps straight edges. |
| Treatment / Fill opacity | Choose outline, fill, or both and set the fill's transparency. |
| Stroke weight | Changes outline thickness; zero removes the outline. |
| Palette | Recolors the current panel geometry. |

The source polygon is assembled from the shape controls, then passed to
`geometry.chaikin-polyline-2d`. Replace that source path in code if you need a different
boundary; the same corner-cut operation accepts other closed polylines. The layer has no
opaque page fill, so its panels can sit over other Studio layers. Number fields accept
exact values beyond their slider intervals where valid; a combined generation budget
limits very large panel, side and refinement combinations.
