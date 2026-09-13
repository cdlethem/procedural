# Stitched paths

Lay short cross stitches along undulating rows. Marks follow equal traveled distances on each supplied path, so they remain evenly paced when the wave becomes taller or bends more sharply.

Raise **Wave height** while keeping **Stitches per path** fixed to watch the marks spread along the longer route. Turn off **Connecting thread** to leave only the stitched marks.

| Control | Canvas effect |
|---|---|
| Rows | Adds independent wave paths across the composition. |
| Wave height | Increases the vertical excursion of each row. |
| Wave count | Adds undulations from left to right. |
| Stitches per path | Changes the number of marks distributed along each full path. |
| Stitch length | Extends each mark perpendicular to its source edge. |
| Connecting thread | Reveals the original path beneath its stitches. |
| Seed | Changes each row's wave phase. |
| Palette | Colors rows without altering placement. |

The sketch supplies ordinary wave polylines to [Polyline resampling](../catalog/operations/resample-polyline-2d.json). Each returned point includes its source-edge index, used here to orient a stitch. Replace the wave vertices with your own open drawing, and replace stitches with circles or symbols.
