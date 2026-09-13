# Contour blobs

Draw nested contours around overlapping soft hills. Nearby peaks share outer contours, while higher levels separate into smaller islands around the strongest parts of the field.

Increase **Hill radius** to spread peaks until their surrounding contours merge. Change **First level** to move the whole stack of contour thresholds through the same field.

| Control | Canvas effect |
|---|---|
| Hills | Adds seeded peaks to the supplied scalar field. |
| Hill radius | Widens each peak, encouraging neighboring contours to merge. |
| First level | Chooses the lowest scalar threshold to trace. |
| Contour levels | Adds nested thresholds above the first level. |
| Line weight | Thickens the contour strokes. |
| Peak marks | Shows a small cross at each supplied hill center. |
| Seed | Repositions the hills and varies their widths. |
| Palette | Colors successive thresholds. |

The input field is a sum of soft radial peaks. [Marching squares](../catalog/operations/marching-squares-2d.json) extracts its line segments, which the sketch draws directly. You can substitute your own scalar grid while keeping the contour drawing. A threshold above every sample produces no contour at that level.
