# Stepped blocks

Cut a shoulder into a polygon footprint and extrude it into a block. The stepped contour creates a visible lower ledge; changing its dimensions changes the solid itself, while the camera and face treatment stay independent. Switch to **Beveled** to compare the same controls on a sloped outline.

| Control | Canvas effect |
| --- | --- |
| Footprint | Changes the source outline between stepped and beveled forms. |
| Footprint width / Footprint depth | Set the block's horizontal and vertical footprint spans. |
| Step depth | Moves the cut inward from one edge of the footprint, changing the ledge depth. |
| Shoulder width | Sets how far the stepped cut reaches across the footprint. |
| Corner inset | Trims corners and skews the side opposite the step. |
| Extrusion height | Lengthens the walls between the two polygon caps. |
| Camera yaw / Camera pitch | Reveal different sides without altering the block. |
| View zoom | Changes projected size without fitting the edited block back into the frame. |
| Face colour | Choose direction-based solid shading, source-height color bands, or individually colored triangular facets. |
| Outline weight | Controls form edges in solid-lit mode and triangle edges in bands or facets; zero removes them. |
| Palette | Recolors the current block while preserving its outline and projection. |

The polygon is assembled from these controls in `packages/javascript/examples/materials-b-studies.js`, then `extrudeSimplePolygon3D` makes cap and wall triangles. You can substitute another valid simple polygon in code. The layer has no opaque page fill. The step and shoulder must fit within the selected width and depth, and the mesh work is bounded.
