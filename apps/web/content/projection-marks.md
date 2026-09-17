# Projection marks

Ordered discs push source path samples outward. Rows, columns and spokes offer different starting geometry; each disc has its own position and radius. The marks are drawn on a transparent layer.

| Control | Canvas effect |
| --- | --- |
| Source paths | Starts with horizontal rows, vertical columns or radial spokes. |
| Paths | Changes the number of separate paths being projected. |
| Source jitter | Offsets source samples before projection; zero gives straight source paths. |
| Discs | Applies only the first disc or both in order. |
| First/second center X and Y | Moves each disc across the source paths. |
| First/second radius | Sets each disc's reach independently. |
| Projection strength | Sets how far samples are moved; zero shows the unchanged source. |
| Stroke weight | Changes line thickness without changing the projection. |
| Palette | Colors separate paths in order. |

Set **Projection strength** to zero to see the source clearly. Raise it with one disc, then enable the second disc to see how the ordered projection alters the same paths. For a different structure, switch from rows to columns or spokes before changing the discs.

The study calls `geometry.sequential-disc-projection-2d` on explicit source samples. It computes new point positions; the lines are the study's drawing choice.
