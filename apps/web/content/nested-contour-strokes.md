# Nested contour strokes

Build contour ink around an editable closed polygon. Change the source shape, then place
successive outlines or vertex dots at signed distances from that same boundary.

| Control | Canvas effect |
| --- | --- |
| Sides / Notch depth | Change the source polygon's corner count or pull one edge inward. Zero notch keeps the regular outline. |
| Height ratio / Rotation / Boundary radius | Stretch, turn and size the source before offsetting. |
| Rings | Set the number of contours drawn from the source. |
| Starting offset | Set the first contour's signed distance from the source boundary. |
| Signed ring gap | Add this distance for each later contour. Negative values reverse the progression; zero repeats one offset. |
| Join limit | Controls when pointed joins bevel. |
| Ring marks / Vertex size | Show outlines, offset vertices as dots, or both; size the dots. |
| Stroke weight / Mark opacity | Change outline width and the transparency of lines and dots. Zero stroke weight removes outlines. |
| Palette | Recolors the same offset paths. |

The source polygon is made from the visible shape controls and passed to
`geometry.offset-polyline-2d` for each ring. Another closed source path can replace it in
code. These are independently offset strokes: large inward or outward distances may
cross or collapse, and the study does not merge them with polygon Boolean cleanup.
The layer is transparent. Exact numeric entry accepts valid values beyond the slider
interval, subject to the combined ring and source-vertex work budget.
