# Transported ribbons

Carry a variable-width strip along an editable three-dimensional centerline. The p5 page exposes the source geometry separately from the view and surface.

| Controls | Visible effect |
| --- | --- |
| Path samples, vertical bend and cycles, depth bend and cycles, start/end widths, middle width pulse | Change the actual mesh supplied to the portable operation. |
| Camera yaw, pitch, view zoom | Change the fixed orthographic projection without rebuilding the source. Geometry edits do not automatically refit the view. |
| Face colour | Choose single-ink lighting, height bands, or triangle facets without changing geometry. |
| Outline weight | Trace visible mesh edges; zero hides them. |
| C palette | Recolor the surface without changing geometry. |
| T structural edit | Toggle a deliberate alternate source; use the fields for independent edits. |
| 0 reset / S save PNG | Restore defaults or export the transparent canvas. |

The study calls [`parallel-transport-ribbon-3d`](../../../catalog/operations/parallel-transport-ribbon-3d.json) through `../materials-b-studies.js`. The native canvas is transparent outside the mesh. The example uses a depth-sorted Canvas2D projection; it does not provide texture mapping, shadows, or interpenetrating-mesh depth correctness.
