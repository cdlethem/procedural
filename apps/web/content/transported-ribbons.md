# Transported ribbons

Sweep a variable-width strip along a 3D centerline. Vertical and depth bends are separate, so you can make a level taper, a shallow arc, or a path that turns toward and away from the viewer. The ribbon's local frame is transported along the path before p5 projects its triangles.

| Control | Canvas effect |
| --- | --- |
| Path samples | Changes how finely the centerline and ribbon are sampled. Fewer samples reveal angular turns; more samples follow the same path more closely. |
| Vertical bend / Vertical cycles | Set how far and how often the centerline rises and falls. Zero bend makes this axis level. |
| Depth bend / Depth cycles | Independently set movement toward and away from the camera. Zero bend makes this axis flat. |
| Start width / End width | Set the ribbon width at each end, allowing a taper in either direction. |
| Middle width pulse | Expands or contracts the strip between its ends without changing the endpoint widths. |
| Camera yaw / Camera pitch | Turn or tilt the projection to reveal the path's depth. |
| View zoom | Sets a fixed projection scale; widening or bending the path can move it beyond the frame. |
| Face colour | Choose a single direction-shaded color, source-height bands, or per-triangle palette facets. |
| Outline weight | Sets visible folds and silhouette edges in solid-lit mode, or triangle edges in the other modes. Zero hides them. |
| Palette | Recolors the same projected ribbon. |

The study generates editable centerline points and widths in `packages/javascript/examples/materials-b-studies.js`, then passes them to `parallelTransportRibbon3D`. Supply another valid open 3D path and width list in code to keep the same strip construction. The layer leaves the Studio background transparent. Sampling and mesh work have explicit bounds.
