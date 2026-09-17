# Subdivided shells

Refine a tetrahedron, octahedron, or open patch at editable axis proportions. The p5 page exposes the source geometry separately from the view and surface.

| Controls | Visible effect |
| --- | --- |
| Base mesh, x/y/z scales, one source-corner lift, refinement levels | Change the actual mesh supplied to the portable operation. |
| Camera yaw, pitch, view zoom | Change the fixed orthographic projection without rebuilding the source. Geometry edits do not automatically refit the view. |
| Face colour | Choose single-ink lighting, height bands, or triangle facets without changing geometry. |
| Outline weight | Trace visible mesh edges; zero hides them. |
| C palette | Recolor the surface without changing geometry. |
| T structural edit | Toggle a deliberate alternate source; use the fields for independent edits. |
| 0 reset / S save PNG | Restore defaults or export the transparent canvas. |

The study calls [`loop-subdivide-triangles-3d`](../../../catalog/operations/loop-subdivide-triangles-3d.json) through `../materials-b-studies.js`. The native canvas is transparent outside the mesh. The example uses a depth-sorted Canvas2D projection; it does not provide texture mapping, shadows, or interpenetrating-mesh depth correctness.
